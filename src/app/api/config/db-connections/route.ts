import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';

const DATA_DIR = path.join(process.cwd(), 'data');
const CONNECTIONS_FILE = path.join(DATA_DIR, 'db-connections.json');

async function ensureDataDir() {
    try {
        await fs.access(DATA_DIR);
    } catch {
        await fs.mkdir(DATA_DIR, { recursive: true });
    }
}

export async function GET() {
    try {
        await ensureDataDir();
        try {
            const data = await fs.readFile(CONNECTIONS_FILE, 'utf-8');
            const connections = JSON.parse(data);
            return NextResponse.json({ success: true, connections });
        } catch (error: any) {
            if (error.code === 'ENOENT') {
                return NextResponse.json({ success: true, connections: [] });
            }
            throw error;
        }
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        await ensureDataDir();
        const body = await request.json();
        const { connection, action, id } = body; // action: 'save' | 'delete'

        let connections: any[] = [];
        try {
            const data = await fs.readFile(CONNECTIONS_FILE, 'utf-8');
            connections = JSON.parse(data);
        } catch (e: any) {
            if (e.code !== 'ENOENT') throw e;
        }

        if (action === 'delete' && id) {
            connections = connections.filter(c => c.id !== id);
        } else if (action === 'save') {
            if (connection.id) {
                // Update
                const index = connections.findIndex(c => c.id === connection.id);
                if (index !== -1) {
                    connections[index] = { ...connection, updatedAt: new Date().toISOString() };
                } else {
                    connections.push({ ...connection, updatedAt: new Date().toISOString() });
                }
            } else {
                // Create
                connections.push({ ...connection, id: uuidv4(), createdAt: new Date().toISOString() });
            }
        }

        await fs.writeFile(CONNECTIONS_FILE, JSON.stringify(connections, null, 2), 'utf-8');
        return NextResponse.json({ success: true, connections });

    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
