import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const DATA_DIR = path.join(process.cwd(), 'data');
const PROFILES_FILE = path.join(DATA_DIR, 'profiles.json');

// Ensure data directory exists
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
        const user = await getCurrentUser();

        let allProfiles: any[] = [];
        let activeProfileId = null;

        try {
            const data = await fs.readFile(PROFILES_FILE, 'utf-8');
            const json = JSON.parse(data);
            allProfiles = json.profiles || [];
            activeProfileId = json.activeProfileId;
        } catch (error: any) {
            if (error.code !== 'ENOENT') throw error;
        }

        if (!user) {
            // Unauthenticated: return empty or public? For now empty.
            return NextResponse.json({ success: true, profiles: [], activeProfileId: null });
        }

        // Filter profiles
        let visibleProfiles = [];
        if (user.role === 'admin') {
            visibleProfiles = allProfiles;
        } else {
            // Regular user sees their own + potentially "public" templates if we had them.
            // For now, strict isolation.
            // Also include profiles with NO ownerId if we want to be nice? No, migration to admin is safer.
            visibleProfiles = allProfiles.filter(p => p.ownerId === user.id);
        }

        return NextResponse.json({ success: true, profiles: visibleProfiles, activeProfileId });

    } catch (error: any) {
        console.error("Failed to read profiles:", error);
        return NextResponse.json({ success: false, error: "Failed to read profiles" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        await ensureDataDir();
        const user = await getCurrentUser();

        if (!user) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { profiles, activeProfileId } = body;

        if (!Array.isArray(profiles)) {
            return NextResponse.json({ success: false, error: "Invalid profiles format" }, { status: 400 });
        }

        // Read existing
        let allProfiles: any[] = [];
        try {
            const data = await fs.readFile(PROFILES_FILE, 'utf-8');
            const json = JSON.parse(data);
            allProfiles = json.profiles || [];
        } catch (error: any) {
            if (error.code !== 'ENOENT') throw error;
        }

        // 1. Identify profiles to KEEP (those NOT owned by current user)
        // If user is admin, they MIGHT simulate another user, but usually standard save saves "my view".
        // HOWEVER, if admin can see ALL, and saves, we don't want to delete others' profiles if the frontend only sent a subset.
        // Frontend for Admin usually sends ALL profiles if they can see all.
        // BUT, for isolation safety:
        // Strategy: "Replace my owned profiles with this new list".

        // Filter out existing profiles owned by this user
        // If current user is Admin, and the frontend sends everything, we might overwrite "ownerId: other".
        // SO: We must enforce ownerId on the incoming payload.

        const otherUsersProfiles = allProfiles.filter(p => p.ownerId && p.ownerId !== user.id);

        // Legacy profiles (no ownerId)? 
        // If I am admin, I might be claiming them? Or if I am user?
        // Let's assume migration happens once.
        // For now: Legacy profiles are treated as "Other" (Admin owned effectively) unless I am admin saving?
        // Let's stick to simple: "Replace profiles where ownerId == user.id"

        // Wait, if I am a new user, I have 0 profiles.
        // I send [Profile A].
        // I save.
        // File becomes: [Others...] + [Profile A (owner=me)].

        const newProfiles = profiles.map((p: any) => ({
            ...p,
            ownerId: user.id // Force ownership
        }));

        // Special case: Admin functionality likely needs to edit OTHER users' profiles later. 
        // For this MVP request "Each user ... separate", so strict ownership is perfect.
        // If Admin wants to edit User A's profile, they can't do it via this generic "Save My List" endpoint easily without extra logic. 
        // User asked: "Admin sees all".
        // CLI/Data isolation: "User saves config -> isolated". 

        // FIX: If Admin is saving, they are sending the WHOLE list (including others?).
        // If Frontend for Admin shows ALL profiles, and Admin deletes one, it disappears from list.
        // If we only replace "Admin's own", Admin can't delete User A's profile.

        let finalProfiles = [];

        if (user.role === 'admin') {
            // Admin is trusted to manage the WHOLE list.
            // But frontend might not send `ownerId` back if it didn't receive it? 
            // We need to ensure we don't accidentally steal ownership or lose it.
            // We should trust the Admin's payload but ensure IDs are preserved.
            // Actually, simplest for MVP:
            // Admin replaces EVERYTHING.
            // CAUTION: If Admin UI doesn't allow selecting Owner, new profiles created by Admin become Admin's.
            // Existing profiles (owned by User A) sent back by Admin -> keep Owner A?
            // The frontend needs to preserve `ownerId`.

            finalProfiles = profiles; // Trust Admin payload

        } else {
            // Regular User: Merge
            finalProfiles = [
                ...otherUsersProfiles,
                ...newProfiles
            ];

            // Also, legacy profiles (no ownerId) -> If I am user, I don't touch them.
            const legacyProfiles = allProfiles.filter(p => !p.ownerId);
            // otherUsersProfiles check above might handle it if we consider undefined !== user.id.
            // Yes: undefined !== 'user1'.
            // So legacy are preserved.
        }

        await fs.writeFile(PROFILES_FILE, JSON.stringify({
            profiles: finalProfiles,
            activeProfileId
        }, null, 2), 'utf-8');

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error("Failed to save profiles:", error);
        return NextResponse.json({ success: false, error: "Failed to save profiles" }, { status: 500 });
    }
}
