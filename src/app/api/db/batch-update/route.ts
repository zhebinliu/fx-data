
import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import { Client as PgClient } from 'pg';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { type, host, port, user, password, database, operations } = body;
        // operations: Array of { table, updates: { col: val }, criteria: { col: val } }

        let affectedRows = 0;

        if (type === 'mysql') {
            const connection = await mysql.createConnection({
                host,
                port: Number(port) || 3306,
                user,
                password,
                database
            });

            // Start simple sequential updates
            // Optimization: Could use CASE...WHEN...THEN logic for single query if table/cols same
            // MVP: Sequential
            for (const op of operations) {
                const { table, updates, criteria } = op;

                // Construct SET clause
                const setKeys = Object.keys(updates);
                const setClause = setKeys.map(k => `\`${k}\` = ?`).join(', ');
                const setValues = setKeys.map(k => updates[k]);

                // Construct WHERE clause
                const whereKeys = Object.keys(criteria);
                const whereClause = whereKeys.map(k => `\`${k}\` = ?`).join(' AND ');
                const whereValues = whereKeys.map(k => criteria[k]);

                const query = `UPDATE \`${table}\` SET ${setClause} WHERE ${whereClause}`;
                const [res]: any = await connection.execute(query, [...setValues, ...whereValues]);
                affectedRows += res.affectedRows;
            }

            await connection.end();

        } else if (type === 'postgres') {
            const client = new PgClient({
                host,
                port: Number(port) || 5432,
                user,
                password,
                database
            });
            await client.connect();

            for (const op of operations) {
                const { table, updates, criteria } = op;

                // Construct SET clause ($1, $2...)
                let paramIndex = 1;
                const setKeys = Object.keys(updates);
                const setClause = setKeys.map(k => `"${k}" = $${paramIndex++}`).join(', ');
                const setValues = setKeys.map(k => updates[k]);

                // Construct WHERE clause
                const whereKeys = Object.keys(criteria);
                const whereClause = whereKeys.map(k => `"${k}" = $${paramIndex++}`).join(' AND ');
                const whereValues = whereKeys.map(k => criteria[k]);

                const query = `UPDATE "${table}" SET ${setClause} WHERE ${whereClause}`;
                const res = await client.query(query, [...setValues, ...whereValues]);
                affectedRows += res.rowCount || 0;
            }

            await client.end();
        }

        return NextResponse.json({ success: true, affectedRows });

    } catch (error: any) {
        console.error("Batch Update Failed", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
