export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getUsers, updateUsersAtomic, requireAdmin } from '@/lib/auth';

// LIST USERS
export async function GET() {
    const admin = await requireAdmin();
    if (!admin) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 403 });

    const users = await getUsers();
    // Don't return passwords
    const safeUsers = users.map(({ password, ...u }) => u);
    return NextResponse.json({ success: true, users: safeUsers });
}

// CREATE USER
export async function POST(request: Request) {
    const admin = await requireAdmin();
    if (!admin) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 403 });

    try {
        const body = await request.json();
        const { username, password, name, role, permissions } = body;

        if (!username || !password || !name) {
            return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
        }

        let newUser: any;
        try {
            await updateUsersAtomic(users => {
                if (users.find(u => u.username === username)) throw new Error('USERNAME_EXISTS');
                newUser = { id: Date.now().toString(), username, password, name, role: role || 'user', permissions: permissions || [] };
                users.push(newUser);
                return users;
            });
        } catch (e: any) {
            if (e.message === 'USERNAME_EXISTS') return NextResponse.json({ success: false, error: "Username already exists" }, { status: 400 });
            throw e;
        }

        const { password: _, ...safeUser } = newUser;
        return NextResponse.json({ success: true, user: safeUser });

    } catch (error) {
        return NextResponse.json({ success: false, error: "Failed to create user" }, { status: 500 });
    }
}

// UPDATE USER
export async function PUT(request: Request) {
    const admin = await requireAdmin();
    if (!admin) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 403 });

    try {
        const body = await request.json();
        const { id, password, name, role, permissions } = body;

        try {
            await updateUsersAtomic(users => {
                const idx = users.findIndex(u => u.id === id);
                if (idx === -1) throw new Error('NOT_FOUND');
                const u = { ...users[idx] };
                if (password) u.password = password;
                if (name) u.name = name;
                if (role) u.role = role;
                if (permissions) u.permissions = permissions;
                users[idx] = u;
                return users;
            });
        } catch (e: any) {
            if (e.message === 'NOT_FOUND') return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
            throw e;
        }

        return NextResponse.json({ success: true });

    } catch (error) {
        return NextResponse.json({ success: false, error: "Failed to update user" }, { status: 500 });
    }
}

// DELETE USER
export async function DELETE(request: Request) {
    const admin = await requireAdmin();
    if (!admin) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 403 });

    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) return NextResponse.json({ success: false, error: "Missing ID" }, { status: 400 });
        if (id === admin.id) return NextResponse.json({ success: false, error: "Cannot delete yourself" }, { status: 400 });

        try {
            await updateUsersAtomic(users => {
                const next = users.filter(u => u.id !== id);
                if (next.length === users.length) throw new Error('NOT_FOUND');
                return next;
            });
        } catch (e: any) {
            if (e.message === 'NOT_FOUND') return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
            throw e;
        }

        return NextResponse.json({ success: true });

    } catch (error) {
        return NextResponse.json({ success: false, error: "Failed to delete user" }, { status: 500 });
    }
}
