export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getCurrentUser, getUsers, saveUsers } from '@/lib/auth';

const FX_API_BASE = 'https://open.fxiaoke.com';

async function fetchFxUserName(openUserId: string): Promise<string | null> {
    try {
        const tokenRes = await fetch(`${FX_API_BASE}/cgi/corpAccessToken/get/V2`, {
            method: 'POST',
            cache: 'no-store',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                appId: process.env.FX_APP_ID,
                appSecret: process.env.FX_APP_SECRET,
                permanentCode: process.env.FX_PERMANENT_CODE,
            }),
        });
        const tokenData = await tokenRes.json();
        if (tokenData.errorCode !== 0 || !tokenData.corpAccessToken) return null;

        const userRes = await fetch(`${FX_API_BASE}/cgi/user/get`, {
            method: 'POST',
            cache: 'no-store',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                corpAccessToken: tokenData.corpAccessToken,
                corpId: process.env.FX_CORP_ID,
                openUserId,
            }),
        });
        const userData = await userRes.json();
        if (userData.errorCode !== 0) return null;

        const info = userData.data || userData;
        return info.name || info.nickName || null;
    } catch {
        return null;
    }
}

export async function GET() {
    const user = await getCurrentUser();
    if (!user) {
        return NextResponse.json({ success: false, user: null }, { status: 200 });
    }

    // For SSO users, fetch latest name from FxCRM API
    if (user.username?.startsWith('fx_')) {
        const openUserId = user.username.replace(/^fx_/, '');
        const latestName = await fetchFxUserName(openUserId);
        if (latestName && latestName !== user.name) {
            user.name = latestName;
            // Persist updated name
            const users = await getUsers();
            const idx = users.findIndex(u => u.id === user.id);
            if (idx !== -1) {
                users[idx].name = latestName;
                await saveUsers(users);
            }
        }
    }

    return NextResponse.json({ success: true, user });
}
