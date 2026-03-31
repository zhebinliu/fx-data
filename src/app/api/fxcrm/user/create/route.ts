import { NextResponse } from 'next/server';
import { FxClient } from '@/lib/fxcrm';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { appId, appSecret, permanentCode, data } = body;

        if (!appId || !appSecret || !permanentCode || !data) {
            return NextResponse.json({ success: false, error: "Missing API credentials or data" }, { status: 400 });
        }

        const client = new FxClient({ appId, appSecret, permanentCode });
        await client.getAccessToken();

        // Call standard User Create endpoint
        // Endpoint: /cgi/crm/v2/data/create (Generic Object Creation for PersonnelObj)
        // Expected data: see user provided payload structure
        console.log("[UserCreate] Payload:", JSON.stringify(data));
        const response = await client.post('/cgi/crm/v2/data/create', data);
        console.log("[UserCreate] Response:", JSON.stringify(response));

        if (response.errorCode === 0) {
            return NextResponse.json({ success: true, result: response });
        } else {
            return NextResponse.json({
                success: false,
                error: response.errorMessage || "Failed to create user",
                raw: response
            }, { status: 500 });
        }

    } catch (error: any) {
        console.error("User Create API Error", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
