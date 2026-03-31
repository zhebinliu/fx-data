import { NextResponse } from 'next/server';
import { FxClient } from '@/lib/fxcrm';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { appId, appSecret, permanentCode, mobile } = body;

        if (!appId || !appSecret || !permanentCode || !mobile) {
            return NextResponse.json({ success: false, error: "Missing parameters" }, { status: 400 });
        }

        const client = new FxClient({ appId, appSecret, permanentCode });
        // The endpoint from user documentation: 1000001 usually refers to user/getByMobile
        // Standard FxCRM endpoint is /cgi/user/getByMobile
        const response = await client.post('/cgi/user/getByMobile', {
            mobile: mobile
        });

        if (response.errorCode === 0) {
            // Depending on API version, it might return a list or single object
            // Usually returns { userList: [...] } or just user object
            return NextResponse.json({
                success: true,
                data: response.data || response // Return full data for frontend to parse
            });
        } else {
            return NextResponse.json({ success: false, error: response.errorMessage || "Failed to fetch user" }, { status: 500 });
        }

    } catch (error: any) {
        console.error("Get User API Error", error);
        return NextResponse.json({ success: false, error: error.message || "Unknown error" }, { status: 500 });
    }
}
