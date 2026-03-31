import React, { useEffect, useState, useMemo } from 'react';
import { Table, Button, Space, Message, Popconfirm, Typography, Empty, PaginationProps, Input, InputNumber, Divider, Collapse } from '@arco-design/web-react';
import { IconRefresh, IconPlus, IconDelete, IconEdit, IconSwap, IconThunderbolt, IconSave, IconFilter } from '@arco-design/web-react/icon';
import { DataEditor } from './DataEditor';
import { VLookupModal } from './VLookupModal';
import { BatchOperationsModal } from './BatchOperationsModal';
import { EditHeadersModal } from './EditHeadersModal';

interface DataGridProps {
    connection: any;
    tableName: string;
    allTables: string[];
}

export function DataGrid({ connection, tableName, allTables }: DataGridProps) {
    const [data, setData] = useState<any[]>([]);
    const [originalData, setOriginalData] = useState<any[]>([]);

    // Store just the field names/metadata
    // Store field metadata { name: string, type: string }
    const [rawColumns, setRawColumns] = useState<any[]>([]);

    const [loading, setLoading] = useState(false);
    const [pagination, setPagination] = useState<PaginationProps>({
        sizeCanChange: true,
        showTotal: true,
        total: 0,
        pageSize: 10,
        current: 1,
        sizeOptions: [10, 20, 50, 100]
    });

    // Selection & Editing State
    const [selectedRowKeys, setSelectedRowKeys] = useState<any[]>([]);
    const [modifiedRows, setModifiedRows] = useState<Record<string, any>>({}); // Keyed by row key/ID
    const [saving, setSaving] = useState(false);

    // Editor State
    const [editorVisible, setEditorVisible] = useState(false);
    const [editingRow, setEditingRow] = useState<any>(null);

    // VLookup State
    const [vlookupVisible, setVlookupVisible] = useState(false);

    // Batch Ops State
    const [batchVisible, setBatchVisible] = useState(false);

    // SQL Filter State
    const [whereClause, setWhereClause] = useState('');
    const [showFilter, setShowFilter] = useState(false);

    // Edit Headers State
    const [editHeadersVisible, setEditHeadersVisible] = useState(false);

    const getPrimaryKey = (record: any) => {
        if (!record) return 'id';
        return Object.keys(record).find(k => k.toLowerCase() === 'id' || k.toLowerCase() === '_id') || 'id';
    };

    const fetchData = async (page = 1, pageSize = 10) => {
        setLoading(true);
        setModifiedRows({});
        setSelectedRowKeys([]);

        try {
            const response = await fetch('/api/db/query', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...connection,
                    table: tableName,
                    limit: pageSize,
                    offset: (page - 1) * pageSize,
                    where: whereClause // Pass filter
                })
            });
            const result = await response.json();

            if (result.success) {
                // If columns metadata is available (from updated API), use it
                if (result.columns && Array.isArray(result.columns)) {
                    setRawColumns(result.columns);
                } else if (result.data.length > 0) {
                    // Fallback to keys if columns meta not present
                    const keys = Object.keys(result.data[0]);
                    setRawColumns(keys.map(k => ({ name: k, type: 'unknown' })));
                } else {
                    setRawColumns([]);
                }

                const dataWithKeys = result.data.map((item: any, index: number) => ({ ...item, key: index.toString() }));
                setData(dataWithKeys);
                setOriginalData(JSON.parse(JSON.stringify(dataWithKeys))); // Deep copy for ref

                setPagination(prev => ({
                    ...prev,
                    current: page,
                    pageSize: pageSize,
                    total: result.totalCount
                }));
            } else {
                if (result.totalCount === 0) {
                    setData([]);
                    setRawColumns([]);
                }
                Message.error(result.error || '查询失败');
            }
        } catch (e: any) {
            Message.error("网络错误: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (tableName && connection) {
            fetchData(1, pagination.pageSize);
        }
    }, [tableName, connection]);

    const handleTableChange = (p: PaginationProps) => fetchData(p.current, p.pageSize);

    // Inline Editing Logic
    const handleInlineChange = (rowKey: string, col: string, value: any) => {
        setModifiedRows(prev => ({
            ...prev,
            [rowKey]: {
                ...prev[rowKey],
                [col]: value
            }
        }));
    };

    // Memoized columns ensuring latest state access
    const tableColumns = useMemo(() => {
        if (rawColumns.length === 0) return [];

        const cols = rawColumns.map(col => ({
            title: (
                <div className="flex flex-col">
                    <span>{col.name}</span>
                    <span className="text-[var(--color-text-3)] text-xs font-normal" style={{ fontSize: '10px' }}>
                        {col.type || ''}
                    </span>
                </div>
            ),
            dataIndex: col.name,
            ellipsis: true,
            width: 150,
            render: (text: any, record: any) => {
                const uniqueKey = record.key;
                const colName = col.name;

                // Check if modified
                const isModified = modifiedRows[uniqueKey] && modifiedRows[uniqueKey].hasOwnProperty(colName);
                const value = isModified ? modifiedRows[uniqueKey][colName] : text;

                return (
                    <Input
                        value={value}
                        onChange={(v) => handleInlineChange(uniqueKey, colName, v)}
                        style={isModified ? { borderColor: 'var(--color-warning-6)', backgroundColor: 'var(--color-warning-light-1)', color: 'var(--color-text-1)' } : { border: 'none', background: 'transparent' }}
                        className={isModified ? "" : "hover:border-[var(--color-border-3)] hover:bg-[var(--color-fill-2)] focus:bg-[var(--color-bg-1)]"}
                    />
                );
            }
        }));

        cols.push({
            title: '操作',
            dataIndex: 'op',
            fixed: 'right',
            width: 100,
            render: (text: any, record: any) => (
                <Space>
                    <Button
                        type="text"
                        size="small"
                        icon={<IconEdit />}
                        onClick={() => handleEdit(record)}
                    />
                </Space>
            ),
        } as any);

        return cols;
    }, [rawColumns, modifiedRows]);

    const handleBatchSave = async () => {
        const keysToUpdate = Object.keys(modifiedRows);
        if (keysToUpdate.length === 0) return;

        setSaving(true);
        try {
            const operations = keysToUpdate.map(key => {
                const row = data.find(r => r.key === key);
                const updates = modifiedRows[key];
                const pk = getPrimaryKey(row);
                return {
                    table: tableName,
                    updates: updates,
                    criteria: { [pk]: row[pk] }
                };
            });

            const res = await fetch('/api/db/batch-update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ids: selectedRowKeys,
                    ...connection,
                    operations
                })
            });
            const result = await res.json();
            if (result.success) {
                Message.success("Changes saved successfully");
                fetchData(pagination.current, pagination.pageSize);
            } else {
                Message.error("Save failed: " + result.error);
            }

        } catch (e: any) {
            Message.error("Save failed: " + e.message);
        } finally {
            setSaving(false);
        }
    };

    const handleBatchDelete = async () => {
        if (selectedRowKeys.length === 0) return;

        try {
            const idsToDelete = selectedRowKeys.map(key => {
                const row = data.find(r => r.key === key);
                const pk = getPrimaryKey(row);
                return row[pk];
            });

            const firstRow = data.find(r => r.key === selectedRowKeys[0]);
            const pkField = getPrimaryKey(firstRow);

            const res = await fetch('/api/db/batch-delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...connection,
                    table: tableName,
                    ids: idsToDelete,
                    primaryKey: pkField
                })
            });
            const result = await res.json();
            if (result.success) {
                Message.success(`Deleted ${result.affectedRows} rows`);
                fetchData(pagination.current, pagination.pageSize);
            } else {
                Message.error("Delete failed: " + result.error);
            }

        } catch (e: any) {
            Message.error("Delete failed: " + e.message);
        }
    };

    const handleEdit = (record: any) => {
        setEditingRow(record);
        setEditorVisible(true);
    };

    // Re-use logic for row action delete if needed in future, currently not exposed in new columns
    const handleDelete = (record: any) => { };

    return (
        <div className="flex flex-col h-full bg-[var(--color-bg-2)]">
            {/* Toolbar */}
            <div className="p-4 border-b border-[var(--color-border-2)] flex justify-between items-center bg-[var(--color-bg-2)] sticky top-0 z-10">
                <Space>
                    <Typography.Title heading={5} style={{ margin: 0 }}>
                        {tableName}
                    </Typography.Title>
                    <Typography.Text type="secondary" className="text-xs">
                        (共 {pagination.total} 条)
                    </Typography.Text>
                    {Object.keys(modifiedRows).length > 0 && (
                        <Button type="primary" status="warning" icon={<IconSave />} onClick={handleBatchSave} loading={saving}>
                            保存修改 ({Object.keys(modifiedRows).length})
                        </Button>
                    )}
                    {selectedRowKeys.length > 0 && (
                        <Popconfirm title={`确定删除选中的 ${selectedRowKeys.length} 行?`} onOk={handleBatchDelete}>
                            <Button type="primary" status="danger" icon={<IconDelete />}>
                                删除选中 ({selectedRowKeys.length})
                            </Button>
                        </Popconfirm>
                    )}
                </Space>
                <div className="flex-1 mx-4">
                    {/* Placeholder for center area if needed */}
                </div>
                <Space>
                    <Button
                        type={showFilter ? 'primary' : 'secondary'}
                        size="small"
                        icon={<IconFilter />}
                        onClick={() => setShowFilter(!showFilter)}
                    >
                        筛选
                    </Button>
                    <Divider type="vertical" />
                    <Button
                        type="primary"
                        size="small"
                        icon={<IconThunderbolt />}
                        onClick={() => setBatchVisible(true)}
                    >
                        批量处理
                        {selectedRowKeys.length > 0 ? ` (${selectedRowKeys.length} 选定)` : ''}
                    </Button>
                    <Divider type="vertical" />
                    <Button
                        size="small"
                        icon={<IconEdit />}
                        onClick={() => setEditHeadersVisible(true)}
                        title="编辑表头"
                    >
                        编辑表头
                    </Button>
                    <Button
                        size="small"
                        icon={<IconPlus />}
                        onClick={() => {
                            setEditingRow(null);
                            setEditorVisible(true);
                        }}
                    >
                        添加
                    </Button>
                    <Button
                        size="small"
                        icon={<IconSwap />}
                        onClick={() => setVlookupVisible(true)}
                    >
                        VLOOKUP
                    </Button>
                    <Button
                        size="small"
                        icon={<IconRefresh />}
                        onClick={() => fetchData(pagination.current, pagination.pageSize)}
                    />
                </Space>
            </div>

            {showFilter && (
                <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
                    <span className="font-bold text-gray-500">SQL WHERE:</span>
                    <Input
                        style={{ width: 400 }}
                        placeholder="e.g. id > 100 AND status = 'active'"
                        value={whereClause}
                        onChange={v => setWhereClause(v)}
                        onPressEnter={() => fetchData(1, pagination.pageSize)}
                    />
                    <Button type="primary" size="small" onClick={() => fetchData(1, pagination.pageSize)}>
                        应用筛选
                    </Button>
                    <Button size="small" onClick={() => { setWhereClause(''); fetchData(1, pagination.pageSize); }}>
                        重置
                    </Button>
                </div>
            )}

            {/* Table Area */}
            <div className="flex-1 overflow-hidden p-4">
                <Table
                    columns={tableColumns}
                    data={data}
                    pagination={pagination}
                    loading={loading}
                    onChange={handleTableChange}
                    scroll={{ x: true, y: 'calc(100vh - 200px)' }}
                    border
                    stripe
                    rowKey="key"
                    rowSelection={{
                        selectedRowKeys,
                        onChange: (keys, selected) => setSelectedRowKeys(keys)
                    }}
                    noDataElement={<Empty description="暂无数据" />}
                />
            </div>

            <DataEditor
                visible={editorVisible}
                onCancel={() => setEditorVisible(false)}
                onSuccess={() => fetchData(pagination.current, pagination.pageSize)}
                connection={connection}
                tableName={tableName}
                columns={rawColumns.map(c => ({ title: c.name, dataIndex: c.name }))}
                initialData={editingRow}
            />

            <VLookupModal
                visible={vlookupVisible}
                onCancel={() => setVlookupVisible(false)}
                onSuccess={() => fetchData(pagination.current, pagination.pageSize)}
                connection={connection}
                tableName={tableName}
                currentColumns={rawColumns.map(c => c.name)}
                allTables={allTables}
            />

            <BatchOperationsModal
                visible={batchVisible}
                onCancel={() => setBatchVisible(false)}
                onSuccess={() => fetchData(pagination.current, pagination.pageSize)}
                connection={connection}
                tableName={tableName}
                columns={rawColumns.map(c => c.name)}
                selectedIds={
                    selectedRowKeys.map(k => {
                        const r = data.find(d => d.key === k);
                        const pk = getPrimaryKey(r);
                        return r[pk];
                    })
                }
                primaryKey={data.length > 0 ? getPrimaryKey(data[0]) : 'id'}
            />

            <EditHeadersModal
                visible={editHeadersVisible}
                onCancel={() => setEditHeadersVisible(false)}
                onSuccess={() => fetchData(pagination.current, pagination.pageSize)}
                connection={connection}
                tableName={tableName}
                columns={rawColumns}
            />
        </div>
    );
}
