import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import { Client as PgClient } from 'pg';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { type, host, port, user, password, database } = body;

        if (!host || !user || !password || !database) {
            return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
        }

        if (type === 'mysql') {
            const connection = await mysql.createConnection({
                host,
                port: Number(port) || 3306,
                user,
                password,
                database
            });
            await connection.end();
            return NextResponse.json({ success: true, message: "MySQL Connection Successful" });
        } else if (type === 'postgres') {
            const client = new PgClient({
                host,
                port: Number(port) || 5432,
                user,
                password,
                database
            });
            await client.connect();
            await client.end();
            return NextResponse.json({ success: true, message: "PostgreSQL Connection Successful" });
        } else {
            return NextResponse.json({ success: false, error: "Unsupported database type" }, { status: 400 });
        }

    } catch (error: any) {
        console.error("DB Connection Test Failed", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
