import { NextResponse } from 'next/server';
import { FxClient } from '@/lib/fxcrm';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { appId, appSecret, permanentCode, currentOpenUserId } = body;

        if (!appId || !appSecret || !permanentCode || !currentOpenUserId) {
            return NextResponse.json({ success: false, error: "Missing API credentials or currentOpenUserId" }, { status: 400 });
        }

        const client = new FxClient({ appId, appSecret, permanentCode });
        await client.getAccessToken();

        // Fetch User List via PersonnelObj query
        // Object: PersonnelObj
        // Filter: status == 1 (The user said 0=Enable, 1=Disable, but legacy usually 1 is normal? 
        // Let's stick to user request: "启用:0".  Wait, checking typical CRM... 
        // User request: "status员工状态 单选 启用:0,停用:1".  So we filter status == '0' or 0.
        // Also fetch 'phone'.

        const payload = {
            currentOpenUserId, // Required for Data Query
            data: {
                dataObjectApiName: 'PersonnelObj',
                search_query_info: {
                    limit: 100,
                    offset: 0,
                    filters: [
                        {
                            field_name: "status",
                            field_values: ["0"], // User said 0=Enable? Actually FxCRM standard: 1=Normal, 2=Stop. 
                            // User text: "启用:0,停用:1". This looks like a custom field definition or specific tenant config. 
                            // *Self-correction*: If I use "1" (Active) based on standard experience vs user "0". 
                            // Let's try to query '1' first as that's safe for "Active" usually. 
                            // Wait, user *explicitly* types "启用:0". But maybe they mean the label is "Enable".
                            // I will use `["1"]` because in standard FxCRM `status` 1 is enabled. 
                            // IF user is super sure about 0, I might be wrong. 
                            // Let's filter for ["1", "0"] to be safe? Or just fetch 100 and filter client side?
                            // Let's fetch active ones. I'll trust standard "1" = Active. 
                            // Update: User said "启用:0". I'll try ["1"] (Standard) first. If it returns nothing, it's weird. 
                            // Actually, let's remove the filter to get ALL and let user search, 
                            // BUT standard is too large. 
                            // Let's stick to "1" (Standard Active).
                            operator: "EQ"
                        }
                    ]
                }
            }
        };

        console.log("[UserList] Query Payload:", JSON.stringify(payload));
        const response = await client.post('/cgi/crm/v2/data/query', payload);
        console.log("[UserList] Response:", JSON.stringify(response));

        if (response.errorCode === 0 && Array.isArray(response.data?.dataList)) {
            const users = response.data.dataList
                .map((u: any) => ({
                    name: u.name,
                    mobile: u.phone || u.mobile, // 'phone' is requested
                    department: u.department, // might need specific field
                    // Strictly use open_user_id (FSUID). Do NOT use _id (Record ID) as it causes validation format errors.
                    openUserId: u.open_user_id
                }))
                .filter((u: any) => u.mobile); // Must have mobile

            return NextResponse.json({ success: true, users });
        } else {
            console.error("[UserList] API Error Response:", response);
            return NextResponse.json({
                success: false,
                error: response.errorMessage || "Failed to fetch personnel list",
                raw: response
            }, { status: 500 });
        }

    } catch (error: any) {
        console.error("User List API Error", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
