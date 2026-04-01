import { NextResponse } from 'next/server';
import { saveRate, ExchangeRate } from '@/lib/exchange-rates-store';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { id, currencyPair, rate, date, source } = body;

        if (!currencyPair || !rate || !date) {
            return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
        }

        const newRate: ExchangeRate = {
            id: id || uuidv4(),
            currencyPair,
            rate: parseFloat(rate),
            date,
            source: source || 'Manual',
            updatedAt: new Date().toISOString()
        };

        saveRate(newRate);

        return NextResponse.json({ success: true, rate: newRate });
    } catch (error) {
        return NextResponse.json({ success: false, error: "Failed to save rate" }, { status: 500 });
    }
}
