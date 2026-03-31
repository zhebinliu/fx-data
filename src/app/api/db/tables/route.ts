import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import { Client as PgClient } from 'pg';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { type, host, port, user, password, database } = body;

        let tables: string[] = [];

        if (type === 'mysql') {
            const connection = await mysql.createConnection({
                host,
                port: Number(port) || 3306,
                user,
                password,
                database
            });
            // Show tables in MySQL
            const [rows]: any = await connection.execute('SHOW TABLES');
            await connection.end();

            // Extract table names (Object.values because the key is dynamic)
            tables = rows.map((row: any) => Object.values(row)[0] as string);

        } else if (type === 'postgres') {
            const client = new PgClient({
                host,
                port: Number(port) || 5432,
                user,
                password,
                database
            });
            await client.connect();
            // Show tables in public schema in Postgres
            const res = await client.query(`
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public'
                ORDER BY table_name;
            `);
            await client.end();

            tables = res.rows.map((row: any) => row.table_name);
        }

        return NextResponse.json({ success: true, tables });

    } catch (error: any) {
        console.error("Fetch Tables Failed", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
