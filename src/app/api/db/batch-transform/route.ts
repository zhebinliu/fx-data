
import { NextResponse } from 'next/server';
import { createConnection } from 'mysql2/promise';
import { Client } from 'pg';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { type, host, port, user, password, database, table, ssl, operation, column, params, ids, primaryKey } = body;

        let query = '';
        let values: any[] = [];

        // Construct Query based on Operation
        // Operation Types: 'SET', 'REPLACE', 'UPPER', 'LOWER', 'TRIM', 'MATH', 'DATE_FMT'

        // SAFEGUARD: Basic SQL Injection prevention for column/table names by quoting
        // NOTE: In a real prod app, use a proper query builder or strict validation.
        // For this tool, we assume 'table' and 'column' come from internal schema validation.

        const quote = (str: string) => type === 'mysql' ? `\`${str}\`` : `"${str}"`;
        const colQ = quote(column);
        const tblQ = quote(table);

        switch (operation) {
            case 'SET':
                query = `UPDATE ${tblQ} SET ${colQ} = ?`;
                values = [params.value];
                break;
            case 'REPLACE':
                // REPLACE(str, from, to) - Standard in MySQL and PG
                query = `UPDATE ${tblQ} SET ${colQ} = REPLACE(${colQ}, ?, ?)`;
                values = [params.from, params.to];
                break;
            case 'UPPER':
                query = `UPDATE ${tblQ} SET ${colQ} = UPPER(${colQ})`;
                break;
            case 'LOWER':
                query = `UPDATE ${tblQ} SET ${colQ} = LOWER(${colQ})`;
                break;
            case 'TRIM':
                query = `UPDATE ${tblQ} SET ${colQ} = TRIM(${colQ})`;
                break;
            case 'MATH':
                // params.operator: '+', '-', '*', '/'
                // params.value: number
                const op = params.operator;
                if (!['+', '-', '*', '/'].includes(op)) throw new Error("Invalid operator");
                query = `UPDATE ${tblQ} SET ${colQ} = ${colQ} ${op} ?`;
                values = [params.value];
                break;
            case 'DATE_FMT':
                // This is tricky across DBs.
                // MySQL: DATE_FORMAT(STR_TO_DATE(col, fromFmt), toFmt)
                // PG: TO_CHAR(TO_DATE(col, fromFmt), toFmt)
                // Simplification: We might just do Basic standard formats or use application-level logic if too complex.
                // Let's implement basic MySQL/PG logic for common cases.
                const { fromFormat, toFormat } = params;
                if (type === 'mysql') {
                    query = `UPDATE ${tblQ} SET ${colQ} = DATE_FORMAT(STR_TO_DATE(${colQ}, ?), ?)`;
                    values = [fromFormat, toFormat];
                } else {
                    query = `UPDATE ${tblQ} SET ${colQ} = TO_CHAR(TO_DATE(${colQ}, ?), ?)`;
                    values = [fromFormat, toFormat];
                }
                break;
            case 'SPLIT':
                const { separator, targetColumns, autoCreate } = params;
                // Pre-step: Auto-create columns if needed
                if (autoCreate && targetColumns && targetColumns.length > 0) {
                    try {
                        // Separate connection for schema change to avoid transaction issues (though here simple execute)
                        // Re-use logic or quick check. 
                        // We'll trust the main update to fail if columns missing, but for autoCreate we must run ALTERs.
                        // For simplicity in this tool, let's "try" to add columns.
                        // NOTE: This runs *before* the main query construction returns, so we must execute it here or return a plan?
                        // We are inside the route handler, we can execute side effects.

                        if (type === 'mysql') {
                            const conn = await createConnection({ host, port, user, password, database, ssl });
                            for (const newCol of targetColumns) {
                                try {
                                    await conn.execute(`ALTER TABLE ${tblQ} ADD COLUMN \`${newCol}\` TEXT`);
                                } catch (e: any) { if (e.code !== 'ER_DUP_FIELDNAME') console.warn(e.message); }
                            }
                            await conn.end();
                        } else if (type === 'postgres') {
                            const client = new Client({ host, port, user, password, database, ssl });
                            await client.connect();
                            for (const newCol of targetColumns) {
                                try {
                                    await client.query(`ALTER TABLE ${tblQ} ADD COLUMN "${newCol}" TEXT`);
                                } catch (e: any) { if (e.code !== '42701') console.warn(e.message); }
                            }
                            await client.end();
                        }
                    } catch (err) {
                        console.error("Auto-create columns failed during split", err);
                    }
                }

                // Build UPDATE query
                // UPDATE table SET target1 = split(source, 1), target2 = split(source, 2)
                let setClauses: string[] = [];
                if (type === 'mysql') {
                    targetColumns.forEach((tCol: string, idx: number) => {
                        // SUBSTRING_INDEX(SUBSTRING_INDEX(col, sep, idx+1), sep, -1)
                        // Note: This logic works for 1-based index if count is positive.
                        // SUBSTRING_INDEX(str, sep, N) gets everything before Nth occurrence (if N>0)
                        // Then outer separate gets last part.
                        // Example: "a,b,c". N=2 => "a,b". -1 => "b". Correct.
                        // N=1 => "a". -1 => "a". Correct.
                        const count = idx + 1;
                        // We need to escape separator properly in SQL string? Params are safer.
                        // But we have N params for N columns. 
                        // We can put separator in values array repeatedly or literal if simple.
                        // Let's use literal for separator if it's safe chars, otherwise ? is better.
                        // Assuming separator is simple char for now.
                        // Using ? for separator:
                        // SET `tCol` = SUBSTRING_INDEX(SUBSTRING_INDEX(`col`, ?, ?), ?, -1)
                        // values.push(separator, count, separator);
                        setClauses.push(`\`${tCol}\` = SUBSTRING_INDEX(SUBSTRING_INDEX(${colQ}, ?, ?), ?, -1)`);
                        values.push(separator, count, separator);
                    });
                } else {
                    // Postgres: split_part(string, delimiter, position)
                    targetColumns.forEach((tCol: string, idx: number) => {
                        setClauses.push(`"${tCol}" = split_part(${colQ}, ?, ?)`);
                        // values.push(separator, idx + 1);
                        values.push(separator, idx + 1);
                    });
                }

                query = `UPDATE ${tblQ} SET ${setClauses.join(', ')}`;
                break;
            default:
                throw new Error("Unknown operation");
        }

        // Apply ID filtering if 'ids' provided
        const pkQ = primaryKey ? quote(primaryKey) : 'id';
        if (ids && Array.isArray(ids) && ids.length > 0) {
            const placeholders = ids.map(() => '?').join(',');
            query += ` WHERE ${pkQ} IN (${placeholders})`;
            values = [...values, ...ids];
        }

        // Execute
        if (type === 'mysql') {
            const connection = await createConnection({ host, port, user, password, database, ssl });
            if (operation === 'MATH' || operation === 'SET' || operation === 'DATE_FMT' || operation === 'REPLACE') {
                // MySQL2 prepared statements uses ?
            }
            // However, for PG we need $1, $2.
            // Let's handle execution separately.

            const [result]: any = await connection.execute(query, values);
            await connection.end();
            return NextResponse.json({ success: true, affectedRows: result.affectedRows });

        } else if (type === 'pg' || type === 'postgres') {
            const client = new Client({ host, port, user, password, database, ssl });
            await client.connect();

            // Convert ? to $1, $2...
            let paramIdx = 1;
            const pgQuery = query.replace(/\?/g, () => `$${paramIdx++}`);

            const result = await client.query(pgQuery, values);
            await client.end();
            return NextResponse.json({ success: true, affectedRows: result.rowCount });
        }

        return NextResponse.json({ success: false, error: 'Unsupported DB type' });

    } catch (error: any) {
        console.error('Batch transform error:', error);
        return NextResponse.json({ success: false, error: error.message });
    }
}
