"use client";

import React, { useState } from 'react';
import { Card, Input, Button, Message, Typography, Form, Space } from '@arco-design/web-react';
import { IconUser, IconLock, IconSafe } from '@arco-design/web-react/icon';
import { useAuth } from '@/context/AuthContext';

export default function LoginPage() {
    const { login } = useAuth();
    const [loading, setLoading] = useState(false);
    const [form] = Form.useForm();

    const handleSubmit = async (values: any) => {
        setLoading(true);
        try {
            const res = await fetch('/data/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(values)
            });
            const data = await res.json();

            if (data.success) {
                Message.success('登录成功');
                login(data.user);
            } else {
                Message.error(data.error || '登录失败');
            }
        } catch (e) {
            Message.error('网络错误，请稍后重试');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-1)] bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-900 dark:to-gray-800">
            <Card className="w-full max-w-md shadow-lg p-4" bordered={false}>
                <div className="text-center mb-8">
                    <img src="/data/image/fxiaoke_logonew.png" alt="Logo" className="h-10 mx-auto mb-4" />
                    <Typography.Title heading={4} className="m-0">工具库登录</Typography.Title>
                    <Typography.Text className="text-gray-400">fxcrm-import-tool</Typography.Text>
                </div>

                <Form form={form} onSubmit={handleSubmit} layout="vertical">
                    <Form.Item field="username" rules={[{ required: true, message: '请输入用户名' }]}>
                        <Input
                            prefix={<IconUser />}
                            placeholder="用户名"
                            size="large"
                        />
                    </Form.Item>
                    <Form.Item field="password" rules={[{ required: true, message: '请输入密码' }]}>
                        <Input.Password
                            prefix={<IconLock />}
                            placeholder="密码"
                            size="large"
                        />
                    </Form.Item>

                    <Form.Item className="mb-0">
                        <Button type="primary" htmlType="submit" long size="large" loading={loading}>
                            立即登录
                        </Button>
                    </Form.Item>
                </Form>

                <div className="mt-6 text-center text-gray-400 text-xs">
                    <IconSafe className="mr-1" />
                    Secure Authentication System
                </div>
            </Card>
        </div>
    );
}
