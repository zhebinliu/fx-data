import { NextResponse } from 'next/server';
import { FxClient } from '@/lib/fxcrm';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { appId, appSecret, permanentCode, objectApiName, currentOpenUserId, data } = body;

        if (!appId || !appSecret || !permanentCode || !objectApiName || !currentOpenUserId) {
            return NextResponse.json({ success: false, error: "Missing credentials, Object API Name, or Current User ID" }, { status: 400 });
        }

        if (!data || !Array.isArray(data) || data.length === 0) {
            return NextResponse.json({ success: false, error: "No data provided" }, { status: 400 });
        }

        const client = new FxClient({ appId, appSecret, permanentCode });
        // Verify token first
        const token = await client.getAccessToken();

        console.log(`Starting import for ${objectApiName} with ${data.length} rows...`);

        // FxCRM API often accepts single or batch. We'll iterate and upload for now as a simple starting point.
        // Or better, use their batch API if available. Since I don't see batch API in client, I'll use simple iteration or a batch endpoint.
        // Docs say `/cgi/crm/v2/data/create` is for single record.
        // Let's assume we want to do it in batches or one by one. To be safe and simple, let's do one by one or small parallel batches.

        let successCount = 0;
        let failureCount = 0;
        const errors: any[] = [];

        // Limit concurrency to avoid rate limits
        const processRow = async (rowWithIdx: any) => {
            const { __rowIdx, ...row } = rowWithIdx;
            try {
                const response = await client.post('/cgi/crm/v2/data/create', {
                    data: {
                        object_data: row
                    },
                    currentOpenUserId: currentOpenUserId,
                    triggerWorkFlow: false,
                    object_api_name: objectApiName,
                    apiName: objectApiName // Add this as the error suggests it's missing
                });

                if (response.errorCode === 0) { // FxCRM usually uses errorCode 0 for success
                    successCount++;
                } else {
                    failureCount++;
                    errors.push({ idx: __rowIdx, error: response.errorMessage || JSON.stringify(response) });
                }
            } catch (err: any) {
                failureCount++;
                errors.push({ idx: __rowIdx, error: err.message });
            }
        };

        // Run in sequence for now to be safe
        for (const rowWithIdx of data) {
            await processRow(rowWithIdx);
        }

        return NextResponse.json({
            success: successCount > 0, // partially successful is still success-ish?
            details: {
                successCount,
                failureCount,
                errors: errors.slice(0, 1000) // Increase limit for better UI feedback
            }
        });

    } catch (error: any) {
        console.error("Import API Error", error);
        return NextResponse.json({ success: false, error: error.message || "Unknown error" }, { status: 500 });
    }
}
