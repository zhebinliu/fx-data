import { NextResponse } from 'next/server';
import { FxClient } from '@/lib/fxcrm';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { appId, appSecret, permanentCode, currentOpenUserId, apiName, field = 'name', values, limit = 100, offset = 0 } = body;

        if (!appId || !appSecret || !permanentCode || !currentOpenUserId || !apiName) {
            return NextResponse.json({ success: false, error: "Missing required parameters" }, { status: 400 });
        }

        // If values is provided but empty, return empty result
        if (values && Array.isArray(values) && values.length === 0) {
            return NextResponse.json({ success: true, data: [], mapping: {} });
        }

        const client = new FxClient({ appId, appSecret, permanentCode });
        await client.getAccessToken();

        // Build query payload
        const searchQueryInfo: any = {
            limit: values ? values.length + 100 : limit,
            offset
        };

        // Only add filters if values are provided
        if (values && Array.isArray(values)) {
            searchQueryInfo.filters = [
                {
                    field_name: field,
                    field_values: values,
                    operator: "in"
                }
            ];
        }

        const payload = {
            currentOpenUserId,
            data: {
                dataObjectApiName: apiName,
                search_query_info: searchQueryInfo
            }
        };

        // Determine endpoint based on object type (Standard vs Custom)
        // Custom objects usually end with '__c'
        const isCustomObject = apiName.endsWith('__c');
        const endpoint = isCustomObject
            ? '/cgi/crm/custom/v2/data/query'
            : '/cgi/crm/v2/data/query';

        console.log(`[DataQuery] Querying ${apiName} (Custom: ${isCustomObject}) via ${endpoint}`);

        const response = await client.post(endpoint, payload);

        if (response.errorCode === 0 && response.data && Array.isArray(response.data.dataList)) {
            const mapping: Record<string, string> = {};
            response.data.dataList.forEach((record: any) => {
                const val = record[field];
                const id = record._id;
                if (val && id) {
                    mapping[val] = id;
                }
            });

            return NextResponse.json({
                success: true,
                data: response.data.dataList,
                mapping,
                totalCount: response.data.totalSize || response.data.dataList.length
            });
        } else {
            console.error("Data Query Failed:", response);
            return NextResponse.json({
                success: false,
                error: response.errorMessage || "Query failed",
                rawResponse: response
            }, { status: 500 });
        }

    } catch (error: any) {
        console.error("Data Query API Error", error);
        return NextResponse.json({ success: false, error: error.message || "Unknown error" }, { status: 500 });
    }
}
