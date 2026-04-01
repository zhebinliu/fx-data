import { NextResponse } from 'next/server';
import { FxClient } from '@/lib/fxcrm';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { appId, appSecret, permanentCode, currentOpenUserId } = body;

        if (!appId || !appSecret || !permanentCode) {
            return NextResponse.json({ success: false, error: "Missing API credentials" }, { status: 400 });
        }

        const client = new FxClient({ appId, appSecret, permanentCode });
        await client.getAccessToken();

        // Fetch Department List
        // Endpoint: /cgi/department/list
        // Payload: { "fetchChild": true } to get all recursively? Need to check strict docs.
        // Documentation implies we can query lists.
        const payload = {
            fetchChild: true, // Standard param to get full tree or list usually
            currentOpenUserId // Add this just in case
        };
        const response = await client.post('/cgi/department/list', payload);

        if (response.errorCode === 0) {
            return NextResponse.json({ success: true, departments: response.departments });
        } else {
            return NextResponse.json({
                success: false,
                error: response.errorMessage || "Failed to fetch departments",
                raw: response
            }, { status: 500 });
        }

    } catch (error: any) {
        console.error("Department List API Error", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
