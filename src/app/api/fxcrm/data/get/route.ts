import { NextResponse } from 'next/server';
import { FxClient } from '@/lib/fxcrm';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { appId, appSecret, permanentCode, currentOpenUserId, apiName, dataId } = body;

        console.log(`[DataGet] Fetching record - Object: ${apiName}, ID/Value: ${dataId}`);

        if (!appId || !appSecret || !permanentCode || !currentOpenUserId || !apiName || !dataId) {
            return NextResponse.json({ success: false, error: "Missing required parameters" }, { status: 400 });
        }

        const client = new FxClient({ appId, appSecret, permanentCode });
        await client.getAccessToken();

        // 1. Determine if search is by ID or by primary attribute (name)
        // Standard FxCRM IDs are 24 characters (hex-like).
        const isId = /^[a-fA-F0-9]{24}$/.test(dataId);

        if (isId) {
            const payload = {
                currentOpenUserId,
                data: {
                    dataObjectApiName: apiName,
                    objectDataId: dataId,
                    igonreMediaIdConvert: false
                }
            };

            // Determine endpoint based on object type (Standard vs Custom)
            const isCustomObject = apiName.endsWith('__c');
            const endpoint = isCustomObject
                ? '/cgi/crm/custom/v2/data/get'
                : '/cgi/crm/v2/data/get';

            console.log(`[DataGet] Using endpoint ${endpoint} for ${apiName}`);
            const response = await client.post(endpoint, payload);
            console.log(`[DataGet] Raw Response for ${dataId}:`, JSON.stringify(response));

            if (response.errorCode === 0 && response.data) {
                return NextResponse.json({
                    success: true,
                    data: response.data,
                    rawResponse: response
                });
            } else if (response.errorCode === 0) {
                return NextResponse.json({
                    success: false,
                    error: "未找到记录",
                    rawResponse: response
                });
            }

            // If direct get fails with an error other than "not found", we might proceed to query as fallback
            console.warn(`[DataGet] Direct GET failed: ${response.errorMessage}`, response);
        }

        // 2. Search by Primary Attribute (fallback or if not ID)
        console.log(`[DataGet] Searching by primary attribute (query fallback) for: ${dataId}`);
        const queryPayload = {
            currentOpenUserId,
            data: {
                dataObjectApiName: apiName,
                search_query_info: {
                    limit: 1,
                    offset: 0,
                    filters: [
                        {
                            field_name: "name", // Try 'name' first as it is the most common primary field
                            field_values: [dataId],
                            operator: "eq"
                        }
                    ]
                }
            }
        };

        // Determine endpoint for query fallback
        const isCustomQuery = apiName.endsWith('__c');
        const queryEndpoint = isCustomQuery
            ? '/cgi/crm/custom/v2/data/query'
            : '/cgi/crm/v2/data/query';

        const queryResponse = await client.post(queryEndpoint, queryPayload);

        if (queryResponse.errorCode === 0 && queryResponse.data && queryResponse.data.dataList && queryResponse.data.dataList.length > 0) {
            return NextResponse.json({
                success: true,
                data: queryResponse.data.dataList[0]
            });
        }

        return NextResponse.json({
            success: false,
            error: queryResponse.errorMessage || "未找到匹配数据 (请确保输入正确的 ID 或名称)",
            rawResponse: queryResponse
        });

    } catch (error: any) {
        console.error("Data Get API Error", error);
        return NextResponse.json({ success: false, error: error.message || "Unknown error" }, { status: 500 });
    }
}
