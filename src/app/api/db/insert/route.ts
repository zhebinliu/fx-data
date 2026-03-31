import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import { Client as PgClient } from 'pg';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { type, host, port, user, password, database, table, data, autoCreate } = body;

        const dataArray = Array.isArray(data) ? data : [data];
        if (dataArray.length === 0) return NextResponse.json({ success: true, count: 0 });

        // Logic to handle missing columns
        if (autoCreate && dataArray.length > 0) {
            const keys = Object.keys(dataArray[0]);
            try {
                if (type === 'mysql') {
                    const connection = await mysql.createConnection({
                        host, port: Number(port), user, password, database
                    });
                    const [rows] = await connection.execute(`SHOW COLUMNS FROM \`${table}\``);
                    const existingColumns = (rows as any[]).map(r => r.Field);
                    const missingColumns = keys.filter(k => !existingColumns.includes(k));

                    for (const col of missingColumns) {
                        try {
                            await connection.execute(`ALTER TABLE \`${table}\` ADD COLUMN \`${col}\` TEXT`);
                            console.log(`Auto-created column ${col} in ${table}`);
                        } catch (e: any) {
                            if (e.code !== 'ER_DUP_FIELDNAME') throw e;
                        }
                    }
                    await connection.end();

                } else if (type === 'postgres') {
                    const client = new PgClient({
                        host, port: Number(port), user, password, database
                    });
                    await client.connect();
                    const res = await client.query(
                        `SELECT column_name FROM information_schema.columns WHERE table_name = $1`,
                        [table]
                    );
                    const existingColumns = res.rows.map(r => r.column_name);
                    const missingColumns = keys.filter(k => !existingColumns.includes(k));

                    for (const col of missingColumns) {
                        try {
                            await client.query(`ALTER TABLE "${table}" ADD COLUMN "${col}" TEXT`);
                            console.log(`Auto-created column ${col} in ${table}`);
                        } catch (e: any) {
                            if (e.code !== '42701') throw e; // duplicate_column
                        }
                    }
                    await client.end();
                }
            } catch (err) {
                console.error("Schema evolution failed:", err);
                // Continue to insert, maybe it handles itself or fails with clear error
            }
        }

        if (type === 'mysql') {
            const connection = await mysql.createConnection({
                host, port: Number(port), user, password, database
            });

            // Assuming all rows have same keys. reliable enough for this tool.
            const keys = Object.keys(dataArray[0]);
            const columns = keys.map(k => `\`${k}\``).join(', ');

            // Bulk insert syntax: VALUES (?), (?), ...
            // Flatten values
            const values: any[] = [];
            const placeholders = dataArray.map(row => {
                const rowValues = keys.map(k => row[k]);
                values.push(...rowValues);
                return `(${keys.map(() => '?').join(', ')})`;
            }).join(', ');

            await connection.execute(
                `INSERT INTO \`${table}\` (${columns}) VALUES ${placeholders}`,
                values
            );
            await connection.end();

        } else if (type === 'postgres') {
            const client = new PgClient({
                host, port: Number(port), user, password, database
            });
            await client.connect();

            const keys = Object.keys(dataArray[0]);
            const columns = keys.map(k => `"${k}"`).join(', ');

            // Postgres bulk insert: VALUES ($1, $2), ($3, $4) ...
            const values: any[] = [];
            let paramIndex = 1;
            const placeholders = dataArray.map(row => {
                const rowValues = keys.map(k => row[k]);
                values.push(...rowValues);
                const rowPlaceholders = rowValues.map(() => `$${paramIndex++}`).join(', ');
                return `(${rowPlaceholders})`;
            }).join(', ');

            await client.query(
                `INSERT INTO "${table}" (${columns}) VALUES ${placeholders}`,
                values
            );
            await client.end();
        }

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error("DB Insert Failed", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
