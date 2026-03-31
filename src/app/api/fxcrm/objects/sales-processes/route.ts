import { NextResponse } from 'next/server';
import { FxClient } from '@/lib/fxcrm';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { appId, appSecret, permanentCode, apiName, currentOpenUserId } = body;

        if (!appId || !appSecret || !permanentCode || !apiName || !currentOpenUserId) {
            return NextResponse.json({ success: false, error: "Missing required parameters" }, { status: 400 });
        }

        const client = new FxClient({ appId, appSecret, permanentCode });

        // FxCRM API: /cgi/crm/v2/object/getSalesProcess
        // This usually returns the sales processes and their associated stages
        const response = await client.post('/cgi/crm/v2/object/getSalesProcess', {
            apiName,
            currentOpenUserId
        });

        if (response.errorCode === 0 && response.data) {
            return NextResponse.json({
                success: true,
                salesProcesses: response.data.salesProcesses || []
            });
        } else {
            console.error("Get Sales Process Failed:", response);
            return NextResponse.json({
                success: false,
                error: response.errorMessage || "Failed to fetch sales processes",
                rawResponse: response
            }, { status: 500 });
        }

    } catch (error: any) {
        console.error("Sales Process API Error", error);
        return NextResponse.json({ success: false, error: error.message || "Unknown error" }, { status: 500 });
    }
}
