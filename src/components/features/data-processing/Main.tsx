"use client"

import React, { useState, useEffect } from 'react';
import { Layout, Message, Card, Empty, Spin, Button } from '@arco-design/web-react';
import { ConnectionManager } from './ConnectionManager';
import { TableExplorer } from './TableExplorer';
import { DataGrid } from './DataGrid';
import { CreateTableModal } from './CreateTableModal';
import { IconImport } from '@arco-design/web-react/icon';

const { Sider, Content } = Layout;

export function DataProcessor() {
    const [connection, setConnection] = useState<any>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [tables, setTables] = useState<string[]>([]);
    const [selectedTable, setSelectedTable] = useState<string | null>(null);
    const [isLoadingTables, setIsLoadingTables] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);

    const handleTableCreated = (newTableName: string) => {
        if (connection) {
            handleConnect(connection).then(() => {
                setSelectedTable(newTableName);
            });
        }
    };

    const handleConnect = async (config: any) => {
        setIsLoadingTables(true);
        try {
            const response = await fetch('/data/api/db/tables', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config)
            });
            const result = await response.json();

            if (result.success && Array.isArray(result.tables)) {
                setTables(result.tables);
                setConnection(config);
                setIsConnected(true);
                Message.success(`连接成功! 找到 ${result.tables.length} 张表.`);
            } else {
                Message.error(result.error || "获取表列表失败");
            }
        } catch (e: any) {
            Message.error("连接失败: " + e.message);
        } finally {
            setIsLoadingTables(false);
        }
    };

    const handleDisconnect = () => {
        setConnection(null);
        setIsConnected(false);
        setTables([]);
        setSelectedTable(null);
    };

    return (
        <Layout className="min-h-screen bg-[var(--color-bg-1)] p-2 sm:p-4 h-screen box-border">
            <Content className="w-full bg-[var(--color-bg-2)] rounded-sm shadow-sm overflow-hidden flex flex-col flex-1 h-full relative">
                {!isConnected ? (
                    <div className="flex flex-col items-center justify-center h-full bg-[var(--color-fill-2)]">
                        <div className="w-full max-w-4xl px-4">
                            <div className="mb-8 text-center text-[var(--color-text-3)]">
                                <h1 className="text-2xl font-bold text-[var(--color-text-1)] mb-2">数据处理中心</h1>
                                <p>请配置数据库连接以开始管理数据</p>
                            </div>
                            <Card className="shadow-lg border-t-4 border-blue-600">
                                <ConnectionManager onConnect={handleConnect} />
                            </Card>
                        </div>
                    </div>
                ) : (
                    <Layout className="h-full absolute inset-0">
                        <Sider
                            width={280}
                            className="h-full border-r border-[var(--color-border-2)] bg-[var(--color-fill-2)] flex flex-col"
                            resizeDirections={['right']}
                        >
                            <div className="p-4 border-b border-[var(--color-border-2)] bg-[var(--color-bg-2)] flex-shrink-0">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="font-bold text-[var(--color-text-1)] text-lg">数据库</span>
                                    <div className="flex gap-1">
                                        <Button
                                            type="text"
                                            size="mini"
                                            icon={<IconImport />}
                                            onClick={() => setShowCreateModal(true)}
                                            title="导入文件新建表"
                                        />
                                        <Button
                                            type="secondary"
                                            size="mini"
                                            status="danger"
                                            onClick={handleDisconnect}
                                        >
                                            断开
                                        </Button>
                                    </div>
                                </div>
                                <div className="text-xs text-[var(--color-text-3)] truncate bg-[var(--color-fill-3)] p-2 rounded">
                                    {connection?.user}@{connection?.host}:{connection?.port}/{connection?.database}
                                </div>
                            </div>
                            <div className="flex-1 overflow-y-auto">
                                {isLoadingTables ? (
                                    <div className="flex justify-center py-10"><Spin /></div>
                                ) : (
                                    <TableExplorer
                                        tables={tables}
                                        selectedTable={selectedTable}
                                        onSelect={setSelectedTable}
                                    />
                                )}
                            </div>
                        </Sider>
                        <Content className="h-full flex flex-col bg-[var(--color-bg-2)] overflow-hidden flex-1 relative">
                            {selectedTable ? (
                                <DataGrid
                                    connection={connection}
                                    tableName={selectedTable}
                                    allTables={tables}
                                />
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full text-[var(--color-text-3)]">
                                    <Empty description="请从左侧选择一张表" />
                                </div>
                            )}
                        </Content>
                    </Layout>
                )}

                {connection && (
                    <CreateTableModal
                        visible={showCreateModal}
                        onCancel={() => setShowCreateModal(false)}
                        onSuccess={handleTableCreated}
                        connection={connection}
                    />
                )}
            </Content>
        </Layout>
    );
}
