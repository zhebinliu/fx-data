"use client"

import React, { useState, useEffect } from 'react';
import { Form, Input, Button, Select, Space, Typography, Divider, Message, Card, Popconfirm } from '@arco-design/web-react';
import { IconSettings, IconThunderbolt, IconSave, IconDelete } from '@arco-design/web-react/icon';

const FormItem = Form.Item;
const Option = Select.Option;

interface ConnectionManagerProps {
    onConnect: (config: any) => void;
}

export function ConnectionManager({ onConnect }: ConnectionManagerProps) {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [savedConnections, setSavedConnections] = useState<any[]>([]);
    const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);

    useEffect(() => {
        loadSavedConnections();
    }, []);

    const loadSavedConnections = async () => {
        try {
            const res = await fetch('/data/api/config/db-connections');
            const result = await res.json();
            if (result.success) {
                setSavedConnections(result.connections || []);
            }
        } catch (e) {
            console.error("Failed to load connections", e);
        }
    };

    const handleConnect = async () => {
        try {
            const values = await form.validate();
            setLoading(true);
            onConnect(values);
        } catch (e) {
            // Validation error
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        try {
            const values = await form.validate();
            const res = await fetch('/data/api/config/db-connections', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    connection: { ...values, id: selectedConnectionId }, // Pass ID to update if selected
                    action: 'save'
                })
            });
            const result = await res.json();
            if (result.success) {
                Message.success('配置已保存');
                setSavedConnections(result.connections);
                // If checking "new", we might want to select the new one, but for now just reload list
            } else {
                Message.error('保存失败: ' + result.error);
            }
        } catch (e: any) {
            Message.error('保存失败: ' + e.message);
        }
    };

    const handleDelete = async () => {
        if (!selectedConnectionId) return;
        try {
            const res = await fetch('/data/api/config/db-connections', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: selectedConnectionId,
                    action: 'delete'
                })
            });
            const result = await res.json();
            if (result.success) {
                Message.success('配置已删除');
                setSavedConnections(result.connections);
                setSelectedConnectionId(null);
                form.resetFields();
            }
        } catch (e: any) {
            Message.error('删除失败: ' + e.message);
        }
    };

    const handleSelectChange = (value: string) => {
        setSelectedConnectionId(value);
        const connection = savedConnections.find(c => c.id === value);
        if (connection) {
            form.setFieldsValue(connection);
        }
    }

    return (
        <div>
            <div className="text-center mb-6">
                <Typography.Title heading={4} className="flex items-center justify-center gap-2">
                    <IconSettings /> 数据库连接
                </Typography.Title>
                <Typography.Text type="secondary">
                    连接到 MySQL 或 PostgreSQL 数据库
                </Typography.Text>
            </div>

            <Form form={form} layout="vertical" size="large" className="p-4" requiredSymbol={false}>
                {/* Saved Connections Section */}
                <div className="bg-[var(--color-fill-2)] p-4 rounded mb-6 border border-[var(--color-border-2)]">
                    <FormItem label="选择配置">
                        <Select
                            placeholder="选择已保存的连接配置..."
                            onChange={handleSelectChange}
                            value={selectedConnectionId || undefined}
                            allowClear
                            onClear={() => {
                                setSelectedConnectionId(null);
                                form.resetFields();
                            }}
                            className="bg-[var(--color-bg-2)]"
                        >
                            {savedConnections.map(c => (
                                <Option key={c.id} value={c.id}>
                                    {c.name || `${c.user}@${c.host}/${c.database}`}
                                </Option>
                            ))}
                        </Select>
                    </FormItem>
                </div>

                <Divider orientation="center">新连接 / 编辑连接</Divider>

                <div className="grid grid-cols-12 gap-x-6">
                    <div className="col-span-6">
                        <FormItem label="配置名称 (可选)" field="name">
                            <Input placeholder="例如: 本地测试库" />
                        </FormItem>
                    </div>
                    <div className="col-span-6">
                        <FormItem label="数据库类型" field="type" initialValue="mysql" rules={[{ required: true }]}>
                            <Select>
                                <Option value="mysql">MySQL</Option>
                                <Option value="postgres">PostgreSQL</Option>
                            </Select>
                        </FormItem>
                    </div>

                    <div className="col-span-9">
                        <FormItem label="主机地址" field="host" initialValue="localhost" rules={[{ required: true }]}>
                            <Input placeholder="localhost" />
                        </FormItem>
                    </div>
                    <div className="col-span-3">
                        <FormItem label="端口" field="port" initialValue="3306" rules={[{ required: true }]}>
                            <Input placeholder="3306" />
                        </FormItem>
                    </div>

                    <div className="col-span-6">
                        <FormItem label="用户名" field="user" initialValue="root" rules={[{ required: true }]}>
                            <Input placeholder="root" />
                        </FormItem>
                    </div>
                    <div className="col-span-6">
                        <FormItem label="密码" field="password" rules={[{ required: true }]}>
                            <Input.Password placeholder="******" />
                        </FormItem>
                    </div>

                    <div className="col-span-12">
                        <FormItem label="数据库名" field="database" rules={[{ required: true }]}>
                            <Input placeholder="my_database" />
                        </FormItem>
                    </div>
                </div>

                <Divider className="my-8" />

                <div className="flex justify-between items-center">
                    <Space>
                        {selectedConnectionId && (
                            <Popconfirm
                                title="确定要删除这个配置吗?"
                                onOk={handleDelete}
                            >
                                <Button type="secondary" status="danger" icon={<IconDelete />}>
                                    删除该配置
                                </Button>
                            </Popconfirm>
                        )}
                        <Button type="outline" icon={<IconSave />} onClick={handleSave}>
                            保存配置
                        </Button>
                    </Space>
                    <Button type="primary" size="large" onClick={handleConnect} loading={loading} icon={<IconThunderbolt />} className="px-8">
                        立即连接
                    </Button>
                </div>
            </Form>
        </div>
    );
}
