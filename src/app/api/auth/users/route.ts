export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getUsers, saveUsers, requireAdmin } from '@/lib/auth';

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

        const users = await getUsers();
        if (users.find(u => u.username === username)) {
            return NextResponse.json({ success: false, error: "Username already exists" }, { status: 400 });
        }

        const newUser = {
            id: Date.now().toString(),
            username,
            password, // In real app, hash this
            name,
            role: role || 'user',
            permissions: permissions || []
        };

        users.push(newUser);
        await saveUsers(users);

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

        const users = await getUsers();
        const userIndex = users.findIndex(u => u.id === id);

        if (userIndex === -1) {
            return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
        }

        // Prevent modifying self role to non-admin if you are the only admin (optional safety, skipped for simplicity)

        const updatedUser = { ...users[userIndex] };
        if (password) updatedUser.password = password;
        if (name) updatedUser.name = name;
        if (role) updatedUser.role = role;
        if (permissions) updatedUser.permissions = permissions;

        users[userIndex] = updatedUser;
        await saveUsers(users);

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

        const users = await getUsers();
        const newUsers = users.filter(u => u.id !== id);

        if (newUsers.length === users.length) {
            return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
        }

        await saveUsers(newUsers);
        return NextResponse.json({ success: true });

    } catch (error) {
        return NextResponse.json({ success: false, error: "Failed to delete user" }, { status: 500 });
    }
}
