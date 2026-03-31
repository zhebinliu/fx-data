import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import { Client as PgClient } from 'pg';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { type, host, port, user, password, database, table, limit = 100, offset = 0, where } = body;

        let data: any[] = [];
        let totalCount = 0;

        let whereClause = "";
        if (where && typeof where === 'string' && where.trim()) {
            whereClause = ` WHERE ${where} `;
        }

        if (type === 'mysql') {
            const connection = await mysql.createConnection({
                host,
                port: Number(port) || 3306,
                user,
                password,
                database
            });

            // Simple query with LIMIT
            const [rows]: any = await connection.execute(
                `SELECT * FROM \`${table}\` ${whereClause} LIMIT ? OFFSET ?`,
                [limit, offset]
            );
            data = rows;

            // Get count (optional optimization: separate request)
            const [countRows]: any = await connection.execute(`SELECT COUNT(*) as count FROM \`${table}\` ${whereClause}`);
            totalCount = countRows[0].count;


            // Get column types
            const [colRows]: any = await connection.execute(
                `SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = ? AND table_name = ?`,
                [database, table]
            );
            const columns = colRows.map((c: any) => ({ name: c.column_name, type: c.data_type }));

            await connection.end();
            return NextResponse.json({ success: true, data, totalCount, columns });

        } else if (type === 'postgres') {
            const client = new PgClient({
                host,
                port: Number(port) || 5432,
                user,
                password,
                database
            });
            await client.connect();

            // Use direct string injection for WHERE clause as it is dynamic user input intended for SQL
            // LIMIT and OFFSET should still be parameterized
            const res = await client.query(`SELECT * FROM "${table}" ${whereClause} LIMIT $1 OFFSET $2`, [limit, offset]);
            data = res.rows;

            const countRes = await client.query(`SELECT COUNT(*) as count FROM "${table}" ${whereClause}`);
            totalCount = parseInt(countRes.rows[0].count, 10);

            // Get column types (PG requires checking table_schema, usually 'public' but safer to just check table_name in current DB context or try to match)
            // Simplest for PG default schema 'public':
            const colRes = await client.query(
                `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = $1`,
                [table]
            );
            const columns = colRes.rows.map((c: any) => ({ name: c.column_name, type: c.data_type }));

            await client.end();
            return NextResponse.json({ success: true, data, totalCount, columns });
        }

    } catch (error: any) {
        console.error("DB Query Failed", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
