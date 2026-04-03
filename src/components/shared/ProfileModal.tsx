"use client";

import React, { useEffect, useState } from 'react';
import { Modal, Form, Input, Button, Message } from '@arco-design/web-react';
import { useProfiles } from '@/context/ProfileContext';

interface ProfileModalProps {
    visible: boolean;
    onVisibleChange: (visible: boolean) => void;
    mode?: 'add' | 'edit';
}

const FormItem = Form.Item;

export function ProfileModal({ visible, onVisibleChange, mode = 'edit' }: ProfileModalProps) {
    const { activeProfile, updateProfile, saveProfiles, deleteProfile, addProfile } = useProfiles();
    const [form] = Form.useForm();
    const isAdd = mode === 'add';

    useEffect(() => {
        if (visible) {
            if (isAdd) {
                form.resetFields();
            } else if (activeProfile) {
                form.setFieldsValue({
                    name: activeProfile.name,
                    appId: activeProfile.appId,
                    appSecret: activeProfile.appSecret,
                    permanentCode: activeProfile.permanentCode,
                    currentOpenUserId: activeProfile.currentOpenUserId,
                });
            }
        }
    }, [visible, isAdd, activeProfile, form]);

    const [mobile, setMobile] = useState('');
    const [loadingId, setLoadingId] = useState(false);

    const handleFetchOpenId = async () => {
        if (!mobile) return;

        try {
            setLoadingId(true);
            const values = form.getFieldsValue(['appId', 'appSecret', 'permanentCode']);

            if (!values.appId || !values.appSecret || !values.permanentCode) {
                Message.warning("请先填写 AppID, AppSecret 和 Permanent Code");
                return;
            }

            const res = await fetch('/data/api/fxcrm/user/get-by-mobile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...values,
                    mobile
                })
            });
            const data = await res.json();

            if (data.success) {
                // Determine ID path based on API response structure
                // Usually data.data.openUserId or data.data.userList[0].openUserId
                let userId = "";
                const resultData = data.data;

                if (resultData && resultData.openUserId) {
                    userId = resultData.openUserId;
                } else if (resultData && Array.isArray(resultData.userList) && resultData.userList.length > 0) {
                    userId = resultData.userList[0].openUserId;
                } else if (resultData && Array.isArray(resultData.empList) && resultData.empList.length > 0) {
                    // Handle 'empList' structure
                    userId = resultData.empList[0].openUserId;
                } else if (resultData && resultData.id) {
                    userId = resultData.id;
                }

                if (userId) {
                    form.setFieldValue('currentOpenUserId', userId);
                    Message.success("成功获取并填充 OpenUserId");
                } else {
                    Message.warning("未能在返回数据中找到 OpenUserId: " + JSON.stringify(resultData));
                }
            } else {
                Message.error(`获取失败: ${data.error}`);
            }
        } catch (e: any) {
            Message.error(`网络错误: ${e.message}`);
        } finally {
            setLoadingId(false);
        }
    };

    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        try {
            const values = await form.validate();
            setSaving(true);
            if (isAdd) {
                await addProfile(values);
                Message.success('配置已创建');
            } else {
                await updateProfile(values);
                Message.success('配置已保存并同步到 CRM');
            }
            onVisibleChange(false);
        } catch (error: any) {
            if (error?.message) Message.error(error.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = () => {
        Modal.confirm({
            title: '确认删除',
            content: `确定要删除配置 "${activeProfile.name}" 吗？`,
            okButtonProps: { status: 'danger' },
            onOk: () => {
                deleteProfile(activeProfile.id);
                onVisibleChange(false);
            },
        });
    };

    return (
        <Modal
            title={isAdd ? '新建配置' : '配置详情'}
            visible={visible}
            onOk={handleSave}
            onCancel={() => onVisibleChange(false)}
            footer={
                <div className="flex justify-between w-full">
                    {!isAdd ? (
                        <Button status="danger" onClick={handleDelete}>
                            删除此配置
                        </Button>
                    ) : <span />}
                    <div>
                        <Button onClick={() => onVisibleChange(false)} className="mr-2">
                            取消
                        </Button>
                        <Button type="primary" onClick={handleSave} loading={saving}>
                            {isAdd ? '创建配置' : '保存更改'}
                        </Button>
                    </div>
                </div>
            }
        >
            <Form
                form={form}
                layout="vertical"
                initialValues={activeProfile}
            >
                <FormItem label="配置显示名称" field="name" rules={[{ required: true }]}>
                    <Input placeholder="例如：开发环境" />
                </FormItem>
                <FormItem label="App ID" field="appId" rules={[{ required: true }]}>
                    <Input placeholder="Fx开头的 App ID" />
                </FormItem>
                <FormItem label="App Secret" field="appSecret" rules={[{ required: true }]}>
                    <Input.Password placeholder="App Secret" />
                </FormItem>
                <FormItem label="Permanent Code" field="permanentCode" rules={[{ required: true }]}>
                    <Input.Password placeholder="Permanent Code" />
                </FormItem>
                <FormItem label="当前用户 ID (OpenUserId)" field="currentOpenUserId" rules={[{ required: true }]}>
                    <Input placeholder="例如：FSUID_..." />
                </FormItem>

                <div className="bg-[var(--color-fill-2)] p-4 rounded mb-4 border border-[var(--color-border-2)]">
                    <div className="text-sm font-medium mb-2 text-[var(--color-text-1)]">如果不确定 OpenUserId:</div>
                    <div className="flex gap-2">
                        <Input
                            placeholder="输入账号手机号"
                            style={{ flex: 1 }}
                            value={mobile}
                            onChange={setMobile}
                        />
                        <Button
                            type="secondary"
                            onClick={handleFetchOpenId}
                            loading={loadingId}
                            disabled={!mobile}
                        >
                            查询 ID
                        </Button>
                    </div>
                    <div className="text-xs text-[var(--color-text-3)] mt-2">
                        利用 AppID 和 Secrets 通过手机号自动获取用户 ID。
                    </div>
                </div>
            </Form>
        </Modal>
    );
}
