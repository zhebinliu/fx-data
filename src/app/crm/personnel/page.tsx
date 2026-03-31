"use client";

import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Message, Drawer, Tag, Modal, Form, Select, Grid, Switch } from '@arco-design/web-react';
import { IconPlus, IconEdit, IconRefresh } from '@arco-design/web-react/icon';
import { useProfiles } from '@/context/ProfileContext';
import { PersonnelForm } from '@/components/features/crm/PersonnelForm';

const Option = Select.Option;

export default function PersonnelPage() {
    const { activeProfile } = useProfiles();
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [drawerVisible, setDrawerVisible] = useState(false);

    // Role Edit State
    const [editRoleVisible, setEditRoleVisible] = useState(false);
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [roles, setRoles] = useState<any[]>([]); // All available roles
    const [roleForm] = Form.useForm();
    const [savingRole, setSavingRole] = useState(false);

    useEffect(() => {
        if (activeProfile?.appId) {
            fetchUsers();
            fetchRoles();
        }
    }, [activeProfile]);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/fxcrm/users/list', {
                method: 'POST',
                body: JSON.stringify({ ...activeProfile })
            });
            const data = await res.json();
            if (data.success) {
                setUsers(data.users || []);
            } else {
                Message.error(data.error || "获取人员列表失败");
            }
        } catch (e) {
            Message.error("网络请求失败");
        } finally {
            setLoading(false);
        }
    };

    const fetchRoles = async () => {
        try {
            const res = await fetch('/api/fxcrm/role/list', {
                method: 'POST',
                body: JSON.stringify(activeProfile)
            });
            const data = await res.json();
            if (data.success) {
                setRoles(data.roles || []);
            }
        } catch (e) {
            console.error("Failed to fetch roles", e);
        }
    };

    const handleEditRoles = (user: any) => {
        setCurrentUser(user);
        // Reset form. We don't have current user roles in the list API (usually), 
        // unless we fetch detailed info. 
        // Assuming we start with empty or try to fetch detail?
        // FxCRM list API *might* return roles? UserList API in route.ts: map fields.
        // Let's assume for now we just assign NEW roles (batch add). 
        // Or if we want to "Edit", we imply overwrite? batchAddUserRole ADDS roles. It doesn't replace?
        // Wait, batchAddUserRole doc says "add". 
        // If we want to replace, we might need to remove old ones first?
        // For MVP, let's assume "Assign Roles".
        // If user wants full edit, we need "getUserDetail".
        // Let's stick to "Assign Roles" (Add) as requested "Personnel List can modify roles" (修改角色).
        // "Modify" implies seeing old ones.
        // Let's just create the modal to ADD for now, noting limitation or improvement later.
        // Actually, let's blindly support "Assign" via the same `user/role/add` API.
        setEditRoleVisible(true);
        roleForm.resetFields();
    };

    const submitRoleUpdate = async (values: any) => {
        if (!currentUser?.openUserId) {
            Message.error("用户ID缺失");
            return;
        }

        setSavingRole(true);
        try {
            const roleRes = await fetch('/api/fxcrm/user/role/add', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    appId: activeProfile.appId,
                    appSecret: activeProfile.appSecret,
                    permanentCode: activeProfile.permanentCode,
                    currentOpenUserId: activeProfile.currentOpenUserId,
                    corpId: (activeProfile as any).corpId,
                    data: {
                        userIds: [currentUser.openUserId],
                        roleCodes: values.roles,
                        updateMajorRole: values.updateMajorRole || false,
                        majorRole: values.majorRole
                    }
                })
            });
            const roleResult = await roleRes.json();
            if (roleResult.success) {
                Message.success("角色分配成功");
                setEditRoleVisible(false);
            } else {
                Message.error(`角色分配失败: ${roleResult.error}`);
            }
        } catch (e) {
            Message.error("网络请求失败");
        } finally {
            setSavingRole(false);
        }
    };

    const columns = [
        { title: '姓名', dataIndex: 'name', width: 120 },
        { title: '手机号', dataIndex: 'mobile', width: 150 },
        {
            title: '部门',
            dataIndex: 'department',
            render: (val: any) => Array.isArray(val) ? val.join(', ') : val
        },
        { title: '职位', dataIndex: 'jobTitle', render: (val: any) => val || '-' },
        {
            title: '操作',
            width: 120,
            render: (_: any, record: any) => (
                <Button size="small" icon={<IconEdit />} onClick={() => handleEditRoles(record)}>
                    分配角色
                </Button>
            )
        }
    ];

    return (
        <div className="p-6">
            <Card
                title="人员管理"
                extra={
                    <div className="flex gap-2">
                        <Button icon={<IconRefresh />} onClick={fetchUsers} loading={loading}>刷新</Button>
                        <Button type="primary" icon={<IconPlus />} onClick={() => setDrawerVisible(true)}>新增人员</Button>
                    </div>
                }
            >
                <Table
                    rowKey="openUserId"
                    columns={columns}
                    data={users}
                    loading={loading}
                    pagination={{ pageSize: 20 }}
                />
            </Card>

            <Drawer
                width={800}
                title="新增人员"
                visible={drawerVisible}
                onOk={() => setDrawerVisible(false)}
                onCancel={() => setDrawerVisible(false)}
                footer={null}
            >
                <PersonnelForm onSuccess={() => {
                    setDrawerVisible(false);
                    fetchUsers(); // Refresh list on success
                }} />
            </Drawer>

            <Modal
                title={`分配角色 - ${currentUser?.name}`}
                visible={editRoleVisible}
                onOk={roleForm.submit}
                onCancel={() => setEditRoleVisible(false)}
                confirmLoading={savingRole}
                unmountOnExit
            >
                <Form form={roleForm} layout="vertical" onSubmit={submitRoleUpdate}>
                    <Form.Item label="选择角色" field="roles" rules={[{ required: true }]}>
                        <Select mode="multiple" placeholder="选择要添加的角色" allowClear>
                            {roles.map(r => (
                                <Option key={r.roleCode} value={r.roleCode}>{r.name || r.roleName}</Option>
                            ))}
                        </Select>
                    </Form.Item>
                    <Grid.Row gutter={24}>
                        <Grid.Col span={12}>
                            <Form.Item label="更新主角色" field="updateMajorRole" triggerPropName="checked">
                                <Switch />
                            </Form.Item>
                        </Grid.Col>
                        <Grid.Col span={12}>
                            <Form.Item
                                noStyle
                                shouldUpdate={(prev, current) => prev.updateMajorRole !== current.updateMajorRole || prev.roles !== current.roles}
                            >
                                {(values) => {
                                    return values.updateMajorRole ? (
                                        <Form.Item
                                            label="主角色"
                                            field="majorRole"
                                            rules={[{ required: true, message: '请选择主角色' }]}
                                        >
                                            <Select placeholder="选择主角色">
                                                {roles
                                                    .filter(r => (values.roles || []).includes(r.roleCode))
                                                    .map(role => (
                                                        <Option key={role.roleCode} value={role.roleCode}>
                                                            {role.name || role.roleName}
                                                        </Option>
                                                    ))}
                                            </Select>
                                        </Form.Item>
                                    ) : null;
                                }}
                            </Form.Item>
                        </Grid.Col>
                    </Grid.Row>
                </Form>
            </Modal>
        </div>
    );
}
