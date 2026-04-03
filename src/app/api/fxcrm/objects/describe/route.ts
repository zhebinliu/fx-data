import { NextResponse } from 'next/server';
import { FxClient } from '@/lib/fxcrm';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { appId, appSecret, permanentCode, apiName, currentOpenUserId } = body;

        if (!appId || !appSecret || !permanentCode || !apiName || !currentOpenUserId) {
            return NextResponse.json({ success: false, error: "Missing parameter: apiName, credentials, or currentOpenUserId" }, { status: 400 });
        }

        const client = new FxClient({ appId, appSecret, permanentCode });
        await client.getAccessToken();

        // Fetch object description (same endpoint for both standard and custom objects)
        const response = await client.post('/cgi/crm/v2/object/describe', {
            apiName,
            currentOpenUserId
        });

        if (response.errorCode === 0) {
            // The fields can be in data.fields (array) or data.describe.fields (map)
            let fields: any[] = [];
            if (response.data) {
                if (response.data.describe && response.data.describe.fields) {
                    // It's a map where values are the field definitions
                    fields = Object.values(response.data.describe.fields);
                } else if (Array.isArray(response.data.fields)) {
                    fields = response.data.fields;
                }
            }

            // Map to simpler format for frontend
            const simplifiedFields = fields.map((f: any) => ({
                api_name: f.api_name || f.apiName,
                display_name: f.label || f.display_name,
                is_required: f.is_required || false,
                is_index: f.is_index || false,
                target_api_name: f.target_api_name,
                type: f.type,
                date_format: f.date_format
            }));

            return NextResponse.json({
                success: true,
                fields: simplifiedFields,
                rawResponse: response // Return for debug
            });
        } else {
            return NextResponse.json({ success: false, error: response.errorMessage || "Failed to describe object" }, { status: 500 });
        }

    } catch (error: any) {
        console.error("Object Describe API Error", error);
        return NextResponse.json({ success: false, error: error.message || "Unknown error" }, { status: 500 });
    }
}
