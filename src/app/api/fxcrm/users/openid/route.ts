import { NextResponse } from 'next/server';
import { FxClient } from '@/lib/fxcrm';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { appId, appSecret, permanentCode, mobile } = body;

        if (!appId || !appSecret || !permanentCode || !mobile) {
            return NextResponse.json({ success: false, error: "Missing required parameters" }, { status: 400 });
        }

        const client = new FxClient({ appId, appSecret, permanentCode });
        await client.getAccessToken();

        // Get OpenUserId by Mobile
        // API: /cgi/user/getByMobile
        // Docs: https://open.fxiaoke.com/wiki.html#getOpenUserId
        const payload = {
            mobile
        };

        console.log("[OpenID] Lookup for mobile:", mobile);
        console.log("[OpenID] Payload:", JSON.stringify(payload));

        const response = await client.post('/cgi/user/getByMobile', payload);
        console.log("[OpenID] Response:", JSON.stringify(response));

        // Check response structure: expecting empList array
        if (response.errorCode === 0 && Array.isArray(response.empList) && response.empList.length > 0) {
            const openId = response.empList[0].openUserId;
            return NextResponse.json({
                success: true,
                openUserId: openId
            });
        } else {
            console.error("[OpenID] User not found or error:", response);
            return NextResponse.json({
                success: false,
                error: response.errorMessage || "User not found",
                raw: response
            }, { status: 404 });
        }

    } catch (error: any) {
        console.error("OpenID Lookup API Error", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
