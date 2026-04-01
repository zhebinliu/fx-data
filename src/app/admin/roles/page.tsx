"use client";

import React, { useState, useEffect } from 'react';
import { Card, Typography, Table, Message, Tag } from '@arco-design/web-react';
import { useProfiles } from '@/context/ProfileContext';

interface Role {
    id: string; // or roleCode? API returns roleCode usually or id
    roleName: string;
    roleCode: string;
    description: string;
    roleType: number;
    groupName: string;
}

export default function RoleManagementPage() {
    const { activeProfile } = useProfiles();
    const [roles, setRoles] = useState<Role[]>([]);
    const [loading, setLoading] = useState(false);

    const fetchRoles = async () => {
        if (!activeProfile?.appId) return;

        setLoading(true);
        try {
            const response = await fetch('/data/api/fxcrm/role/list', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(activeProfile)
            });
            const result = await response.json();
            if (result.success) {
                setRoles(result.roles || []);
            } else {
                Message.error(result.error || 'Failed to fetch roles');
            }
        } catch (error) {
            Message.error('Network error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRoles();
    }, [activeProfile]);

    const columns = [
        {
            title: '角色名称',
            dataIndex: 'roleName',
            width: 200,
        },
        {
            title: '角色分组',
            dataIndex: 'groupName',
            width: 150,
            render: (text: string) => <Tag color="arcoblue">{text}</Tag>
        },
        {
            title: '角色代码',
            dataIndex: 'roleCode',
            width: 200,
            render: (text: string) => <Typography.Text copyable>{text}</Typography.Text>
        },
        {
            title: '备注',
            dataIndex: 'description',
        },
        {
            title: '类型',
            dataIndex: 'roleType',
            render: (type: number) => type === 1 ? '预设角色' : '自定义角色'
        }
    ];

    return (
        <div className="p-6">
            <Card title={<Typography.Title heading={5} style={{ margin: 0 }}>角色管理</Typography.Title>}>
                <Table
                    loading={loading}
                    data={roles}
                    columns={columns}
                    rowKey="roleCode"
                    pagination={{ pageSize: 20 }}
                />
            </Card>
        </div>
    );
}
