import { NextResponse } from 'next/server';
import { FxClient } from '@/lib/fxcrm';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { appId, appSecret, permanentCode, currentOpenUserId, apiName, dataId, fieldData } = body;

        console.log(`[DataUpdate] Updating record - Object: ${apiName}, ID: ${dataId}`);
        console.log(`[DataUpdate] Field Data:`, JSON.stringify(fieldData));

        if (!appId || !appSecret || !permanentCode || !currentOpenUserId || !apiName || !dataId || !fieldData) {
            return NextResponse.json({ success: false, error: "Missing required parameters" }, { status: 400 });
        }

        const client = new FxClient({ appId, appSecret, permanentCode });
        await client.getAccessToken();

        const payload = {
            currentOpenUserId,
            data: {
                object_data: {
                    dataObjectApiName: apiName,
                    _id: dataId,
                    ...fieldData
                }
            }
        };

        console.log('[DataUpdate] Sending payload:', JSON.stringify(payload, null, 2));

        // Determine endpoint based on object type (Standard vs Custom)
        const isCustomObject = apiName.endsWith('__c');
        const endpoint = isCustomObject
            ? '/cgi/crm/custom/v2/data/update'
            : '/cgi/crm/v2/data/update';

        console.log(`[DataUpdate] Updating ${apiName} (Custom: ${isCustomObject}) via ${endpoint}`);

        const response = await client.post(endpoint, payload);

        console.log('[DataUpdate] Response:', JSON.stringify(response, null, 2));

        if (response.errorCode === 0) {
            return NextResponse.json({
                success: true
            });
        } else {
            console.error("Data Update Failed:", response);
            return NextResponse.json({
                success: false,
                error: response.errorMessage || "Update failed",
                rawResponse: response
            }, { status: 500 });
        }

    } catch (error: any) {
        console.error("Data Update API Error", error);
        return NextResponse.json({ success: false, error: error.message || "Unknown error" }, { status: 500 });
    }
}
