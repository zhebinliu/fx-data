import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import { Client as PgClient } from 'pg';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { type, host, port, user, password, database, table, primaryKey, primaryKeyValue, data } = body;

        // data contains only fields to update

        if (type === 'mysql') {
            const connection = await mysql.createConnection({
                host, port: Number(port), user, password, database
            });

            const updates = Object.keys(data).map(k => `\`${k}\` = ?`).join(', ');
            const values = [...Object.values(data), primaryKeyValue];

            await connection.execute(
                `UPDATE \`${table}\` SET ${updates} WHERE \`${primaryKey}\` = ?`,
                values
            );
            await connection.end();

        } else if (type === 'postgres') {
            const client = new PgClient({
                host, port: Number(port), user, password, database
            });
            await client.connect();

            const updates = Object.keys(data).map((k, i) => `"${k}" = $${i + 1}`).join(', ');
            const values = [...Object.values(data), primaryKeyValue];
            const pkPlaceholder = `$${values.length}`; // Last placeholder for WHERE

            await client.query(
                `UPDATE "${table}" SET ${updates} WHERE "${primaryKey}" = ${pkPlaceholder}`,
                values
            );
            await client.end();
        }

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error("DB Update Failed", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
