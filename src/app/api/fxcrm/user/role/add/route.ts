import { NextResponse } from 'next/server';
import { FxClient } from '@/lib/fxcrm';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { appId, appSecret, permanentCode, currentOpenUserId, corpId, data } = body;

        if (!appId || !appSecret || !permanentCode || !currentOpenUserId || !data) {
            return NextResponse.json({ success: false, error: "Missing API credentials or data" }, { status: 400 });
        }

        const client = new FxClient({ appId, appSecret, permanentCode });
        await client.getAccessToken();

        // Construct payload for batchAddUserRole
        // URL: https://open.fxiaoke.com/cgi/crm/v2/special/batchAddUserRole
        // Structure:
        // {
        //   "corpAccessToken": "{corpAccessToken}", (Handled by client)
        //   "currentOpenUserId": "{currentOpenUserId}",
        //   "corpId": "{corpId}", (Optional usually, or handled by client context? API doc check required. User provided it in example payload)
        //   "data": { ... }
        // }

        const payload: any = {
            currentOpenUserId,
            // corpId, // Do NOT pass corpId here if it might be undefined, as it overwrites FxClient's auto-injected corpId which is valid.
            data: {
                userIds: data.userIds, // array of FSUIDs
                roleCodes: data.roleCodes, // array of strings
                updateMajorRole: data.updateMajorRole || false,
                majorRole: data.majorRole
            }
        };

        // If corpId is explicitly provided in the request body, we can use it, but valid FxClient usage usually implies let client handle auth/context.
        if (corpId) {
            payload.corpId = corpId;
        }

        console.log("[UserRoleAdd] Payload:", JSON.stringify(payload));
        const response = await client.post('/cgi/crm/v2/special/batchAddUserRole', payload);
        console.log("[UserRoleAdd] Response:", JSON.stringify(response));

        if (response.errorCode === 0) {
            return NextResponse.json({ success: true, result: response });
        } else {
            console.error("[UserRoleAdd] API Error Response:", response);
            return NextResponse.json({
                success: false,
                error: response.errorMessage || "Failed to assign roles",
                raw: response
            }, { status: 500 });
        }

    } catch (error: any) {
        console.error("User Role Add API Error", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
