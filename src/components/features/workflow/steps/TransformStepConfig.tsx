import React, { useState, useEffect } from 'react';
import { Select, Input, Radio, Form, Typography, InputNumber } from '@arco-design/web-react';

const Option = Select.Option;
const { Title } = Typography;
const FormItem = Form.Item;

interface TransformStepConfigProps {
    config: any;
    onChange: (newConfig: any) => void;
}

export function TransformStepConfig({ config, onChange }: TransformStepConfigProps) {
    const operationType = config.operationType || 'BATCH_UPDATE';

    const handleUpdate = (key: string, value: any) => {
        onChange({ ...config, [key]: value });
    };

    // State for VLookup options
    const [connections, setConnections] = useState<any[]>([]);
    const [tables, setTables] = useState<string[]>([]);
    const [loadingConnections, setLoadingConnections] = useState(false);
    const [loadingTables, setLoadingTables] = useState(false);

    useEffect(() => {
        if (operationType === 'VLOOKUP_AUTO') {
            fetchConnections();
        }
    }, [operationType]);

    useEffect(() => {
        if (config.lookupConnectionId && connections.length > 0) {
            fetchTables(config.lookupConnectionId);
        } else {
            setTables([]);
        }
    }, [config.lookupConnectionId, connections]);

    const fetchConnections = async () => {
        try {
            setLoadingConnections(true);
            const res = await fetch('/data/api/config/db-connections');
            const data = await res.json();
            if (data.success) {
                setConnections(data.connections || []);
            }
        } catch (e) {
            // Message.error("Failed to load connections");
        } finally {
            setLoadingConnections(false);
        }
    };

    const fetchTables = async (connectionId: string) => {
        const connection = connections.find(c => c.id === connectionId);
        if (!connection) return;

        try {
            setLoadingTables(true);
            const res = await fetch('/data/api/db/tables', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(connection)
            });
            const data = await res.json();
            if (data.success) {
                setTables(data.tables || []);
            } else {
                setTables([]);
            }
        } catch (e) {
            // Message.error("Failed to load tables");
        } finally {
            setLoadingTables(false);
        }
    };

    return (
        <div className="flex flex-col gap-4 max-w-lg">
            <div>
                <div className="mb-2 font-bold text-[var(--color-text-1)]">转换类型</div>
                <Select
                    value={operationType}
                    onChange={(val) => handleUpdate('operationType', val)}
                >
                    <Option value="BATCH_UPDATE">批量操作 (更新列)</Option>
                    <Option value="VLOOKUP_AUTO">VLookup (自动匹配)</Option>
                </Select>
            </div>

            {operationType === 'BATCH_UPDATE' && (
                <div className="border border-[var(--color-border-2)] p-4 rounded bg-[var(--color-fill-2)] flex flex-col gap-4">
                    <div>
                        <div className="mb-2 font-bold text-[var(--color-text-1)]">目标列名</div>
                        <Input
                            placeholder="例如：status"
                            value={config.targetColumn}
                            onChange={(val) => handleUpdate('targetColumn', val)}
                        />
                        <div className="text-[var(--color-text-3)] text-xs mt-1">输入要更新的列的确切名称。</div>
                    </div>

                    <div>
                        <div className="mb-2 font-bold text-[var(--color-text-1)]">操作类型</div>
                        <Select
                            placeholder="选择操作"
                            value={config.batchOpType}
                            onChange={(val) => handleUpdate('batchOpType', val)}
                        >
                            <Option value="SET_VALUE">设置固定值</Option>
                            <Option value="NUMERIC_OP">数值计算</Option>
                            <Option value="STRING_OP">字符串处理</Option>
                        </Select>
                    </div>

                    {config.batchOpType === 'SET_VALUE' && (
                        <div>
                            <div className="mb-2 font-bold text-[var(--color-text-1)]">值</div>
                            <Input
                                placeholder="输入值..."
                                value={config.value}
                                onChange={(val) => handleUpdate('value', val)}
                            />
                        </div>
                    )}

                    {config.batchOpType === 'NUMERIC_OP' && (
                        <div className="flex gap-2">
                            <div className="flex-1">
                                <div className="mb-2 font-bold text-[var(--color-text-1)]">运算符</div>
                                <Select
                                    value={config.numericOperator}
                                    onChange={(val) => handleUpdate('numericOperator', val)}
                                >
                                    <Option value="ADD">加 (+)</Option>
                                    <Option value="SUBTRACT">减 (-)</Option>
                                    <Option value="MULTIPLY">乘 (*)</Option>
                                    <Option value="DIVIDE">除 (/)</Option>
                                </Select>
                            </div>
                            <div className="flex-1">
                                <div className="mb-2 font-bold text-[var(--color-text-1)]">操作数</div>
                                <InputNumber
                                    placeholder="数字"
                                    value={config.numericOperand}
                                    onChange={(val) => handleUpdate('numericOperand', val)}
                                />
                            </div>
                        </div>
                    )}

                    {config.batchOpType === 'STRING_OP' && (
                        <div>
                            <div className="mb-2 font-bold text-[var(--color-text-1)]">操作</div>
                            <Select
                                value={config.stringAction}
                                onChange={(val) => handleUpdate('stringAction', val)}
                            >
                                <Option value="UPPERCASE">转大写</Option>
                                <Option value="LOWERCASE">转小写</Option>
                                <Option value="TRIM">去除空格</Option>
                            </Select>
                        </div>
                    )}
                </div>
            )}

            {operationType === 'VLOOKUP_AUTO' && (
                <div className="border border-[var(--color-border-2)] p-4 rounded bg-[var(--color-fill-2)] flex flex-col gap-4">
                    <div className="bg-[var(--color-primary-light-1)] p-2 text-xs text-[var(--color-primary-6)] rounded mb-2">
                        VLookup 允许你从另一个表中查找数据并合并到当前流程中。
                    </div>

                    <div className="border-b border-[var(--color-border-2)] pb-4 mb-4">
                        <div className="mb-2 font-bold text-[var(--color-text-1)]">主数据源 (左侧)</div>
                        <Radio.Group
                            type="button"
                            value={config.leftInputMode || 'INHERIT'}
                            onChange={(val) => handleUpdate('leftInputMode', val)}
                            className="mb-3"
                        >
                            <Radio value="INHERIT">使用上一步结果</Radio>
                            <Radio value="NEW_SOURCE">选择新数据表</Radio>
                        </Radio.Group>

                        {config.leftInputMode === 'NEW_SOURCE' && (
                            <div className="bg-[var(--color-fill-3)] p-3 rounded border border-[var(--color-border-2)]">
                                <div className="mb-2 text-xs text-[var(--color-text-3)]">选择作为主表的数据库连接</div>
                                <Select
                                    placeholder="选择主数据库连接"
                                    loading={loadingConnections}
                                    value={config.leftConnectionId}
                                    onChange={(val) => handleUpdate('leftConnectionId', val)}
                                    className="mb-2"
                                >
                                    {connections.map(c => (
                                        <Option key={c.id} value={c.id}>
                                            {c.name || `${c.user}@${c.host}/${c.database}`} ({c.type})
                                        </Option>
                                    ))}
                                </Select>
                                {config.leftConnectionId && (
                                    <Select
                                        placeholder="选择主数据表"
                                        loading={loadingTables} // We should probably have separate loading/state for left table if we want perfection, but sharing for MVP is okay if sequence is managed
                                        value={config.leftTable}
                                        showSearch
                                        onChange={(val) => handleUpdate('leftTable', val)}
                                        onFocus={() => { if (config.leftConnectionId) fetchTables(config.leftConnectionId); }}
                                        filterOption={(inputValue, option) =>
                                            (((option as any)?.props?.children || "") as string).toLowerCase().indexOf(inputValue.toLowerCase()) >= 0
                                        }
                                    >
                                        {tables.map(t => (
                                            <Option key={t} value={t}>{t}</Option>
                                        ))}
                                    </Select>
                                )}
                            </div>
                        )}
                        {config.leftInputMode !== 'NEW_SOURCE' && (
                            <div className="text-[var(--color-text-3)] text-xs">
                                当前将使用前一个步骤的输出作为左侧匹配数据。
                            </div>
                        )}
                    </div>

                    <div>
                        <div className="mb-2 font-bold text-[var(--color-text-1)]">参考数据库 (右侧查找源)</div>
                        <Select
                            placeholder="选择作为字典的数据库连接"
                            loading={loadingConnections}
                            value={config.lookupConnectionId}
                            onChange={(val) => handleUpdate('lookupConnectionId', val)}
                        >
                            {connections.map(c => (
                                <Option key={c.id} value={c.id}>
                                    {c.name || `${c.user}@${c.host}/${c.database}`} ({c.type})
                                </Option>
                            ))}
                        </Select>
                        {config.lookupConnectionId && (
                            <Select
                                className="mt-2"
                                placeholder="选择数据表"
                                loading={loadingTables}
                                value={config.lookupTable}
                                showSearch
                                onChange={(val) => handleUpdate('lookupTable', val)}
                                filterOption={(inputValue, option) =>
                                    (((option as any)?.props?.children || "") as string).toLowerCase().indexOf(inputValue.toLowerCase()) >= 0
                                }
                            >
                                {tables.map(t => (
                                    <Option key={t} value={t}>{t}</Option>
                                ))}
                            </Select>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <div className="mb-2 font-bold text-[var(--color-text-1)]">当前流程匹配键</div>
                            <Input
                                placeholder="来自上一步的数据字段 (如 user_id)"
                                value={config.localKey}
                                onChange={(val) => handleUpdate('localKey', val)}
                            />
                            <div className="text-[var(--color-text-3)] text-xs mt-1">你的主数据流中的字段</div>
                        </div>
                        <div>
                            <div className="mb-2 font-bold text-[var(--color-text-1)]">查找表匹配键</div>
                            <Input
                                placeholder="数据库表中的字段 (如 id)"
                                value={config.lookupKey}
                                onChange={(val) => handleUpdate('lookupKey', val)}
                            />
                            <div className="text-[var(--color-text-3)] text-xs mt-1">外部数据库表中的字段</div>
                        </div>
                    </div>

                    <div>
                        <div className="mb-2 font-bold text-[var(--color-text-1)]">要获取的列</div>
                        <Input
                            placeholder="数据库表中的列名 (如 email)"
                            value={config.lookupReturnColumn}
                            onChange={(val) => handleUpdate('lookupReturnColumn', val)}
                        />
                    </div>

                    <div>
                        <div className="mb-2 font-bold text-[var(--color-text-1)]">保存到新列名</div>
                        <Input
                            placeholder="新列名称 (如 user_email)"
                            value={config.targetColumn}
                            onChange={(val) => handleUpdate('targetColumn', val)}
                        />
                        <div className="text-[var(--color-text-3)] text-xs mt-1">此列将被追加到当前数据流中</div>
                    </div>
                </div>
            )}
        </div>
    );
}
