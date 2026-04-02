import { NextResponse } from 'next/server';
import { getUsers, saveUsers } from '@/lib/auth';
import type { User } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';
import path from 'path';

export const dynamic = 'force-dynamic';

const FX_API_BASE = 'https://open.fxiaoke.com';
const TOKENS_FILE = path.join(process.cwd(), 'data', 'sso_tokens.json');

async function getCorpAccessToken(): Promise<string> {
    const res = await fetch(`${FX_API_BASE}/cgi/corpAccessToken/get/V2`, {
        method: 'POST',
        cache: 'no-store',
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
        cache: 'no-store',
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
        cache: 'no-store',
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

async function saveSsoToken(token: string, userId: string): Promise<void> {
    let tokens: Record<string, { userId: string; expiresAt: number }> = {};
    try {
        const raw = await fs.readFile(TOKENS_FILE, 'utf-8');
        tokens = JSON.parse(raw);
    } catch {}
    // 清理过期 token
    const now = Date.now();
    for (const k of Object.keys(tokens)) {
        if (tokens[k].expiresAt < now) delete tokens[k];
    }
    tokens[token] = { userId, expiresAt: now + 60_000 };
    await fs.writeFile(TOKENS_FILE, JSON.stringify(tokens), 'utf-8');
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
        const userData = profile.data || profile;
        console.log('[SSO Callback] userData:', JSON.stringify({ name: userData.name, nickName: userData.nickName, mobilePhone: userData.mobilePhone }));
        const displayName = userData.name || userData.nickName || userData.account || openUserId;
        const mobile = userData.mobilePhone || '';

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
        } else {
            let changed = false;
            if (displayName && user.name !== displayName) {
                user.name = displayName;
                changed = true;
            }
            if (mobile && !user.mobile) {
                user.mobile = mobile;
                changed = true;
            }
            if (changed) await saveUsers(users);
        }

        // 生成一次性 token，重定向到 login 页面通过同源 fetch 换取 cookie
        // 不能直接在 redirect 响应上设 cookie（Chrome Bounce Tracking Mitigation 会拦截）
        const ssoToken = uuidv4();
        await saveSsoToken(ssoToken, user.id);

        console.log('[SSO Callback] Token saved for user:', user.name, '→ redirect to login');
        return NextResponse.redirect(`${baseUrl}/login?sso_token=${ssoToken}`);

    } catch (error: any) {
        console.error('SSO callback error:', error);
        return NextResponse.redirect(
            `${baseUrl}/login?error=${encodeURIComponent('SSO登录失败: ' + error.message)}`
        );
    }
}
