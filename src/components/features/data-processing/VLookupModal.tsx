
"use client"

import React, { useState, useEffect, useMemo } from 'react';
import { Modal, Steps, Form, Select, Button, Message, Table, Tag, Typography, Spin, Switch, Statistic, Radio } from '@arco-design/web-react';
import { IconSwap, IconCheck, IconClose, IconFilter } from '@arco-design/web-react/icon';
import { useProfiles } from '@/context/ProfileContext';

const Step = Steps.Step;
const FormItem = Form.Item;
const Option = Select.Option;

interface VLookupModalProps {
    visible: boolean;
    onCancel: () => void;
    onSuccess: () => void;
    connection: any;
    tableName: string;
    currentColumns: string[]; // Names of columns in current table
    allTables: string[]; // List of all available tables in DB
}

export function VLookupModal({ visible, onCancel, onSuccess, connection, tableName, currentColumns, allTables }: VLookupModalProps) {
    const [step, setStep] = useState(1);
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);

    // Config State
    const [savedConnections, setSavedConnections] = useState<any[]>([]);
    const [lookupConnectionId, setLookupConnectionId] = useState<string | null>(null); // If null, use current
    const [lookupTable, setLookupTable] = useState<string | null>(null);
    const [lookupColumns, setLookupColumns] = useState<string[]>([]);
    const [fetchingColumns, setFetchingColumns] = useState(false);
    const [config, setConfig] = useState<any>(null); // Store validated config
    const [availableTables, setAvailableTables] = useState<string[]>(allTables);
    const [fetchingTables, setFetchingTables] = useState(false);

    // Analysis State
    const [analysisResult, setAnalysisResult] = useState<any>(null);
    const [candidatesMap, setCandidatesMap] = useState<Record<string, any[]>>({});
    const [resolutions, setResolutions] = useState<Record<string, any>>({}); // Map targetValue -> selectedRow (or null)

    // UI State
    const [filterMultipleOnly, setFilterMultipleOnly] = useState(false);
    const { activeProfile } = useProfiles();

    // Source Type State
    const [lookupSourceType, setLookupSourceType] = useState<'db' | 'crm'>('db');
    const [crmObjects, setCrmObjects] = useState<any[]>([]);
    const [selectedCrmObject, setSelectedCrmObject] = useState<string | null>(null);
    const [fetchingCrmObjects, setFetchingCrmObjects] = useState(false);

    useEffect(() => {
        if (visible) {
            setStep(1);
            form.resetFields();
            setConfig(null); // Reset config
            setAnalysisResult(null);
            setResolutions({});
            fetchSavedConnections();
        }
    }, [visible]);

    const fetchSavedConnections = async () => {
        try {
            const res = await fetch('/data/api/config/db-connections');
            const json = await res.json();
            if (json.success) {
                setSavedConnections(Array.isArray(json.data) ? json.data : []);
            }
        } catch (e) {
            console.error(e);
        }
    };

    const fetchCrmObjects = async () => {
        if (!activeProfile) return;
        setFetchingCrmObjects(true);
        try {
            const res = await fetch('/data/api/fxcrm/objects', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(activeProfile)
            });
            const json = await res.json();
            if (json.success) {
                setCrmObjects(json.objects);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setFetchingCrmObjects(false);
        }
    }

    const getLookupConnectionConfig = () => {
        if (lookupSourceType === 'crm') {
            if (!activeProfile) return null;
            return {
                type: 'fxcrm',
                object: selectedCrmObject,
                ...activeProfile
            };
        }

        if (!lookupConnectionId) return connection; // Use current if not selected
        const profile = savedConnections.find(c => c.id === lookupConnectionId);
        return profile ? profile.config : connection;
    };

    useEffect(() => {
        if (!lookupConnectionId) {
            setAvailableTables(allTables);
        } else {
            fetchTablesForConnection(lookupConnectionId);
        }
    }, [lookupConnectionId, allTables]);

    useEffect(() => {
        if (lookupSourceType === 'crm' && visible && crmObjects.length === 0) {
            fetchCrmObjects();
        }
    }, [lookupSourceType, visible]);

    const fetchTablesForConnection = async (id: string) => {
        const profile = savedConnections.find(c => c.id === id);
        if (!profile) return;
        setFetchingTables(true);
        try {
            const res = await fetch('/data/api/db/tables', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(profile.config)
            });
            const json = await res.json();
            if (json.success) {
                setAvailableTables(json.tables);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setFetchingTables(false);
        }
    }

    // Fetch columns when lookup table changes
    useEffect(() => {
        if (lookupSourceType === 'db' && lookupTable && connection) {
            fetchLookupColumns(lookupTable);
        } else if (lookupSourceType === 'crm' && selectedCrmObject) {
            fetchLookupColumns(selectedCrmObject);
        }
    }, [lookupTable, selectedCrmObject, lookupSourceType]);

    const fetchLookupColumns = async (target: string) => {
        setFetchingColumns(true);
        try {
            if (lookupSourceType === 'crm') {
                if (!activeProfile) return;
                const res = await fetch('/data/api/fxcrm/objects/describe', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ...activeProfile, apiName: target })
                });
                const result = await res.json();
                if (result.success) {
                    // CRM returns field objects, we extract api_names
                    // Filter or map? Let's just use api_name for now
                    const fields = result.fields.map((f: any) => f.api_name);
                    setLookupColumns(fields);
                }
            } else {
                // DB Mode
                // Using existing query API with limit 1 to get schema
                const lookupConn = getLookupConnectionConfig();
                const res = await fetch('/data/api/db/query', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ...lookupConn, table: target, limit: 1 })
                });
                const result = await res.json();

                // Use result.columns if available (new feature)
                if (result.success) {
                    if (result.columns) {
                        setLookupColumns(result.columns.map((c: any) => c.name));
                    } else if (result.data.length > 0) {
                        setLookupColumns(Object.keys(result.data[0]));
                    } else {
                        Message.warning("查找表似乎为空，无法推断列。");
                        setLookupColumns([]);
                    }
                }
            }
        } catch (e) {
            console.error(e);
        } finally {
            setFetchingColumns(false);
        }
    };

    const handleAnalyze = async () => {
        try {
            const values = await form.validate();
            setConfig(values); // Save validated values
            setLoading(true);

            const lookupConn = getLookupConnectionConfig();

            const res = await fetch('/data/api/db/analyze-relation', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...connection, // Target connection
                    lookupConnection: lookupConn, // Explicit lookup connection
                    targetTable: tableName,
                    targetColumn: values.targetColumn,
                    lookupTable: values.lookupTable,
                    lookupMatchColumn: values.lookupMatchColumn,
                    lookupReturnColumn: values.lookupReturnColumn,
                    lookupDisplayColumn: values.lookupDisplayColumn
                })
            });
            const result = await res.json();

            if (result.success) {
                setCandidatesMap(result.analysis);

                // Auto-resolve unique matches
                const initialResolutions: Record<string, any> = {};
                Object.entries(result.analysis).forEach(([val, candidates]: [string, any]) => {
                    if (candidates.length === 1) {
                        initialResolutions[val] = candidates[0];
                    }
                });
                setResolutions(initialResolutions);

                setStep(2);
            } else {
                Message.error('分析失败: ' + result.error);
            }
        } catch (e: any) {
            Message.error('验证失败或服务器错误');
        } finally {
            setLoading(false);
        }
    };

    const handleResolutionChange = (targetVal: string, candidate: any) => {
        setResolutions(prev => ({
            ...prev,
            [targetVal]: candidate
        }));
    };

    const handleExecuteUpdate = async () => {
        setLoading(true);
        try {
            if (!config) {
                Message.error("配置丢失，请重新开始。");
                return;
            }

            const updates = Object.entries(resolutions).map(([matchVal, candidate]) => {
                if (!candidate) return null;

                const targetUpdateColumn = config.targetFillColumn || config.targetColumn;
                const newValue = candidate[config.lookupReturnColumn];

                return {
                    table: tableName,
                    updates: { [targetUpdateColumn]: newValue },
                    criteria: { [config.targetColumn]: matchVal }
                };
            }).filter(Boolean);

            if (updates.length === 0) {
                Message.info("没有需要更新的数据");
                return;
            }

            // We'll send this list to a new batch endpoint
            const res = await fetch('/data/api/db/batch-update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...connection,
                    operations: updates
                })
            });
            const result = await res.json();
            if (result.success) {
                Message.success(`成功更新 ${result.affectedRows} 条数据`);
                onSuccess();
                onCancel();
            } else {
                Message.error("更新失败: " + result.error);
            }

        } catch (e: any) {
            Message.error("更新失败: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    // Render Step 1
    const renderConfig = () => (
        <Form form={form} layout="vertical" requiredSymbol={false}>
            <div className="grid grid-cols-2 gap-4">
                <FormItem label="本表匹配列" field="targetColumn" rules={[{ required: true }]}>
                    <Select placeholder="例如: account_name">
                        {currentColumns.map(c => <Option key={c} value={c}>{c}</Option>)}
                    </Select>
                </FormItem>
                <FormItem label="本表填入列" field="targetFillColumn" tooltip="如果不选，默认覆盖匹配列">
                    <Select placeholder="例如: account_id (可选)" allowClear>
                        {currentColumns.map(c => <Option key={c} value={c}>{c}</Option>)}
                    </Select>
                </FormItem>
            </div>

            <div className="border-t my-4 pt-4">
                <div className="flex justify-between items-center mb-4">
                    <Typography.Title heading={6} style={{ margin: 0 }}>关联配置</Typography.Title>
                    <Radio.Group
                        type="button"
                        value={lookupSourceType}
                        onChange={(v) => {
                            setLookupSourceType(v);
                            setLookupTable(null);
                            setSelectedCrmObject(null);
                            setLookupColumns([]);
                            form.resetFields(['lookupTable', 'lookupMatchColumn', 'lookupReturnColumn', 'lookupDisplayColumn']);
                        }}
                    >
                        <Radio value="db">数据库</Radio>
                        <Radio value="crm">CRM 对象</Radio>
                    </Radio.Group>
                </div>

                {lookupSourceType === 'db' ? (
                    <>
                        <div className="mb-4">
                            <div className="mb-2 text-gray-500 text-xs">切换数据库 (可选)</div>
                            <Select
                                placeholder="与当前数据库相同"
                                allowClear
                                onChange={(val) => {
                                    setLookupConnectionId(val);
                                    setLookupTable(null); // Reset table selection
                                    setLookupColumns([]);
                                    form.setFieldValue('lookupTable', null);
                                }}
                                value={lookupConnectionId || undefined}
                            >
                                {(savedConnections || []).map(c => (
                                    <Option key={c.id} value={c.id}>{c.name} ({c.config.database})</Option>
                                ))}
                            </Select>
                        </div>
                        <FormItem label="查找表" field="lookupTable" rules={[{ required: true }]}>
                            <Select placeholder="选择表" onChange={setLookupTable} loading={fetchingTables}>
                                {availableTables.map((t: string) => <Option key={t} value={t}>{t}</Option>)}
                            </Select>
                        </FormItem>
                    </>
                ) : (
                    <FormItem label="CRM 对象" required>
                        <Select
                            placeholder="选择 CRM 对象"
                            loading={fetchingCrmObjects}
                            value={selectedCrmObject || undefined}
                            onChange={setSelectedCrmObject}
                            showSearch
                            filterOption={(inputValue, option: any) => {
                                // Filter by label (children) or value
                                const label = option.props.children;
                                if (typeof label === 'string') {
                                    return label.toLowerCase().indexOf(inputValue.toLowerCase()) >= 0;
                                }
                                return false;
                            }}
                        >
                            {crmObjects.map(obj => (
                                <Option key={obj.api_name} value={obj.api_name}>
                                    {obj.display_name} ({obj.api_name})
                                </Option>
                            ))}
                        </Select>
                        {!activeProfile && <div className="text-red-500 text-xs mt-1">未检测到 CRM 登录信息，请先在配置中登录。</div>}
                    </FormItem>
                )}

                <div className="grid grid-cols-2 gap-4">
                    <FormItem label="查找匹配列" field="lookupMatchColumn" rules={[{ required: true }]}>
                        <Select placeholder="例如: Name" loading={fetchingColumns} showSearch>
                            {lookupColumns.map(c => <Option key={c} value={c}>{c}</Option>)}
                        </Select>
                    </FormItem>
                    <FormItem label="需取回的列" field="lookupReturnColumn" rules={[{ required: true }]}>
                        <Select placeholder="例如: ID" loading={fetchingColumns} showSearch>
                            {lookupColumns.map(c => <Option key={c} value={c}>{c}</Option>)}
                        </Select>
                    </FormItem>
                    <FormItem label="辅助显示列" field="lookupDisplayColumn" className="col-span-2">
                        <Select placeholder="例如: Created Date" loading={fetchingColumns} allowClear showSearch>
                            {lookupColumns.map(c => <Option key={c} value={c}>{c}</Option>)}
                        </Select>
                    </FormItem>
                </div>
            </div>
        </Form>
    );

    // Render Step 2
    const renderResolution = () => {
        let data = Object.keys(candidatesMap).map(val => {
            const candidates = candidatesMap[val];
            const status = candidates.length === 0 ? 'none' : (candidates.length === 1 ? 'unique' : 'multiple');
            return {
                key: val,
                val,
                candidates,
                status
            };
        });

        const total = data.length;
        const unique = data.filter(d => d.status === 'unique').length;
        const multiple = data.filter(d => d.status === 'multiple').length;
        const unresolved = data.filter(d => d.status === 'multiple' && !resolutions[d.val]).length;

        if (filterMultipleOnly) {
            data = data.filter(d => d.status === 'multiple');
        }

        const columns = [
            { title: '原值', dataIndex: 'val', width: 150 },
            {
                title: '匹配状态',
                dataIndex: 'status',
                width: 100,
                render: (status: string) => {
                    if (status === 'unique') return <Tag color="green">唯一匹配</Tag>;
                    if (status === 'multiple') return <Tag color="orange">多重匹配</Tag>;
                    return <Tag color="red">无匹配</Tag>;
                }
            },
            {
                title: '选择目标值',
                dataIndex: 'selection',
                render: (_: any, record: any) => {
                    const { candidates, status } = record;
                    const lookupReturnCol = config?.lookupReturnColumn;
                    const lookupDisplayCol = config?.lookupDisplayColumn;

                    if (status === 'none') return <span className="text-gray-400">跳过</span>;

                    // If unique, show text
                    // If multiple, show Select
                    return (
                        <Select
                            style={{ width: '100%' }}
                            value={resolutions[record.val] ? JSON.stringify(resolutions[record.val]) : undefined}
                            onChange={(v) => handleResolutionChange(record.val, JSON.parse(v))}
                            placeholder="选择匹配项..."
                            error={!resolutions[record.val]}
                        >
                            {candidates.map((c: any, idx: number) => (
                                <Option key={idx} value={JSON.stringify(c)}>
                                    {c[lookupReturnCol]} {lookupDisplayCol ? `(${c[lookupDisplayCol]})` : ''}
                                </Option>
                            ))}
                        </Select>
                    )
                }
            }
        ];

        return (
            <div>
                <div className="flex justify-between items-center mb-4 p-2 bg-[var(--color-fill-2)] rounded">
                    <div className="flex space-x-4">
                        <Statistic title="总数" value={total} groupSeparator style={{ marginRight: 20, fontSize: 16 }} />
                        <Statistic title="唯一匹配" value={unique} groupSeparator style={{ marginRight: 20, fontSize: 16, color: '#00b42a' }} />
                        <Statistic title="多重匹配" value={multiple} groupSeparator style={{ marginRight: 20, fontSize: 16, color: '#ff7d00' }} />
                        <Statistic title="未解决" value={unresolved} groupSeparator style={{ fontSize: 16, color: '#f53f3f' }} />
                    </div>
                    <div className="flex items-center">
                        <span className="mr-2">只显示多重匹配</span>
                        <Switch checked={filterMultipleOnly} onChange={setFilterMultipleOnly} />
                    </div>
                </div>
                <div className="h-80 overflow-auto">
                    <Table
                        columns={columns}
                        data={data}
                        pagination={false}
                        scroll={{ y: 350 }}
                    />
                </div>
            </div>
        );
    }

    return (
        <Modal
            title="关联数据 (VLOOKUP)"
            visible={visible}
            onCancel={onCancel}
            style={{ width: 800 }}
            footer={
                <div>
                    <Button onClick={onCancel}>取消</Button>
                    {step === 1 && (
                        <Button type="primary" onClick={handleAnalyze} loading={loading}>
                            下一步: 分析匹配
                        </Button>
                    )}
                    {step === 2 && (
                        <Button type="primary" onClick={handleExecuteUpdate} loading={loading}>
                            执行更新
                        </Button>
                    )}
                </div>
            }
        >
            <Steps current={step} className="mb-6">
                <Step title="配置关联" description="选择列和表" />
                <Step title="解决冲突" description="处理多重匹配" />
            </Steps>

            <div className="mt-4">
                {step === 1 ? renderConfig() : renderResolution()}
            </div>
        </Modal>
    );
}
