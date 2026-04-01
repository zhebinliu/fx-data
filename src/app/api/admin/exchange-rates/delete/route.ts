import { NextResponse } from 'next/server';
import { deleteRate } from '@/lib/exchange-rates-store';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { id } = body;

        if (!id) {
            return NextResponse.json({ success: false, error: "Missing ID" }, { status: 400 });
        }

        const success = deleteRate(id);

        if (success) {
            return NextResponse.json({ success: true });
        } else {
            return NextResponse.json({ success: false, error: "Rate not found" }, { status: 404 });
        }
    } catch (error) {
        return NextResponse.json({ success: false, error: "Failed to delete rate" }, { status: 500 });
    }
}
