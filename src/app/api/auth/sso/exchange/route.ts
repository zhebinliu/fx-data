import { NextResponse } from 'next/server';
import { getUsers, SESSION_COOKIE_NAME } from '@/lib/auth';
import type { User } from '@/lib/auth';
import fs from 'fs/promises';
import path from 'path';

export const dynamic = 'force-dynamic';

const TOKENS_FILE = path.join(process.cwd(), 'data', 'sso_tokens.json');

function encodeSession(user: User): string {
    return Buffer.from(`${user.id}:${user.role}:${user.username}`).toString('base64');
}

async function consumeSsoToken(token: string): Promise<string | null> {
    let tokens: Record<string, { userId: string; expiresAt: number }> = {};
    try {
        const raw = await fs.readFile(TOKENS_FILE, 'utf-8');
        tokens = JSON.parse(raw);
    } catch {
        return null;
    }
    const entry = tokens[token];
    if (!entry || entry.expiresAt < Date.now()) return null;

    // 一次性消费，立即删除
    delete tokens[token];
    await fs.writeFile(TOKENS_FILE, JSON.stringify(tokens), 'utf-8');
    return entry.userId;
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
        return NextResponse.json({ success: false, error: 'missing token' }, { status: 400 });
    }

    const userId = await consumeSsoToken(token);
    if (!userId) {
        return NextResponse.json({ success: false, error: 'invalid or expired token' }, { status: 401 });
    }

    const users = await getUsers();
    const user = users.find(u => u.id === userId);
    if (!user) {
        return NextResponse.json({ success: false, error: 'user not found' }, { status: 404 });
    }

    const { password: _, ...safeUser } = user as any;
    const sessionToken = encodeSession(user);

    const response = NextResponse.json({ success: true, user: safeUser });
    response.cookies.set(SESSION_COOKIE_NAME, sessionToken, {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        path: '/',
        maxAge: 60 * 60 * 24 * 7,
    });
    return response;
}
