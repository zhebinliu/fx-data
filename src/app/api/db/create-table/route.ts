import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import { Client as PgClient } from 'pg';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { connection, tableName, columns } = body;
        const { type, host, port, user, password, database } = connection;

        if (!tableName || !columns || columns.length === 0) {
            return NextResponse.json({ success: false, error: "Invalid table name or columns" }, { status: 400 });
        }

        if (type === 'mysql') {
            const conn = await mysql.createConnection({
                host, port: Number(port), user, password, database
            });

            // Construct CREATE TABLE query
            // Defaulting to VARCHAR(255) or TEXT if not specified, but here we expect 'columns' to be simple names or objects
            // For MVP, we'll assume columns is an array of objects { name: string, type: string }
            // Always add an ID column? User might expect exact columns from Excel.
            // Let's create an auto-increment ID as primary key to be safe and standard.

            const columnDefs = columns.map((col: any) => `\`${col.name}\` ${col.type || 'TEXT'}`).join(', ');
            const query = `CREATE TABLE \`${tableName}\` (
                \`id\` INT AUTO_INCREMENT PRIMARY KEY,
                ${columnDefs}
            ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`;

            await conn.execute(query);
            await conn.end();

        } else if (type === 'postgres') {
            const client = new PgClient({
                host, port: Number(port), user, password, database
            });
            await client.connect();

            const columnDefs = columns.map((col: any) => `"${col.name}" ${col.type || 'TEXT'}`).join(', ');
            const query = `CREATE TABLE "${tableName}" (
                "id" SERIAL PRIMARY KEY,
                ${columnDefs}
            )`;

            await client.query(query);
            await client.end();
        }

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error("Create Table Failed", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
