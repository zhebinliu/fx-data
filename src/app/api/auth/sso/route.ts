import { NextResponse } from 'next/server';

// 纷享 OAuth2 授权发起接口
// 访问此接口会 302 跳转到纷享的用户授权页面
export async function GET(request: Request) {
    const appId = process.env.FX_APP_ID;
    const redirectUri = process.env.FX_REDIRECT_URI;

    if (!appId || !redirectUri) {
        return NextResponse.json(
            { success: false, error: '服务器未配置纷享 SSO 参数' },
            { status: 500 }
        );
    }

    // 生成随机 state 防止 CSRF
    const state = Math.random().toString(36).substring(2);

    const authorizeUrl = new URL('https://www.fxiaoke.com/oauth2/authorize');
    authorizeUrl.searchParams.set('response_type', 'code');
    authorizeUrl.searchParams.set('appid', appId);
    authorizeUrl.searchParams.set('redirect_uri', redirectUri);
    authorizeUrl.searchParams.set('scope', 'snsapi_base');
    authorizeUrl.searchParams.set('state', state);

    return NextResponse.redirect(authorizeUrl.toString());
}
