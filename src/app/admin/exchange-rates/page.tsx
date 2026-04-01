"use client";

import React, { useState, useEffect } from 'react';
import { Card, Typography, Table, Button, Modal, Form, Input, DatePicker, InputNumber, Message, Space, Popconfirm } from '@arco-design/web-react';
import { IconPlus, IconEdit, IconDelete } from '@arco-design/web-react/icon';

const FormItem = Form.Item;

interface ExchangeRate {
    id: string;
    currencyPair: string;
    rate: number;
    date: string;
    source: string;
    updatedAt: string;
}

export default function ExchangeRatesPage() {
    const [rates, setRates] = useState<ExchangeRate[]>([]);
    const [loading, setLoading] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [form] = Form.useForm();
    const [isEdit, setIsEdit] = useState(false);
    const [currentId, setCurrentId] = useState<string | null>(null);

    const fetchRates = async () => {
        setLoading(true);
        try {
            const response = await fetch('/data/api/admin/exchange-rates/list');
            const result = await response.json();
            if (result.success) {
                setRates(result.rates);
            } else {
                Message.error(result.error || 'Failed to fetch rates');
            }
        } catch (error) {
            Message.error('Network error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRates();
    }, []);

    const handleAdd = () => {
        setIsEdit(false);
        setCurrentId(null);
        form.resetFields();
        setModalVisible(true);
    };

    const handleEdit = (record: ExchangeRate) => {
        setIsEdit(true);
        setCurrentId(record.id);
        form.setFieldsValue({
            currencyPair: record.currencyPair,
            rate: record.rate,
            date: record.date,
            source: record.source
        });
        setModalVisible(true);
    };

    const handleDelete = async (id: string) => {
        try {
            const response = await fetch('/data/api/admin/exchange-rates/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id })
            });
            const result = await response.json();
            if (result.success) {
                Message.success('Rate deleted');
                fetchRates();
            } else {
                Message.error(result.error || 'Failed to delete');
            }
        } catch (error) {
            Message.error('Network error');
        }
    };

    const handleSubmit = async () => {
        try {
            const values = await form.validate();
            const payload = {
                ...values,
                id: currentId // If null, backend generates new ID
            };

            const response = await fetch('/data/api/admin/exchange-rates/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await response.json();
            if (result.success) {
                Message.success(isEdit ? 'Rate updated' : 'Rate added');
                setModalVisible(false);
                fetchRates();
            } else {
                Message.error(result.error || 'Operation failed');
            }
        } catch (error) {
            console.error(error);
        }
    };

    const columns = [
        {
            title: ' 汇率组合',
            dataIndex: 'currencyPair', // e.g. USD/CNY
        },
        {
            title: '汇率',
            dataIndex: 'rate',
        },
        {
            title: '生效日期',
            dataIndex: 'date',
        },
        {
            title: '来源',
            dataIndex: 'source',
        },
        {
            title: '更新时间',
            dataIndex: 'updatedAt',
            render: (text: string) => new Date(text).toLocaleString()
        },
        {
            title: '操作',
            key: 'action',
            render: (_: any, record: ExchangeRate) => (
                <Space>
                    <Button type="text" size="small" icon={<IconEdit />} onClick={() => handleEdit(record)}>
                        Edit
                    </Button>
                    <Popconfirm
                        title="Are you sure to delete this rate?"
                        onOk={() => handleDelete(record.id)}
                    >
                        <Button type="text" status="danger" size="small" icon={<IconDelete />}>
                            Delete
                        </Button>
                    </Popconfirm>
                </Space>
            )
        }
    ];

    return (
        <div className="p-6">
            <Card title={
                <div className="flex justify-between items-center">
                    <Typography.Title heading={5} style={{ margin: 0 }}>汇率管理</Typography.Title>
                    <Button type="primary" icon={<IconPlus />} onClick={handleAdd}>添加汇率</Button>
                </div>
            }>
                <Table
                    loading={loading}
                    data={rates}
                    columns={columns}
                    rowKey="id"
                    pagination={{ pageSize: 10 }}
                />
            </Card>

            <Modal
                title={isEdit ? "Edit Exchange Rate" : "Add Exchange Rate"}
                visible={modalVisible}
                onOk={handleSubmit}
                onCancel={() => setModalVisible(false)}
                autoFocus={false}
                focusLock={true}
            >
                <Form form={form} layout="vertical">
                    <FormItem label="外汇组合" field="currencyPair" rules={[{ required: true }]}>
                        <Input placeholder="e.g. USD/CNY" />
                    </FormItem>
                    <FormItem label="汇率" field="rate" rules={[{ required: true }]}>
                        <InputNumber precision={4} step={0.0001} placeholder="e.g. 7.2345" />
                    </FormItem>
                    <FormItem label="日期" field="date" rules={[{ required: true }]}>
                        <DatePicker style={{ width: '100%' }} />
                    </FormItem>
                    <FormItem label="来源" field="source">
                        <Input placeholder="e.g. Central Bank / Manual" />
                    </FormItem>
                </Form>
            </Modal>
        </div>
    );
}
