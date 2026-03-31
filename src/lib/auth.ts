import fs from 'fs/promises';
import path from 'path';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const DATA_DIR = path.join(process.cwd(), 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

export interface User {
    id: string;
    username: string;
    password?: string; // Only for internal use, never return to client
    role: 'admin' | 'user';
    name: string;
    permissions: string[]; // e.g. ['import', 'update', 'query', 'process', 'workflow']
    preferences?: {
        theme?: 'light' | 'dark';
        primaryColor?: string;
        aiConfig?: {
            provider?: string;
            apiKey?: string;
            baseUrl?: string;
            model?: string;
        };
    };
}

export const SESSION_COOKIE_NAME = 'fxcrm_auth_session';

// --- User Management ---

async function ensureDataDir() {
    try {
        await fs.access(DATA_DIR);
    } catch {
        await fs.mkdir(DATA_DIR, { recursive: true });
    }
}

export async function getUsers(): Promise<User[]> {
    await ensureDataDir();
    try {
        const data = await fs.readFile(USERS_FILE, 'utf-8');
        return JSON.parse(data);
    } catch (error: any) {
        if (error.code === 'ENOENT') {
            // Initialize with default admin
            const defaultAdmin: User = {
                id: 'admin_001',
                username: 'admin',
                password: '123', // In a real app, hash this!
                role: 'admin',
                name: '管理员',
                permissions: ['*'],
                preferences: {
                    theme: 'light',
                    primaryColor: '#165DFF',
                    aiConfig: {}
                }
            };
            await fs.writeFile(USERS_FILE, JSON.stringify([defaultAdmin], null, 2), 'utf-8');
            return [defaultAdmin];
        }
        return [];
    }
}

export async function saveUsers(users: User[]): Promise<void> {
    await ensureDataDir();
    await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
}

export async function updateUser(id: string, updates: Partial<User>): Promise<User | null> {
    const users = await getUsers();
    const index = users.findIndex(u => u.id === id);
    if (index === -1) return null;

    const updatedUser = { ...users[index], ...updates };
    users[index] = updatedUser;

    await saveUsers(users);

    // Return without password
    const { password: _, ...safeUser } = updatedUser;
    return safeUser;
}

// --- Session Management ---

// Simple session encoding: userId:role
// In production, sign this with a JWT secret.
function encodeSession(user: User): string {
    return Buffer.from(`${user.id}:${user.role}:${user.username}`).toString('base64');
}

function decodeSession(token: string): Partial<User> | null {
    try {
        const decoded = Buffer.from(token, 'base64').toString('utf-8');
        const [id, role, username] = decoded.split(':');
        if (!id || !role || !username) return null;
        return { id, role: role as 'admin' | 'user', username };
    } catch {
        return null;
    }
}

export async function login(username: string, password: string): Promise<User | null> {
    const users = await getUsers();
    const user = users.find(u => u.username === username && u.password === password);
    if (!user) return null;

    // Create session
    const token = encodeSession(user);
    cookies().set(SESSION_COOKIE_NAME, token, {
        httpOnly: true,
        // Default to false for easier deployment. Set COOKIE_SECURE='true' in .env/docker for HTTPS.
        secure: process.env.COOKIE_SECURE === 'true',
        path: '/',
        maxAge: 60 * 60 * 24 * 7 // 7 days
    });

    // Return user without password
    const { password: _, ...safeUser } = user;
    return safeUser;
}

export async function logout() {
    cookies().delete(SESSION_COOKIE_NAME);
}

export async function getCurrentUser(): Promise<User | null> {
    const token = cookies().get(SESSION_COOKIE_NAME)?.value;
    if (!token) return null;

    const session = decodeSession(token);
    if (!session) return null;

    // Optional: Re-verify against DB to ensure user still exists/active
    const users = await getUsers();
    const user = users.find(u => u.id === session.id);
    if (!user) return null;

    const { password: _, ...safeUser } = user;
    return safeUser;
}

export async function requireAuth() {
    const user = await getCurrentUser();
    if (!user) {
        // Return 401 response or null to handle in calling route
        return null;
    }
    return user;
}

export async function requireAdmin() {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') {
        return null;
    }
    return user;
}
