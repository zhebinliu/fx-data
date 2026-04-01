import { NextResponse } from 'next/server';
import { getRates } from '@/lib/exchange-rates-store';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const rates = getRates();
        return NextResponse.json({ success: true, rates });
    } catch (error) {
        return NextResponse.json({ success: false, error: "Failed to fetch rates" }, { status: 500 });
    }
}
