"use client";

import React, { useState, useEffect } from 'react';
import { Card, Input, Button, Message, Typography, Form, Divider } from '@arco-design/web-react';
import { IconUser, IconLock, IconSafe } from '@arco-design/web-react/icon';
import { useAuth } from '@/context/AuthContext';
import { useSearchParams } from 'next/navigation';

export default function LoginPage() {
    const { login } = useAuth();
    const [loading, setLoading] = useState(false);
    const [ssoLoading, setSsoLoading] = useState(false);
    const [form] = Form.useForm();
    const searchParams = useSearchParams();

    useEffect(() => {
        const error = searchParams.get('error');
        if (error) {
            Message.error(decodeURIComponent(error));
            return;
        }

        const ssoToken = searchParams.get('sso_token');
        if (ssoToken) {
            setSsoLoading(true);
            fetch(`/data/api/auth/sso/exchange?token=${encodeURIComponent(ssoToken)}`)
                .then(r => r.json())
                .then(data => {
                    if (data.success) {
                        sessionStorage.removeItem('sso_attempted');
                        login(data.user);
                    } else {
                        Message.error('SSO 登录失败: ' + (data.error || '未知错误'));
                    }
                })
                .catch(() => Message.error('SSO 登录失败，请重试'))
                .finally(() => setSsoLoading(false));
            return;
        }

        // 自动尝试 SSO 登录（无 error、无 sso_token 时触发）
        // 用 sessionStorage 标记避免 SSO 失败后无限循环跳转
        const ssoAttempted = sessionStorage.getItem('sso_attempted');
        if (!ssoAttempted) {
            sessionStorage.setItem('sso_attempted', '1');
            window.location.href = '/data/api/auth/sso';
        }
    }, [searchParams]);

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

    const handleSSOLogin = () => {
        setSsoLoading(true);
        window.location.href = '/data/api/auth/sso';
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-1)] bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-900 dark:to-gray-800">
            <Card className="w-full max-w-md shadow-lg p-4" bordered={false}>
                <div className="text-center mb-8">
                    <img src="/data/image/fxiaoke_logonew.png" alt="Logo" className="h-10 mx-auto mb-4" />
                    <Typography.Title heading={4} className="m-0">工具库登录</Typography.Title>
                    <Typography.Text className="text-gray-400">fxcrm-import-tool</Typography.Text>
                </div>

                <Button
                    type="primary"
                    long
                    size="large"
                    loading={ssoLoading}
                    onClick={handleSSOLogin}
                    style={{ marginBottom: 16, background: '#FF6A00', borderColor: '#FF6A00' }}
                >
                    🚀 使用纷享账号一键登录
                </Button>

                <Divider style={{ margin: '16px 0', color: '#aaa', fontSize: 12 }}>或使用账号密码登录</Divider>

                <Form form={form} onSubmit={handleSubmit} layout="vertical">
                    <Form.Item field="username" rules={[{ required: true, message: '请输入用户名' }]}>
                        <Input prefix={<IconUser />} placeholder="用户名" size="large" />
                    </Form.Item>
                    <Form.Item field="password" rules={[{ required: true, message: '请输入密码' }]}>
                        <Input.Password prefix={<IconLock />} placeholder="密码" size="large" />
                    </Form.Item>
                    <Form.Item className="mb-0">
                        <Button type="secondary" htmlType="submit" long size="large" loading={loading}>
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
