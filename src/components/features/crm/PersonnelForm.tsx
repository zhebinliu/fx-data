"use client";

import React, { useState, useEffect } from 'react';
import { Typography, Form, Input, Button, Message, Grid, Select, Switch } from '@arco-design/web-react';
import { useProfiles } from '@/context/ProfileContext';

const FormItem = Form.Item;
const Row = Grid.Row;
const Col = Grid.Col;

interface PersonnelFormProps {
    onSuccess?: () => void;
}

export function PersonnelForm({ onSuccess }: PersonnelFormProps) {
    const [form] = Form.useForm();
    const { activeProfile } = useProfiles();
    const [loading, setLoading] = useState(false);

    // State for selectors
    const [departments, setDepartments] = useState<any[]>([]);
    const [roles, setRoles] = useState<any[]>([]);
    const [users, setUsers] = useState<any[]>([]); // For parent selection
    const [fetchingOptions, setFetchingOptions] = useState(false);

    useEffect(() => {
        if (activeProfile?.appId) {
            fetchOptions();
        }
    }, [activeProfile]);

    const fetchOptions = async () => {
        setFetchingOptions(true);
        try {
            // Parallel fetch for efficiency
            const [deptRes, roleRes, userRes] = await Promise.all([
                fetch('/data/api/fxcrm/department/list', {
                    method: 'POST',
                    body: JSON.stringify(activeProfile)
                }).then(r => r.json()),
                fetch('/data/api/fxcrm/role/list', {
                    method: 'POST',
                    body: JSON.stringify(activeProfile)
                }).then(r => r.json()),
                fetch('/data/api/fxcrm/users/list', {
                    method: 'POST',
                    body: JSON.stringify({ ...activeProfile })
                }).then(r => r.json())
            ]);

            if (deptRes.success) {
                setDepartments(deptRes.departments || []);
            }

            if (roleRes.success) {
                setRoles(roleRes.roles || []);
            }

            if (userRes.success) {
                setUsers(userRes.users || []);
            }

        } catch (e) {
            console.error("Failed to fetch options", e);
            Message.error("加载选项数据失败");
        } finally {
            setFetchingOptions(false);
        }
    };

    const handleSubmit = async (values: any) => {
        if (!activeProfile.id) {
            Message.error("请先选择一个配置");
            return;
        }

        setLoading(true);
        try {
            const mainDeptId = values.mainDepartment ? values.mainDepartment : undefined;
            const roleIds = values.roles || [];

            // Construct payload 
            const payload = {
                hasSpecifyTime: true,
                includeDetailIds: true,
                triggerWorkFlow: true,
                currentOpenUserId: activeProfile.currentOpenUserId,
                data: {
                    object_data: {
                        dataObjectApiName: "PersonnelObj",
                        name: values.name,
                        phone: values.mobile,
                        email: values.email,
                        sex: values.gender === 'Male' ? "M" : "F",
                        main_department: mainDeptId ? [mainDeptId] : [],
                        job_title: values.position,
                        employee_number: values.employeeNumber,
                        leader: [values.parentOpenUserId],
                        role_id: roleIds,
                        status: "1"
                    },
                    optionInfo: {
                        skipFuncValidate: true,
                        isDuplicateSearch: true,
                        useValidationRule: true
                    },
                    igonreMediaIdConvert: false
                },
                hasSpecifyCreatedBy: true,
                triggerApprovalFlow: true
            };

            const response = await fetch('/data/api/fxcrm/user/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    appId: activeProfile.appId,
                    appSecret: activeProfile.appSecret,
                    permanentCode: activeProfile.permanentCode,
                    currentOpenUserId: activeProfile.currentOpenUserId,
                    data: payload
                })
            });

            const result = await response.json();

            if (result.success) {
                // Check if we need to assign roles
                const fsuid = result.result?.extraData?.user_id;

                if (roleIds.length > 0 && fsuid) {
                    Message.loading({ id: 'role_assign', content: '人员创建成功，正在分配角色...' });
                    try {
                        const roleRes = await fetch('/data/api/fxcrm/user/role/add', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                appId: activeProfile.appId,
                                appSecret: activeProfile.appSecret,
                                permanentCode: activeProfile.permanentCode,
                                currentOpenUserId: activeProfile.currentOpenUserId,
                                corpId: (activeProfile as any).corpId,
                                data: {
                                    userIds: [fsuid],
                                    roleCodes: roleIds,
                                    updateMajorRole: values.updateMajorRole || false,
                                    majorRole: values.majorRole
                                }
                            })
                        });
                        const roleResult = await roleRes.json();

                        if (roleResult.success) {
                            Message.success({ id: 'role_assign', content: '人员创建及角色分配成功！' });
                        } else {
                            Message.warning({ id: 'role_assign', content: `人员创建成功，但角色分配失败: ${roleResult.error}` });
                        }
                    } catch (e) {
                        Message.warning({ id: 'role_assign', content: '人员创建成功，但角色分配网络请求失败' });
                    }
                } else {
                    Message.success('人员创建成功！');
                }
                form.resetFields();
                if (onSuccess) onSuccess();
            } else {
                Message.error(`创建失败: ${result.error}`);
            }
        } catch (error) {
            console.error(error);
            Message.error('网络请求失败');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Form
            form={form}
            layout="vertical"
            onSubmit={handleSubmit}
            initialValues={{
                gender: 'Male'
            }}
            className="p-2"
        >
            <Typography.Title heading={6} className="mb-4">基本信息</Typography.Title>
            <Row gutter={24}>
                <Col span={12}>
                    <FormItem label="姓名" field="name" rules={[{ required: true, message: '请输入姓名' }]}>
                        <Input placeholder="请输入姓名" />
                    </FormItem>
                </Col>
                <Col span={12}>
                    <FormItem label="手机号" field="mobile" rules={[{ required: true, message: '请输入手机号' }]}>
                        <Input placeholder="请输入11位手机号" />
                    </FormItem>
                </Col>
            </Row>

            <Row gutter={24}>
                <Col span={12}>
                    <FormItem label="邮箱" field="email">
                        <Input placeholder="请输入邮箱 (选填)" />
                    </FormItem>
                </Col>
                <Col span={12}>
                    <FormItem label="性别" field="gender">
                        <Select placeholder="选择性别">
                            <Select.Option value="Male">男</Select.Option>
                            <Select.Option value="Female">女</Select.Option>
                        </Select>
                    </FormItem>
                </Col>
            </Row>

            <Typography.Title heading={6} className="mt-4 mb-4">组织信息</Typography.Title>
            <Row gutter={24}>
                <Col span={12}>
                    <FormItem
                        label="主部门"
                        field="mainDepartment"
                        rules={[{ required: true, message: '请选择主部门' }]}
                    >
                        <Select
                            placeholder="选择部门"
                            loading={fetchingOptions}
                            showSearch
                            filterOption={(inputValue, option) =>
                                String((option as any)?.props?.children || "").toLowerCase().indexOf(inputValue.toLowerCase()) >= 0
                            }
                        >
                            {departments.map(dept => (
                                <Select.Option key={dept.id} value={String(dept.id)}>
                                    {dept.name}
                                </Select.Option>
                            ))}
                        </Select>
                    </FormItem>
                </Col>
                <Col span={12}>
                    <FormItem label="职位" field="position">
                        <Input placeholder="请输入职位名称" />
                    </FormItem>
                </Col>
            </Row>

            <Row gutter={24}>
                <Col span={12}>
                    <FormItem label="工号" field="employeeNumber">
                        <Input placeholder="请输入工号 (选填)" />
                    </FormItem>
                </Col>
                <Col span={12}>
                    <FormItem label="直属上级 (OpenUserID)" field="parentOpenUserId">
                        <Select
                            placeholder="选择直属上级"
                            loading={fetchingOptions}
                            showSearch
                            allowClear
                            onChange={async (val) => {
                                const selectedUser = users.find(u => (u.openUserId === val) || (u.mobile === val));

                                if (selectedUser) {
                                    if (selectedUser.openUserId) {
                                        form.setFieldValue('parentOpenUserId', selectedUser.openUserId);
                                    } else if (selectedUser.mobile) {
                                        Message.loading({ id: 'fetch_openid', content: '正在通过手机号获取 OpenID...' });
                                        try {
                                            const res = await fetch('/data/api/fxcrm/user/get-by-mobile', {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({
                                                    ...activeProfile,
                                                    mobile: selectedUser.mobile
                                                })
                                            });
                                            const data = await res.json();
                                            if (data.success && data.data) {
                                                const uid = data.data.openUserId || data.data.empList?.[0]?.openUserId || data.data.userList?.[0]?.openUserId;
                                                if (uid) {
                                                    form.setFieldValue('parentOpenUserId', uid);
                                                    Message.success({ id: 'fetch_openid', content: '已获取 OpenID' });
                                                } else {
                                                    Message.warning({ id: 'fetch_openid', content: '未找到该手机号对应的 OpenID' });
                                                    form.setFieldValue('parentOpenUserId', val);
                                                }
                                            } else {
                                                Message.error({ id: 'fetch_openid', content: '获取 OpenID 失败' });
                                                form.setFieldValue('parentOpenUserId', val);
                                            }
                                        } catch (e) {
                                            Message.error({ id: 'fetch_openid', content: '网络请求失败' });
                                            form.setFieldValue('parentOpenUserId', val);
                                        }
                                    }
                                } else {
                                    form.setFieldValue('parentOpenUserId', val);
                                }
                            }}
                            filterOption={(inputValue, option) =>
                                String((option as any)?.props?.children || "").toLowerCase().indexOf(inputValue.toLowerCase()) >= 0
                            }
                        >
                            {users.map(u => (
                                <Select.Option key={u.openUserId || u.mobile} value={u.openUserId || u.mobile}>
                                    {u.name} {u.department ? `(${u.department})` : ''}
                                </Select.Option>
                            ))}
                        </Select>
                    </FormItem>
                </Col>
            </Row>

            <Typography.Title heading={6} className="mt-4 mb-4">权限与角色</Typography.Title>
            <Row gutter={24}>
                <Col span={24}>
                    <FormItem label="角色 (多选)" field="roles">
                        <Select
                            mode="multiple"
                            placeholder="选择角色"
                            loading={fetchingOptions}
                            allowClear
                            onChange={() => {
                                // Reset major role if needed
                            }}
                        >
                            {roles.map(role => (
                                <Select.Option key={role.roleCode} value={role.roleCode}>
                                    {role.name || role.roleName}
                                </Select.Option>
                            ))}
                        </Select>
                    </FormItem>
                </Col>
            </Row>

            <Row gutter={24}>
                <Col span={12}>
                    <FormItem label="更新主角色" field="updateMajorRole" triggerPropName="checked">
                        <Switch />
                    </FormItem>
                </Col>
                <Col span={12}>
                    <Form.Item
                        noStyle
                        shouldUpdate={(prev, current) => prev.updateMajorRole !== current.updateMajorRole || prev.roles !== current.roles}
                    >
                        {(values) => {
                            return values.updateMajorRole ? (
                                <FormItem
                                    label="主角色"
                                    field="majorRole"
                                    rules={[{ required: true, message: '请选择主角色' }]}
                                >
                                    <Select placeholder="选择主角色">
                                        {roles
                                            .filter(r => (values.roles || []).includes(r.roleCode))
                                            .map(role => (
                                                <Select.Option key={role.roleCode} value={role.roleCode}>
                                                    {role.name || role.roleName}
                                                </Select.Option>
                                            ))}
                                    </Select>
                                </FormItem>
                            ) : null;
                        }}
                    </Form.Item>
                </Col>
            </Row>

            <div className="mt-8 flex justify-end gap-4">
                <Button onClick={() => form.resetFields()}>重置</Button>
                <Button type="primary" htmlType="submit" loading={loading}>提交</Button>
            </div>
        </Form>
    );
}
