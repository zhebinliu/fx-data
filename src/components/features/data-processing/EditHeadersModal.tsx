import React, { useState, useEffect } from 'react';
import { Modal, Table, Input, Select, Button, Message, Space } from '@arco-design/web-react';
import { IconEdit, IconSave } from '@arco-design/web-react/icon';

interface EditHeadersModalProps {
    visible: boolean;
    onCancel: () => void;
    onSuccess: () => void;
    connection: any;
    tableName: string;
    columns: SimpleColumn[];
}

export interface SimpleColumn {
    name: string;
    type: string;
}

export function EditHeadersModal({ visible, onCancel, onSuccess, connection, tableName, columns }: EditHeadersModalProps) {
    const [localColumns, setLocalColumns] = useState<SimpleColumn[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (visible) {
            setLocalColumns(JSON.parse(JSON.stringify(columns)));
        }
    }, [visible, columns]);

    const handleSave = async (record: SimpleColumn, field: 'name' | 'type', value: string) => {
        // Optimistically update local state for UI responsiveness
        // But actual DB update is triggered separately per row usually or batch?
        // Let's implement row-by-row save for simplicity and safety (ALTER TABLE is heavy).
        // Or maybe just "Edit" -> "Save" button per row.

        // This function executes the ALTER TABLE immediately.

        const originalCol = columns.find(c => c.name === record.name); // Find by original name logic is tricky if renamed. 
        // We should track 'originalName' in local state.
    };

    // Better approach: 
    // Just editable table. Actions column has "Save" button.

    const [editingKey, setEditingKey] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<{ name: string, type: string }>({ name: '', type: '' });

    const startEdit = (col: SimpleColumn) => {
        setEditingKey(col.name);
        setEditForm({ name: col.name, type: col.type });
    };

    const cancelEdit = () => {
        setEditingKey(null);
    };

    const saveEdit = async (originalName: string) => {
        setLoading(true);
        try {
            // Check if name changed
            if (editForm.name !== originalName) {
                const res = await fetch('/data/api/db/alter-table', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        ...connection,
                        table: tableName,
                        action: 'RENAME_COLUMN',
                        params: {
                            oldName: originalName,
                            newName: editForm.name,
                            dataType: editForm.type // Required for MySQL CHANGE
                        }
                    })
                });
                const result = await res.json();
                if (!result.success) throw new Error(result.error);
            }

            // Check if type changed (only if name save succeeded or name didn't change)
            // Note: If name changed, we are now Modify Column on NEW name.
            const targetName = editForm.name !== originalName ? editForm.name : originalName;

            // Only if type requested change AND type is different?
            // Actually RENAME in MySQL with CHANGE COLUMN *requires* type restatement, so it effectively sets type too.
            // Postgres RENAME does NOT change type.
            // So logic varies. 
            // Simple logic:
            // 1. If Name changed -> Call RENAME (MySQL CHANGE handles type too). 
            // 2. If Type changed (and not handled by 1) -> Call MODIFY.

            if (editForm.type !== columns.find(c => c.name === originalName)?.type) {
                // If MySQL and name changed, we already updated type in RENAME/CHANGE call above.
                // If Postgres, RENAME only renamed. We still need to ALTER TYPE.
                // If name didn't change, we definitely need MODIFY.

                const dbType = connection.type;
                const needsModify = (dbType === 'postgres') || (dbType === 'mysql' && editForm.name === originalName);

                if (needsModify) {
                    const res = await fetch('/data/api/db/alter-table', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            ...connection,
                            table: tableName,
                            action: 'MODIFY_COLUMN',
                            params: {
                                columnName: targetName,
                                newType: editForm.type
                            }
                        })
                    });
                    const result = await res.json();
                    if (!result.success) throw new Error(result.error);
                }
            }

            Message.success("Column updated");
            setEditingKey(null);
            onSuccess(); // Refresh parent to get fresh schema

        } catch (e: any) {
            Message.error("Update failed: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    const tableCols = [
        {
            title: 'Column Name',
            dataIndex: 'name',
            render: (val: string, record: SimpleColumn) => {
                if (editingKey === record.name) {
                    return <Input value={editForm.name} onChange={v => setEditForm({ ...editForm, name: v })} />;
                }
                return val;
            }
        },
        {
            title: 'Data Type',
            dataIndex: 'type',
            render: (val: string, record: SimpleColumn) => {
                if (editingKey === record.name) {
                    // Simple select for common types, or input for free text
                    return <Input value={editForm.type} onChange={v => setEditForm({ ...editForm, type: v })} />;
                }
                return val;
            }
        },
        {
            title: 'Action',
            width: 150,
            render: (_: any, record: SimpleColumn) => {
                if (editingKey === record.name) {
                    return (
                        <Space>
                            <Button size="mini" type="primary" onClick={() => saveEdit(record.name)} loading={loading}>Save</Button>
                            <Button size="mini" onClick={cancelEdit}>Cancel</Button>
                        </Space>
                    );
                }
                return (
                    <Button size="mini" icon={<IconEdit />} onClick={() => startEdit(record)}>Edit</Button>
                );
            }
        }
    ];

    return (
        <Modal
            title="编辑表头 (Edit Table Schema)"
            visible={visible}
            onCancel={onCancel}
            footer={null}
            style={{ width: 700 }}
        >
            <div className="mb-4 text-orange-600 text-xs">
                注意: 修改列名或类型是高风险操作，请谨慎进行。 (ALTER TABLE)
            </div>
            <Table
                columns={tableCols}
                data={localColumns}
                rowKey="name"
                pagination={false}
                scroll={{ y: 400 }}
            />
        </Modal>
    );
}
