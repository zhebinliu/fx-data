import fs from 'fs';
import path from 'path';

const DATA_FILE = path.join(process.cwd(), 'data', 'exchange-rates.json');

export interface ExchangeRate {
    id: string;
    currencyPair: string; // e.g. "USD/CNY"
    rate: number;
    date: string; // YYYY-MM-DD
    source?: string;
    updatedAt: string;
}

export interface ExchangeRateStore {
    rates: ExchangeRate[];
}

function ensureDataFile() {
    if (!fs.existsSync(DATA_FILE)) {
        const initialData: ExchangeRateStore = { rates: [] };
        fs.writeFileSync(DATA_FILE, JSON.stringify(initialData, null, 2));
    }
}

export const getRates = (): ExchangeRate[] => {
    ensureDataFile();
    try {
        const data = fs.readFileSync(DATA_FILE, 'utf-8');
        const parsed = JSON.parse(data);
        return parsed.rates || [];
    } catch (e) {
        console.error("Failed to read exchange rates", e);
        return [];
    }
};

export const saveRate = (rate: ExchangeRate): ExchangeRate => {
    ensureDataFile();
    const rates = getRates();
    const existingIndex = rates.findIndex(r => r.id === rate.id);

    if (existingIndex >= 0) {
        rates[existingIndex] = { ...rate, updatedAt: new Date().toISOString() };
    } else {
        rates.push({ ...rate, updatedAt: new Date().toISOString() });
    }

    fs.writeFileSync(DATA_FILE, JSON.stringify({ rates }, null, 2));
    return rate;
};

export const deleteRate = (id: string): boolean => {
    ensureDataFile();
    const rates = getRates();
    const newRates = rates.filter(r => r.id !== id);

    if (newRates.length === rates.length) return false;

    fs.writeFileSync(DATA_FILE, JSON.stringify({ rates: newRates }, null, 2));
    return true;
};
