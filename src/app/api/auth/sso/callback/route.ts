import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getUsers, saveUsers, SESSION_COOKIE_NAME } from '@/lib/auth';
import type { User } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';

const FX_API_BASE = 'https://open.fxiaoke.com';

// 第一步：用 AppID + AppSecret 获取 corpAccessToken
async function getCorpAccessToken(): Promise<string> {
    const res = await fetch(`${FX_API_BASE}/cgi/corpAccessToken/get/V2`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            appId: process.env.FX_APP_ID,
            appSecret: process.env.FX_APP_SECRET,
            permanentCode: process.env.FX_PERMANENT_CODE || '',
        }),
    });
    const data = await res.json();
    if (data.errorCode !== 0) {
        throw new Error(`获取 corpAccessToken 失败: ${data.errorMessage}`);
    }
    return data.corpAccessToken;
}

// 第二步：用 code + corpAccessToken 获取用户 OpenID
async function getUserByCode(code: string, corpAccessToken: string): Promise<any> {
    const res = await fetch(`${FX_API_BASE}/cgi/user/getByCode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            corpAccessToken,
            corpId: process.env.FX_CORP_ID,
            code,
        }),
    });
    const data = await res.json();
    if (data.errorCode !== 0) {
        throw new Error(`获取用户信息失败: ${data.errorMessage}`);
    }
    return data.userProfile || data;
}

// 第三步：用 OpenId + corpAccessToken 获取用户详情
async function getUserDetail(openUserId: string, corpAccessToken: string): Promise<any> {
    const res = await fetch(`${FX_API_BASE}/cgi/user/simpleUserInfo/get`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            corpAccessToken,
            corpId: process.env.FX_CORP_ID,
            openUserId,
        }),
    });
    const data = await res.json();
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
        // 纷享返回了错误
        const error = searchParams.get('error') || '授权失败';
        return NextResponse.redirect(`${baseUrl}/login?error=${encodeURIComponent(error)}`);
    }

    try {
        // 1. 获取企业访问凭证
        const corpAccessToken = await getCorpAccessToken();

        // 2. 用 code 获取用户 OpenID
        const userInfo = await getUserByCode(code, corpAccessToken);
        const openUserId = userInfo.openUserId || userInfo.userId;

        if (!openUserId) {
            throw new Error('无法获取用户 OpenID');
        }

        // 3. 获取用户详细信息
        const detailData = await getUserDetail(openUserId, corpAccessToken);
        const profile = detailData.userProfile || detailData;
        const displayName = profile.name || profile.fullName || openUserId;

        // 4. 在本地 users.json 中查找或自动创建该纷享用户
        const users = await getUsers();
        let user = users.find(u => u.username === `fx_${openUserId}`);

        if (!user) {
            // 自动注册：第一次纷享免登的用户, 权限默认与普通用户相同
            user = {
                id: uuidv4(),
                username: `fx_${openUserId}`,
                role: 'user',
                name: displayName,
                permissions: ['import', 'update', 'query', 'process', 'workflow'],
                preferences: { theme: 'light', primaryColor: '#165DFF' },
            };
            users.push(user);
            await saveUsers(users);
        }

        // 5. 设置 Session Cookie，与普通登录完全一致
        const token = encodeSession(user);
        cookies().set(SESSION_COOKIE_NAME, token, {
            httpOnly: true,
            secure: process.env.COOKIE_SECURE === 'true',
            path: '/',
            maxAge: 60 * 60 * 24 * 7, // 7 天
        });

        // 6. 登录成功，跳转到首页
        return NextResponse.redirect(`${baseUrl}/`);

    } catch (error: any) {
        console.error('SSO callback error:', error);
        return NextResponse.redirect(
            `${baseUrl}/login?error=${encodeURIComponent('SSO登录失败: ' + error.message)}`
        );
    }
}
