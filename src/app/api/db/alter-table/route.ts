import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import { Client as PgClient } from 'pg';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { type, host, port, user, password, database, table, action, params } = body;

        let query = "";

        if (action === 'RENAME_COLUMN') {
            const { oldName, newName, dataType } = params; // dataType is needed for MySQL CHANGE COLUMN
            if (type === 'mysql') {
                // MySQL: ALTER TABLE table CHANGE oldName newName dataType
                // We need the data type for MySQL CHANGE usage. 
                // If not provided, we might fail or default (dangerous). 
                // Frontend should provide current type if possible.
                query = `ALTER TABLE \`${table}\` CHANGE \`${oldName}\` \`${newName}\` ${dataType || 'TEXT'}`;
            } else if (type === 'postgres') {
                query = `ALTER TABLE "${table}" RENAME COLUMN "${oldName}" TO "${newName}"`;
            }
        } else if (action === 'MODIFY_COLUMN') {
            const { columnName, newType } = params;
            if (type === 'mysql') {
                // ALTER TABLE table MODIFY column newType
                query = `ALTER TABLE \`${table}\` MODIFY \`${columnName}\` ${newType}`;
            } else if (type === 'postgres') {
                // ALTER TABLE table ALTER COLUMN column TYPE newType USING column::newType
                query = `ALTER TABLE "${table}" ALTER COLUMN "${columnName}" TYPE ${newType} USING "${columnName}"::${newType}`;
            }
        } else {
            return NextResponse.json({ success: false, error: "Unknown action" });
        }

        if (type === 'mysql') {
            const connection = await mysql.createConnection({
                host, port: Number(port), user, password, database
            });
            await connection.execute(query);
            await connection.end();
        } else if (type === 'postgres') {
            const client = new PgClient({
                host, port: Number(port), user, password, database
            });
            await client.connect();
            await client.query(query);
            await client.end();
        }

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error("Alter Table Failed", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
