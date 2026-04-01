import { NextResponse } from 'next/server';
import { login } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { username, password } = body;

        if (!username || !password) {
            return NextResponse.json({ success: false, error: "Missing credentials" }, { status: 400 });
        }

        const user = await login(username, password);

        if (!user) {
            return NextResponse.json({ success: false, error: "Invalid username or password" }, { status: 401 });
        }

        return NextResponse.json({ success: true, user });

    } catch (error: any) {
        console.error("Login error:", error);
        return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
    }
}
