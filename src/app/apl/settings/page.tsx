"use client";
import React, { useEffect, useState } from 'react';
import { Card, Typography, Form, Select, Input, Button, Grid, Message, Space } from '@arco-design/web-react';
import { fetchSettings, saveSettings, saveCert } from '@/lib/api/apl';

const { Title } = Typography;
const { Row, Col } = Grid;
const { Option } = Select;
const FormItem = Form.Item;
const TextArea = Input.TextArea;

export default function APLSettings() {
    const [loading, setLoading] = useState(false);
    const [settings, setSettings] = useState<any>({});
    
    const [form] = Form.useForm();
    const [certForm] = Form.useForm();

    const loadData = async () => {
        try {
            const data = await fetchSettings();
            setSettings(data);
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleSaveSettings = async (values: any) => {
        setLoading(true);
        try {
            await saveSettings(values);
            Message.success('基础配置保存成功');
            loadData();
        } catch (err: any) {
            Message.error(err.message || '保存失败');
        } finally {
            setLoading(false);
        }
    };

    const handleSaveCert = async (values: any) => {
        if (!values.project || !values.certificate) return;
        setLoading(true);
        try {
            await saveCert(values.project, values.certificate);
            Message.success('证书保存成功');
            certForm.setFieldValue('certificate', ''); // clear textarea
            loadData();
        } catch (err: any) {
            Message.error(err.message || '保存失败');
        } finally {
            setLoading(false);
        }
    };

    const projectNames = Object.keys(settings.project_domains || {});

    return (
        <div style={{ padding: '24px', backgroundColor: '#f5f6fa', minHeight: '100%' }}>
            <div style={{ marginBottom: 24 }}>
                <Title heading={3} style={{ margin: 0 }}>配置管理</Title>
            </div>

            <Row gutter={24}>
                <Col span={14}>
                    <Card title="基础配置" bordered={false} style={{ height: '100%' }}>
                        {Object.keys(settings).length > 0 ? (
                        <Form 
                            form={form} 
                            layout="vertical" 
                            onSubmit={handleSaveSettings}
                            initialValues={settings}
                        >
                            <Row gutter={24}>
                                <Col span={24}>
                                    <FormItem label="当前项目" field="project_name">
                                        <Select placeholder="请选择项目">
                                            {projectNames.map(p => <Option key={p} value={p}>{p}</Option>)}
                                        </Select>
                                    </FormItem>
                                </Col>
                                <Col span={12}>
                                    <FormItem label="代理登录 URL" field="bootstrap_token_url">
                                        <Input placeholder="请输入" />
                                    </FormItem>
                                </Col>
                                <Col span={12}>
                                    <FormItem label="项目域名" field="domain">
                                        <Input placeholder="例如：https://www.fxiaoke.com" />
                                    </FormItem>
                                </Col>
                                <Col span={12}>
                                    <FormItem label="代理员工 ID" field="agent_login_employee_id">
                                        <Input placeholder="请输入" />
                                    </FormItem>
                                </Col>
                                <Col span={12}>
                                    <FormItem label="登录账号" field="username">
                                        <Input placeholder="手机号或邮箱" />
                                    </FormItem>
                                </Col>
                                <Col span={12}>
                                    <FormItem label="登录密码" field="password">
                                        <Input.Password placeholder="留空则不修改" />
                                    </FormItem>
                                </Col>
                                <Col span={24}>
                                    <Button type="primary" htmlType="submit" loading={loading} style={{ marginTop: 16 }}>
                                        保存基础配置
                                    </Button>
                                </Col>
                            </Row>
                        </Form>
                        ) : (
                            <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>加载中...</div>
                        )}
                    </Card>
                </Col>

                <Col span={10}>
                    <Card title="更新项目证书" bordered={false} style={{ height: '100%' }}>
                        {Object.keys(settings).length > 0 ? (
                        <Form 
                            form={certForm} 
                            layout="vertical" 
                            onSubmit={handleSaveCert}
                            initialValues={{ project: settings.project_name || '' }}
                        >
                            <FormItem label="项目" field="project" rules={[{ required: true }]}>
                                <Select placeholder="请选择项目">
                                    {projectNames.map(p => <Option key={p} value={p}>{p}</Option>)}
                                </Select>
                            </FormItem>
                            <FormItem label="证书" field="certificate" rules={[{ required: true, message: '请粘贴开发者证书' }]}>
                                <TextArea placeholder="粘贴由于会话失效抓包获取的新证书" rows={8} style={{ resize: 'none' }} />
                            </FormItem>
                            <Button type="primary" htmlType="submit" status="warning" loading={loading} style={{ marginTop: 16 }}>
                                保存项目证书
                            </Button>
                        </Form>
                        ) : null}
                    </Card>
                </Col>
            </Row>
        </div>
    );
}
