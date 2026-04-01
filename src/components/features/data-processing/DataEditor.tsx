"use client"

import React, { useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Drawer, Form, Input, Button, Message, DatePicker, Space } from '@arco-design/web-react';
import { IconThunderbolt } from '@arco-design/web-react/icon';

const FormItem = Form.Item;

interface DataEditorProps {
    visible: boolean;
    onCancel: () => void;
    onSuccess: () => void;
    connection: any;
    tableName: string;
    columns: any[];
    initialData?: any; // If set, we are in Edit mode
}

export function DataEditor({ visible, onCancel, onSuccess, connection, tableName, columns, initialData }: DataEditorProps) {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);

    // Reset form when opening
    useEffect(() => {
        if (visible) {
            form.resetFields();
            if (initialData) {
                // Editing
                form.setFieldsValue(initialData);
            } else {
                // Creating - Auto-generate UUID for _id
                const initialValues: any = {};
                columns.forEach(col => {
                    if (col.dataIndex === '_id' || col.title === '_id') {
                        initialValues['_id'] = uuidv4();
                    }
                });
                form.setFieldsValue(initialValues);
            }
        }
    }, [visible, form, columns, initialData]);

    const handleSubmit = async () => {
        try {
            const values = await form.validate();
            setLoading(true);

            if (initialData) {
                // UPDATE MODE
                // Heuristic for PK
                const pkField = Object.keys(initialData).find(k => k.toLowerCase() === 'id' || k.toLowerCase() === '_id') || 'id';
                const pkValue = initialData[pkField];

                if (!pkValue) {
                    Message.error('更新失败: 无法确定主键');
                    setLoading(false);
                    return;
                }

                const response = await fetch('/data/api/db/update', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        ...connection,
                        table: tableName,
                        primaryKey: pkField,
                        primaryKeyValue: pkValue,
                        data: values
                    })
                });
                const result = await response.json();
                if (result.success) {
                    Message.success('更新成功');
                    onSuccess();
                    onCancel();
                } else {
                    Message.error('更新失败: ' + result.error);
                }

            } else {
                // INSERT MODE
                const response = await fetch('/data/api/db/insert', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        ...connection,
                        table: tableName,
                        data: values
                    })
                });
                const result = await response.json();

                if (result.success) {
                    Message.success('插入成功');
                    onSuccess();
                    onCancel();
                } else {
                    Message.error('插入失败: ' + result.error);
                }
            }
        } catch (e: any) {
            Message.error('验证失败: ' + e.message);
        } finally {
            setLoading(false);
        }
    };

    const generateUUID = (field: string) => {
        form.setFieldValue(field, uuidv4());
    };

    const renderInput = (col: any) => {
        // Adjust for title/dataIndex differences in Arco vs AG Grid
        const field = (col.dataIndex || col.title || '').toLowerCase();

        if (field.includes('date') || field.includes('time') || field.includes('created') || field.includes('updated')) {
            return <DatePicker showTime style={{ width: '100%' }} />;
        }

        if (field === 'id' || field === '_id') {
            return (
                <Input
                    suffix={
                        <Button
                            type="text"
                            size="mini"
                            icon={<IconThunderbolt />}
                            onClick={() => generateUUID(col.dataIndex || col.title)}
                        >
                            生成
                        </Button>
                    }
                    placeholder="请输入或自动生成"
                />
            );
        }
        return <Input />;
    };

    return (
        <Drawer
            width={500}
            title={initialData ? `编辑数据 - ${tableName}` : `新增数据 - ${tableName}`}
            visible={visible}
            onOk={handleSubmit}
            onCancel={onCancel}
            confirmLoading={loading}
            okText="保存"
            cancelText="取消"
        >
            <Form form={form} layout="vertical">
                {columns.map(col => (
                    <FormItem
                        key={col.dataIndex || col.title}
                        label={col.title}
                        field={col.dataIndex || col.title}
                    >
                        {renderInput(col)}
                    </FormItem>
                ))}
            </Form>
        </Drawer>
    );
}
