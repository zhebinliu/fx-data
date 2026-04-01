import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import { Client as PgClient } from 'pg';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { type, host, port, user, password, database, table, primaryKey, primaryKeyValue } = body;

        if (type === 'mysql') {
            const connection = await mysql.createConnection({
                host, port: Number(port), user, password, database
            });

            await connection.execute(
                `DELETE FROM \`${table}\` WHERE \`${primaryKey}\` = ?`,
                [primaryKeyValue]
            );
            await connection.end();

        } else if (type === 'postgres') {
            const client = new PgClient({
                host, port: Number(port), user, password, database
            });
            await client.connect();

            await client.query(
                `DELETE FROM "${table}" WHERE "${primaryKey}" = $1`,
                [primaryKeyValue]
            );
            await client.end();
        }

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error("DB Delete Failed", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
