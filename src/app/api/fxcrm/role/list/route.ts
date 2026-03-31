import { NextResponse } from 'next/server';
import { FxClient } from '@/lib/fxcrm';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { appId, appSecret, permanentCode, currentOpenUserId } = body;

        if (!appId || !appSecret || !permanentCode) {
            return NextResponse.json({ success: false, error: "Missing API credentials" }, { status: 400 });
        }

        const client = new FxClient({ appId, appSecret, permanentCode });
        await client.getAccessToken();

        // Fetch Role List
        // Doc: https://www.fxiaoke.com/proj/page/openapidocs/#/home?docId=1128&categoryId=111
        // Endpoint: /cgi/crm/v2/role/list
        // Required Payload: { "currentOpenUserId": "...", corpAccessToken, corpId }
        // Note: The previous error "uri not exists" with code 10006 might be misleading or due to missing context.
        // We will try v2 as per documentation.

        console.log("[RoleList] Requesting roles with currentOpenUserId:", currentOpenUserId);

        const payload = {
            currentOpenUserId,
            data: {
                AuthContext: {
                    appId: "CRM" // Required for this specific API
                }
            }
        };

        const response = await client.post('/cgi/crm/v2/special/roleGetRoleList', payload);
        console.log("[RoleList] Response:", JSON.stringify(response));

        if (response.errorCode === 0) {
            // Key might be 'roles' or something else, let's blindly trust response structure or mapping
            // Usually returns "roles": [...]
            return NextResponse.json({ success: true, roles: response.roles || response.data });
        } else {
            return NextResponse.json({
                success: false,
                error: response.errorMessage || "Failed to fetch roles",
                raw: response
            }, { status: 500 });
        }

    } catch (error: any) {
        console.error("Role List API Error", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
