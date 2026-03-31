"use client";

import React, { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, Select, Message, Tag, Space, Popconfirm } from '@arco-design/web-react';
import { IconPlus, IconDelete, IconEdit, IconUser } from '@arco-design/web-react/icon';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { PERMISSIONS, PERMISSION_LABELS } from '@/constants';

const Option = Select.Option;

export default function UserManagementPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [form] = Form.useForm();
    const [editingId, setEditingId] = useState<string | null>(null);

    useEffect(() => {
        if (!authLoading) {
            if (!user || user.role !== 'admin') {
                Message.error("需要管理员权限");
                router.push('/');
                return;
            }
            fetchUsers();
        }
    }, [user, authLoading]);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/auth/users');
            const data = await res.json();
            if (data.success) {
                setUsers(data.users);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (values: any) => {
        try {
            const url = '/api/auth/users';
            const method = editingId ? 'PUT' : 'POST';
            const body = editingId ? { ...values, id: editingId } : values;

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const data = await res.json();

            if (data.success) {
                Message.success(editingId ? '更新成功' : '创建成功');
                setModalVisible(false);
                fetchUsers();
            } else {
                Message.error(data.error || '操作失败');
            }
        } catch (e) {
            Message.error('请求失败');
        }
    };

    const handleDelete = async (id: string) => {
        try {
            const res = await fetch(`/api/auth/users?id=${id}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                Message.success('删除成功');
                fetchUsers();
            } else {
                Message.error(data.error);
            }
        } catch (e) {
            Message.error('删除失败');
        }
    };

    const openModal = (record: any = null) => {
        if (record) {
            setEditingId(record.id);
            form.setFieldsValue(record);
        } else {
            setEditingId(null);
            form.resetFields();
            form.setFieldValue('role', 'user');
        }
        setModalVisible(true);
    };

    const columns = [
        {
            title: '用户名',
            dataIndex: 'username',
        },
        {
            title: '姓名',
            dataIndex: 'name',
        },
        {
            title: '角色',
            dataIndex: 'role',
            render: (role: string) => (
                <Tag color={role === 'admin' ? 'blue' : 'gray'}>
                    {role === 'admin' ? '管理员' : '普通用户'}
                </Tag>
            )
        },
        {
            title: '权限模块',
            dataIndex: 'permissions',
            render: (perms: string[]) => (
                <Space wrap>
                    {perms.length === 0 ? <span className="text-gray-400">-</span> :
                        perms.map(p => <Tag key={p} size="small">{PERMISSION_LABELS[p as keyof typeof PERMISSION_LABELS] || p}</Tag>)
                    }
                </Space>
            )
        },
        {
            title: '操作',
            render: (_: any, record: any) => (
                <Space>
                    <Button size="small" icon={<IconEdit />} onClick={() => openModal(record)} />
                    {record.username !== 'admin' && (
                        <Popconfirm title="确认删除该用户?" onOk={() => handleDelete(record.id)}>
                            <Button size="small" status="danger" icon={<IconDelete />} />
                        </Popconfirm>
                    )}
                </Space>
            )
        }
    ];

    return (
        <div className="p-4">
            <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2">
                    <IconUser className="text-xl text-[var(--color-primary-6)]" />
                    <span className="text-lg font-bold">用户管理</span>
                </div>
                <Button type="primary" icon={<IconPlus />} onClick={() => openModal()}>添加用户</Button>
            </div>

            <Table
                columns={columns}
                data={users}
                loading={loading}
                rowKey="id"
                pagination={false}
            />

            <Modal
                title={editingId ? '编辑用户' : '添加用户'}
                visible={modalVisible}
                onOk={() => form.submit()}
                onCancel={() => setModalVisible(false)}
            >
                <Form form={form} onSubmit={handleSave} layout="vertical">
                    <Form.Item field="username" label="用户名" rules={[{ required: true }]}>
                        <Input disabled={!!editingId} />
                    </Form.Item>
                    <Form.Item field="name" label="姓名" rules={[{ required: true }]}>
                        <Input />
                    </Form.Item>
                    {!editingId && (
                        <Form.Item field="password" label="密码" rules={[{ required: true }]}>
                            <Input.Password />
                        </Form.Item>
                    )}
                    {editingId && (
                        <Form.Item field="password" label="重置密码 (留空不修改)">
                            <Input.Password placeholder="******" />
                        </Form.Item>
                    )}
                    <Form.Item field="role" label="角色" rules={[{ required: true }]}>
                        <Select>
                            <Option value="user">普通用户</Option>
                            <Option value="admin">管理员</Option>
                        </Select>
                    </Form.Item>
                    <Form.Item field="permissions" label="允许访问模块">
                        <Select mode="multiple" placeholder="选择模块">
                            {Object.values(PERMISSIONS).filter(p => p !== 'admin').map(p => (
                                <Option key={p} value={p}>{PERMISSION_LABELS[p]}</Option>
                            ))}
                        </Select>
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
}
