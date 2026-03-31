import React, { useState, useEffect } from 'react';
import { Select, Typography, Spin, Empty, Message, Form } from '@arco-design/web-react';

const Option = Select.Option;
const { Title } = Typography;

interface SourceStepConfigProps {
    config: any;
    onChange: (newConfig: any) => void;
}

export function SourceStepConfig({ config, onChange }: SourceStepConfigProps) {
    const [connections, setConnections] = useState<any[]>([]);
    const [tables, setTables] = useState<string[]>([]);
    const [loadingConnections, setLoadingConnections] = useState(false);
    const [loadingTables, setLoadingTables] = useState(false);

    useEffect(() => {
        fetchConnections();
    }, []);

    useEffect(() => {
        if (config.connectionId) {
            fetchTables(config.connectionId);
        } else {
            setTables([]);
        }
    }, [config.connectionId]);

    const fetchConnections = async () => {
        try {
            setLoadingConnections(true);
            const res = await fetch('/api/config/db-connections');
            const data = await res.json();
            if (data.success) {
                setConnections(data.connections || []);
            }
        } catch (e) {
            Message.error("加载连接失败");
        } finally {
            setLoadingConnections(false);
        }
    };

    const fetchTables = async (connectionId: string) => {
        const connection = connections.find(c => c.id === connectionId);
        if (!connection) return;

        try {
            setLoadingTables(true);
            const res = await fetch('/api/db/tables', {
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
            Message.error("加载数据表失败");
        } finally {
            setLoadingTables(false);
        }
    };

    return (
        <div className="flex flex-col gap-4 max-w-lg">
            <div>
                <div className="mb-2 font-bold text-[var(--color-text-1)]">数据库连接</div>
                <Select
                    placeholder="选择已保存的连接"
                    loading={loadingConnections}
                    value={config.connectionId}
                    onChange={(val) => onChange({ ...config, connectionId: val, table: undefined })} // Reset table on connection change
                >
                    {connections.map(c => (
                        <Option key={c.id} value={c.id}>
                            {c.name || `${c.user}@${c.host}/${c.database}`} ({c.type})
                        </Option>
                    ))}
                </Select>
                {connections.length === 0 && !loadingConnections && (
                    <div className="text-xs text-[var(--color-text-3)] mt-1">未找到连接，请先在数据处理器中创建。</div>
                )}
            </div>

            {config.connectionId && (
                <div>
                    <div className="mb-2 font-bold text-[var(--color-text-1)]">数据表</div>
                    <Select
                        placeholder="选择数据表"
                        loading={loadingTables}
                        value={config.table}
                        onChange={(val) => onChange({ ...config, table: val })}
                        showSearch
                        filterOption={(inputValue, option) =>
                            (((option as any)?.props?.children || "") as string).toLowerCase().indexOf(inputValue.toLowerCase()) >= 0
                        }
                    >
                        {tables.map(t => (
                            <Option key={t} value={t}>{t}</Option>
                        ))}
                    </Select>
                    {tables.length === 0 && !loadingTables && (
                        <div className="text-xs text-[var(--color-text-3)] mt-1">未找到数据表。</div>
                    )}
                </div>
            )}

            <div className="mt-4 p-3 bg-[var(--color-primary-light-1)] text-[var(--color-primary-6)] text-xs rounded">
                此步骤将从选定的表中加载所有数据到工作流环境中。
            </div>
        </div>
    );
}
