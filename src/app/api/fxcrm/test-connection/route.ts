import { NextResponse } from 'next/server';
import { FxClient } from '@/lib/fxcrm';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const { appId, appSecret, permanentCode } = await request.json();

        if (!appId || !appSecret || !permanentCode) {
            return NextResponse.json({ success: false, error: "Missing credentials" }, { status: 400 });
        }

        const client = new FxClient({ appId, appSecret, permanentCode });
        const token = await client.getAccessToken(); // This verifies creds

        return NextResponse.json({
            success: true,
            message: "Connection Successful",
            // Do not return the full token to client if possible, but here it's fine for testing
            tokenPrefix: token.substring(0, 5) + "***"
        });
    } catch (error: any) {
        console.error("API Error", error);
        return NextResponse.json({ success: false, error: error.message || "Unknown error" }, { status: 500 });
    }
}
