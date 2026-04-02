import { NextResponse } from 'next/server';
import { getUsers, saveUsers, SESSION_COOKIE_NAME } from '@/lib/auth';
import type { User } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';

const FX_API_BASE = 'https://open.fxiaoke.com';

async function getCorpAccessToken(): Promise<string> {
    const res = await fetch(`${FX_API_BASE}/cgi/corpAccessToken/get/V2`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            appId: process.env.FX_APP_ID,
            appSecret: process.env.FX_APP_SECRET,
            permanentCode: process.env.FX_PERMANENT_CODE,
        }),
    });
    const data = await res.json();
    if (data.errorCode !== 0 || !data.corpAccessToken) {
        throw new Error(`获取 corpAccessToken 失败: ${JSON.stringify(data)}`);
    }
    return data.corpAccessToken;
}

async function getOpenUserIdByCode(corpAccessToken: string, code: string): Promise<string> {
    const res = await fetch(`${FX_API_BASE}/oauth2.0/getUserInfoByCode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            corpId: process.env.FX_CORP_ID,
            corpAccessToken,
            code,
            appId: process.env.FX_APP_ID,
            appSecret: process.env.FX_APP_SECRET,
        }),
    });
    const data = await res.json();
    if (data.errorCode !== 0 || !data.data) {
        throw new Error(`通过 code 获取 openUserId 失败: ${JSON.stringify(data)}`);
    }
    return data.data;
}

async function getUserInfo(corpAccessToken: string, openUserId: string): Promise<any> {
    const res = await fetch(`${FX_API_BASE}/cgi/user/get`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            corpAccessToken,
            corpId: process.env.FX_CORP_ID,
            openUserId,
        }),
    });
    const data = await res.json();
    if (data.errorCode !== 0) {
        throw new Error(`获取用户详细信息失败: ${JSON.stringify(data)}`);
    }
    return data;
}

// Session 编码（与 auth.ts 保持一致）
function encodeSession(user: User): string {
    return Buffer.from(`${user.id}:${user.role}:${user.username}`).toString('base64');
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const baseUrl = process.env.FX_REDIRECT_URI?.replace('/api/auth/sso/callback', '') || '/data';

    if (!code) {
        const error = searchParams.get('error') || '授权失败';
        return NextResponse.redirect(`${baseUrl}/login?error=${encodeURIComponent(error)}`);
    }

    try {
        const corpAccessToken = await getCorpAccessToken();
        const openUserId = await getOpenUserIdByCode(corpAccessToken, code);

        console.log('[SSO Callback] openUserId:', openUserId);

        const profile = await getUserInfo(corpAccessToken, openUserId);
        const displayName = profile.name || profile.nickName || profile.account || openUserId;
        const mobile = profile.mobilePhone || profile.data?.mobilePhone || '';

        const users = await getUsers();
        let user = users.find(u => u.username === `fx_${openUserId}`);
        if (!user) {
            user = {
                id: uuidv4(),
                username: `fx_${openUserId}`,
                role: 'user',
                name: displayName,
                mobile,
                permissions: ['import', 'update', 'query', 'process', 'workflow'],
                preferences: { theme: 'light', primaryColor: '#165DFF' },
            } as User;
            users.push(user);
            await saveUsers(users);
        } else if (mobile && !user.mobile) {
            user.mobile = mobile;
            await saveUsers(users);
        }

        // 直接设置 Session Cookie 并跳转首页（不走 sso_token 中转）
        const token = encodeSession(user);
        const redirectUrl = `${baseUrl}/`;
        const response = NextResponse.redirect(redirectUrl);

        response.cookies.set(SESSION_COOKIE_NAME, token, {
            httpOnly: true,
            secure: true, // SameSite=None 必须配合 Secure
            sameSite: 'none', // 允许在纷享 CRM iframe 中发送 cookie
            path: '/',
            maxAge: 60 * 60 * 24 * 7, // 7 天
        });

        console.log('[SSO Callback] Cookie set for user:', user.name, '→ redirect to', redirectUrl);
        return response;

    } catch (error: any) {
        console.error('SSO callback error:', error);
        return NextResponse.redirect(
            `${baseUrl}/login?error=${encodeURIComponent('SSO登录失败: ' + error.message)}`
        );
    }
}
