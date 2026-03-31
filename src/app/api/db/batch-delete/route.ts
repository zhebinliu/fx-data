
import { NextResponse } from 'next/server';
import { createConnection } from 'mysql2/promise';
import { Client } from 'pg';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { type, host, port, user, password, database, table, ssl, ids, primaryKey } = body;

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return NextResponse.json({ success: false, error: 'No IDs provided' });
        }

        const pk = primaryKey || 'id';

        // SAFEGUARD: Quote identifier
        const quote = (str: string) => type === 'mysql' ? `\`${str}\`` : `"${str}"`;
        const tblQ = quote(table);
        const pkQ = quote(pk);

        let query = '';

        if (type === 'mysql') {
            const connection = await createConnection({ host, port, user, password, database, ssl });
            // Create placeholders: ?, ?, ?
            const placeholders = ids.map(() => '?').join(',');
            query = `DELETE FROM ${tblQ} WHERE ${pkQ} IN (${placeholders})`;

            const [result]: any = await connection.execute(query, ids);
            await connection.end();
            return NextResponse.json({ success: true, affectedRows: result.affectedRows });

        } else if (type === 'pg' || type === 'postgres') {
            const client = new Client({ host, port, user, password, database, ssl });
            await client.connect();

            // Create placeholders: $1, $2, $3
            const placeholders = ids.map((_: any, idx: number) => `$${idx + 1}`).join(',');
            query = `DELETE FROM ${tblQ} WHERE ${pkQ} IN (${placeholders})`;

            const result = await client.query(query, ids);
            await client.end();
            return NextResponse.json({ success: true, affectedRows: result.rowCount });
        }

        return NextResponse.json({ success: false, error: 'Unsupported DB type' });

    } catch (error: any) {
        console.error('Batch delete error:', error);
        return NextResponse.json({ success: false, error: error.message });
    }
}
