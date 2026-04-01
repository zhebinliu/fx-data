
import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import { Client as PgClient } from 'pg';
import { FxClient } from '@/lib/fxcrm';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const {
            // Target Connection (or shared if lookupConnection not provided)
            type, host, port, user, password, database, ssl,
            targetTable, targetColumn,

            // Lookup Configuration
            lookupTable, lookupMatchColumn, lookupReturnColumn, lookupDisplayColumn,

            // Optional separate lookup connection
            lookupConnection
        } = body;

        let distinctValues: string[] = [];
        let candidates: any[] = [];

        // Helper to create connection/client
        const createDbClient = async (config: any) => {
            if (config.type === 'mysql') {
                return await mysql.createConnection({
                    host: config.host,
                    port: Number(config.port) || 3306,
                    user: config.user,
                    password: config.password,
                    database: config.database,
                    ssl: config.ssl
                });
            } else { // Assuming postgres if not mysql
                const client = new PgClient({
                    host: config.host,
                    port: Number(config.port) || 5432,
                    user: config.user,
                    password: config.password,
                    database: config.database,
                    ssl: config.ssl
                });
                await client.connect();
                return client;
            }
        };

        const targetConfig = { type, host, port, user, password, database, ssl };
        // Use lookupConnection if provided, otherwise default to targetConfig
        const lookupConfig = lookupConnection || targetConfig;

        // 1. Get Distinct Target Values
        let targetClient: any;
        try {
            targetClient = await createDbClient(targetConfig);

            if (targetConfig.type === 'mysql') {
                const [rows]: any = await targetClient.execute(
                    `SELECT DISTINCT \`${targetColumn}\` as val FROM \`${targetTable}\` WHERE \`${targetColumn}\` IS NOT NULL AND \`${targetColumn}\` != ''`
                );
                distinctValues = rows.map((r: any) => r.val);
            } else { // postgres
                const res = await targetClient.query(
                    `SELECT DISTINCT "${targetColumn}" as val FROM "${targetTable}" WHERE "${targetColumn}" IS NOT NULL AND "${targetColumn}" != ''`
                );
                distinctValues = res.rows.map((r: any) => r.val);
            }
        } finally {
            if (targetClient) {
                if (targetConfig.type === 'mysql') await targetClient.end();
                else await targetClient.end(); // postgres client.end()
            }
        }

        if (distinctValues.length > 0) {
            // 2. Find Candidates in Lookup Table
            if (lookupConfig.type === 'fxcrm') {
                // CRM Lookup Implementation
                try {
                    const { appId, appSecret, permanentCode, currentOpenUserId, object: apiName } = lookupConfig;
                    if (!appId || !apiName) throw new Error("Missing CRM configuration or Object name");

                    const client = new FxClient({ appId, appSecret, permanentCode });
                    await client.getAccessToken();

                    // Chunk values to avoid hitting API limits (safe default 100)
                    const chunkSize = 100;
                    for (let i = 0; i < distinctValues.length; i += chunkSize) {
                        const batch = distinctValues.slice(i, i + chunkSize);

                        // Construct Query
                        const fieldsToSelect = [lookupMatchColumn, lookupReturnColumn, lookupDisplayColumn, '_id', 'name'];
                        const uniqueFields = Array.from(new Set(fieldsToSelect.filter(f => f)));

                        const queryPayload = {
                            currentOpenUserId,
                            data: {
                                dataObjectApiName: apiName,
                                search_query_info: {
                                    limit: 1000, // Should be enough for the batch match
                                    fields: uniqueFields,
                                    filters: [
                                        {
                                            field_name: lookupMatchColumn,
                                            field_values: batch,
                                            operator: "in"
                                        }
                                    ]
                                }
                            }
                        };

                        const endpoint = apiName.endsWith('__c') ? '/cgi/crm/custom/v2/data/query' : '/cgi/crm/v2/data/query';
                        const response = await client.post(endpoint, queryPayload);

                        if (response.errorCode === 0 && response.data && Array.isArray(response.data.dataList)) {
                            candidates = candidates.concat(response.data.dataList);
                        } else {
                            console.warn("CRM Query Warning:", response);
                        }
                    }

                } catch (e: any) {
                    throw new Error("CRM Lookup Failed: " + e.message);
                }
            } else {
                // SQL Lookup Implementation
                let lookupClient: any;
                try {
                    lookupClient = await createDbClient(lookupConfig);

                    if (lookupConfig.type === 'mysql') {
                        const placeholders = distinctValues.map(() => '?').join(',');
                        const cols = [`\`${lookupReturnColumn}\``, `\`${lookupMatchColumn}\``];
                        if (lookupDisplayColumn && lookupDisplayColumn !== lookupReturnColumn && lookupDisplayColumn !== lookupMatchColumn) {
                            cols.push(`\`${lookupDisplayColumn}\``);
                        }

                        const query = `SELECT ${cols.join(',')} FROM \`${lookupTable}\` WHERE \`${lookupMatchColumn}\` IN (${placeholders})`;
                        const [candidateRows]: any = await lookupClient.execute(query, distinctValues);
                        candidates = candidateRows;
                    } else { // postgres
                        const placeholders = distinctValues.map((_, i) => `$${i + 1}`).join(',');
                        const cols = [`"${lookupReturnColumn}"`, `"${lookupMatchColumn}"`];
                        if (lookupDisplayColumn && lookupDisplayColumn !== lookupReturnColumn && lookupDisplayColumn !== lookupMatchColumn) {
                            cols.push(`"${lookupDisplayColumn}"`);
                        }

                        const query = `SELECT ${cols.join(',')} FROM "${lookupTable}" WHERE "${lookupMatchColumn}" IN (${placeholders})`;
                        const candidateRes = await lookupClient.query(query, distinctValues);
                        candidates = candidateRes.rows;
                    }
                } finally {
                    if (lookupClient) {
                        if (lookupConfig.type === 'mysql') await lookupClient.end();
                        else await lookupClient.end(); // postgres client.end()
                    }
                }
            }
        }

        // 3. Group Results
        const analysisResult: Record<string, any[]> = {};

        distinctValues.forEach(val => {
            analysisResult[val] = [];
        });

        candidates.forEach(row => {
            const matchVal = row[lookupMatchColumn];
            if (analysisResult[matchVal]) {
                analysisResult[matchVal].push(row);
            }
        });

        return NextResponse.json({ success: true, analysis: analysisResult });

    } catch (error: any) {
        console.error("Relation Analysis Failed", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
