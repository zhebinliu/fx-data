export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';

export async function GET() {
    const user = await getCurrentUser();
    if (!user) {
        return NextResponse.json({ success: false, user: null }, { status: 200 }); // Not error, just no user
    }
    return NextResponse.json({ success: true, user });
}
