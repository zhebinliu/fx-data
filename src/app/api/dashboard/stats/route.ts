import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import fs from 'fs';
import path from 'path';
import { getCurrentUser } from '@/lib/auth';

const DATA_DIR = path.join(process.cwd(), 'data');

export async function GET() {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const isAdmin = user.role === 'admin';

        // 1. Profiles
        const profilesPath = path.join(DATA_DIR, 'profiles.json');
        let profileCount = 0;
        if (fs.existsSync(profilesPath)) {
            const data = JSON.parse(fs.readFileSync(profilesPath, 'utf-8') || '{}');
            const profiles = data.profiles || [];

            if (isAdmin) {
                profileCount = profiles.length;
            } else {
                profileCount = profiles.filter((p: any) => p.ownerId === user.id).length;
            }
        }

        // 2. DB Connections (Global for now based on previous check, but let's see if we should filter)
        // usage indicates these might be shared or global. For now, count all for everyone or just admin?
        // The file db-connections.json didn't show ownerId. Let's assume Global for now.
        // Wait, if users are isolated, maybe they shouldn't see all DB connections? 
        // But the previous implementation (ConnectionManager) didn't seem to filter by user.
        // I will count ALL for now.
        const dbPath = path.join(DATA_DIR, 'db-connections.json');
        let dbCount = 0;
        if (fs.existsSync(dbPath)) {
            const dbs = JSON.parse(fs.readFileSync(dbPath, 'utf-8') || '[]');
            dbCount = dbs.length;
        }

        // 3. Workflows
        const workflowsPath = path.join(DATA_DIR, 'workflows.json');
        let workflowCount = 0;
        if (fs.existsSync(workflowsPath)) {
            const workflows = JSON.parse(fs.readFileSync(workflowsPath, 'utf-8') || '[]');
            if (isAdmin) {
                workflowCount = workflows.length;
            } else {
                // Assuming workflows might eventually have ownerId, but checking structure... 
                // If no ownerId, count all? Or matching pattern?
                // Let's check workflow type definition if possible, but safe to filter if property exists
                workflowCount = workflows.filter((w: any) => !w.ownerId || w.ownerId === user.id).length;
            }
        }

        return NextResponse.json({
            success: true,
            stats: {
                profiles: profileCount,
                dbConnections: dbCount,
                workflows: workflowCount
            }
        });

    } catch (error: any) {
        console.error('Dashboard stats error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
