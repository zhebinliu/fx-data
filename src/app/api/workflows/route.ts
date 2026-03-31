import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';

const DATA_DIR = path.join(process.cwd(), 'data');
const WORKFLOWS_FILE = path.join(DATA_DIR, 'workflows.json');

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
            const data = await fs.readFile(WORKFLOWS_FILE, 'utf-8');
            const workflows = JSON.parse(data);
            return NextResponse.json({ success: true, workflows });
        } catch (error: any) {
            if (error.code === 'ENOENT') {
                return NextResponse.json({ success: true, workflows: [] });
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
        const { workflow, action, id } = body; // action: 'save' | 'delete'

        let workflows: any[] = [];
        try {
            const data = await fs.readFile(WORKFLOWS_FILE, 'utf-8');
            workflows = JSON.parse(data);
        } catch (e: any) {
            if (e.code !== 'ENOENT') throw e;
        }

        if (action === 'delete' && id) {
            workflows = workflows.filter(w => w.id !== id);
        } else if (action === 'save') {
            if (workflow.id) {
                // Update
                const index = workflows.findIndex(w => w.id === workflow.id);
                if (index !== -1) {
                    workflows[index] = { ...workflow, updatedAt: new Date().toISOString() };
                } else {
                    workflows.push({ ...workflow, updatedAt: new Date().toISOString() });
                }
            } else {
                // Create
                workflows.push({ ...workflow, id: uuidv4(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
            }
        }

        await fs.writeFile(WORKFLOWS_FILE, JSON.stringify(workflows, null, 2), 'utf-8');
        return NextResponse.json({ success: true, workflows });

    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
