import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { getCurrentUser } from '@/lib/auth';
import { FxClient } from '@/lib/fxcrm';

export const dynamic = 'force-dynamic';

const DATA_DIR = path.join(process.cwd(), 'data');
const PROFILES_FILE = path.join(DATA_DIR, 'profiles.json');

async function ensureDataDir() {
    try {
        await fs.access(DATA_DIR);
    } catch {
        await fs.mkdir(DATA_DIR, { recursive: true });
    }
}

export async function GET(request: Request) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ success: true, profiles: [], activeProfileId: null });
        }

        const appId = process.env.FX_APP_ID;
        const appSecret = process.env.FX_APP_SECRET;
        const permanentCode = process.env.FX_PERMANENT_CODE;

        if (!appId || !appSecret || !permanentCode) {
            return NextResponse.json({ success: false, error: '缺少 FxCRM 配置，请检查环境变量' }, { status: 500 });
        }

        let queryUserId = '';

        if (user.username.startsWith('fx_')) {
            // SSO 用户：直接从 username 提取 openUserId
            queryUserId = user.username.replace(/^fx_/, '');
        } else {
            // 非 SSO 用户：需要手机号查询 openUserId
            const mobile = new URL(request.url).searchParams.get('mobile');
            if (!mobile) {
                return NextResponse.json({ success: false, needsMobile: true });
            }
            const mainClient = new FxClient({ appId, appSecret, permanentCode });
            const mobileRes = await mainClient.post('/cgi/user/getByMobile', { mobile });
            queryUserId = mobileRes.empList?.[0]?.openUserId || '';
            if (!queryUserId) {
                return NextResponse.json({ success: false, error: '该手机号在系统中未找到对应用户' }, { status: 404 });
            }
        }

        const client = new FxClient({ appId, appSecret, permanentCode });

        const response = await client.post('/cgi/crm/custom/v2/data/query', {
            currentOpenUserId: queryUserId,
            data: {
                dataObjectApiName: 'crm_authentication_info__c',
                search_query_info: { limit: 100, offset: 0 },
            },
        });

        if (response.errorCode !== 0 || !response.data?.dataList) {
            throw new Error(response.errorMessage || '查询 crm_authentication_info__c 失败');
        }

        const profiles = await Promise.all(
            response.data.dataList.map(async (record: any) => {
                const profile: any = {
                    id: record._id,
                    name: record.name,
                    appId: record.app_id__c,
                    appSecret: record.app_secret__c,
                    permanentCode: record.permanent_authorization_co__c,
                    currentOpenUserId: record.current_user_open_user_id__c || '',
                };

                // 如果没有 currentOpenUserId 且当前用户有手机号，自动查询并回填
                if (!profile.currentOpenUserId && user.mobile && profile.appId && profile.appSecret && profile.permanentCode) {
                    try {
                        const profileClient = new FxClient({
                            appId: profile.appId,
                            appSecret: profile.appSecret,
                            permanentCode: profile.permanentCode,
                        });
                        const mobileRes = await profileClient.post('/cgi/user/getByMobile', {
                            mobile: user.mobile,
                        });
                        const openUserId = mobileRes.empList?.[0]?.openUserId || '';

                        if (openUserId) {
                            await client.post('/cgi/crm/custom/v2/data/update', {
                                currentOpenUserId: queryUserId,
                                data: {
                                    dataObjectApiName: 'crm_authentication_info__c',
                                    object_data: {
                                        _id: record._id,
                                        current_user_open_user_id__c: openUserId,
                                    },
                                },
                            });
                            profile.currentOpenUserId = openUserId;
                        }
                    } catch (e) {
                        console.error(`[Profiles] 自动填充 openUserId 失败 (${profile.name}):`, e);
                    }
                }

                return profile;
            })
        );

        // 读取本地保存的 activeProfileId
        let activeProfileId = profiles[0]?.id || null;
        try {
            const data = await fs.readFile(PROFILES_FILE, 'utf-8');
            const json = JSON.parse(data);
            if (json.activeProfileId && profiles.find((p: any) => p.id === json.activeProfileId)) {
                activeProfileId = json.activeProfileId;
            }
        } catch {}

        return NextResponse.json({ success: true, profiles, activeProfileId });

    } catch (error: any) {
        console.error('[Profiles] GET error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        await ensureDataDir();
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();

        // CRM create: body contains a 'profile' object
        if (body.profile) {
            if (!user.username.startsWith('fx_')) {
                return NextResponse.json({ success: false, error: '请通过纷享 SSO 登录以创建配置' }, { status: 403 });
            }
            const queryUserId = user.username.replace(/^fx_/, '');
            const { name, appId, appSecret, permanentCode, currentOpenUserId } = body.profile;

            const client = new FxClient({
                appId: process.env.FX_APP_ID!,
                appSecret: process.env.FX_APP_SECRET!,
                permanentCode: process.env.FX_PERMANENT_CODE!,
            });
            const response = await client.post('/cgi/crm/custom/v2/data/create', {
                currentOpenUserId: queryUserId,
                data: {
                    dataObjectApiName: 'crm_authentication_info__c',
                    object_data: {
                        name,
                        app_id__c: appId,
                        app_secret__c: appSecret,
                        permanent_authorization_co__c: permanentCode,
                        current_user_open_user_id__c: currentOpenUserId || '',
                    },
                },
            });
            if (response.errorCode !== 0) {
                throw new Error(response.errorMessage || 'CRM 创建失败');
            }
            const newId = response.data?._id || response._id || '';
            return NextResponse.json({ success: true, id: newId });
        }

        // Otherwise just save activeProfileId locally
        const { activeProfileId } = body;
        let existing: any = {};
        try {
            existing = JSON.parse(await fs.readFile(PROFILES_FILE, 'utf-8'));
        } catch {}
        await fs.writeFile(PROFILES_FILE, JSON.stringify({ ...existing, activeProfileId }, null, 2), 'utf-8');
        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('[Profiles] POST error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
