import { NextResponse } from 'next/server';
import { FxClient } from '@/lib/fxcrm';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { appId, appSecret, permanentCode, apiName, currentOpenUserId } = body;

        if (!appId || !appSecret || !permanentCode || !apiName || !currentOpenUserId) {
            return NextResponse.json({ success: false, error: "Missing required parameters" }, { status: 400 });
        }

        const client = new FxClient({ appId, appSecret, permanentCode });

        // FxCRM API: /cgi/crm/v2/object/getRecordType
        // Payload: { corpAccessToken: "...", corpId: "...", apiName: "...", currentOpenUserId: "..." }
        const response = await client.post('/cgi/crm/v2/object/getRecordType', {
            apiName,
            currentOpenUserId
        });

        if (response.errorCode === 0 && response.data) {
            return NextResponse.json({
                success: true,
                recordTypes: response.data.recordTypes || []
            });
        } else {
            console.error("Get Record Type Failed:", response);
            return NextResponse.json({
                success: false,
                error: response.errorMessage || "Failed to fetch record types",
                rawResponse: response
            }, { status: 500 });
        }

    } catch (error: any) {
        console.error("Record Type API Error", error);
        return NextResponse.json({ success: false, error: error.message || "Unknown error" }, { status: 500 });
    }
}
