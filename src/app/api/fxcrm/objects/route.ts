import { NextResponse } from 'next/server';
import { FxClient } from '@/lib/fxcrm';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { appId, appSecret, permanentCode, currentOpenUserId } = body;

        if (!appId || !appSecret || !permanentCode || !currentOpenUserId) {
            return NextResponse.json({ success: false, error: "Missing credentials or Current User ID" }, { status: 400 });
        }

        const client = new FxClient({ appId, appSecret, permanentCode });
        // Verify token first (and get one)
        await client.getAccessToken();

        // Fetch objects
        // Endpoint: /cgi/crm/v2/object/list
        const response = await client.post('/cgi/crm/v2/object/list', {
            currentOpenUserId
        });

        if (response.errorCode === 0) {
            let rawList: any[] = [];
            if (Array.isArray(response.objects)) {
                rawList = response.objects;
            } else if (response.data && Array.isArray(response.data.objects)) {
                rawList = response.data.objects;
            } else if (Array.isArray(response.data)) {
                rawList = response.data;
            }

            const objects = rawList.map((item: any) => ({
                api_name: item.describeApiName || item.apiName || item.api_name,
                display_name: item.describeDisplayName || item.displayName || item.display_name || item.describeApiName // fallback
            }));

            return NextResponse.json({
                success: true,
                objects: objects,
                rawResponse: null // Clear debug info on success to reduce payload
            });
        } else {
            return NextResponse.json({ success: false, error: response.errorMessage || "Failed to fetch objects" }, { status: 500 });
        }

    } catch (error: any) {
        console.error("Object List API Error", error);
        return NextResponse.json({ success: false, error: error.message || "Unknown error" }, { status: 500 });
    }
}
