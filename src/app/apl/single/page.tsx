"use client";
import React, { useEffect, useState } from 'react';
import { Card, Typography, Select, Input, Button, Grid, Form, Message } from '@arco-design/web-react';
import { fetchProjects, submitSingleGeneration, APLProject } from '@/lib/api/apl';

const Option = Select.Option;
const { Row, Col } = Grid;

export default function APLSingleGeneration() {
    const [projects, setProjects] = useState<APLProject[]>([]);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState('');
    const [form] = Form.useForm();

    useEffect(() => {
        fetchProjects().then(data => {
            setProjects(data);
            const current = data.find(p => p.is_current);
            if (current) {
                form.setFieldValue('project', current.name);
            }
        }).catch(console.error);
    }, [form]);

    const handleSubmit = async (values: any) => {
        setLoading(true);
        setResult('');
        try {
            const res = await submitSingleGeneration(values);
            setResult(JSON.stringify(res, null, 2));
            Message.success('单条生成任务已提交');
        } catch (err: any) {
            Message.error(err.message || '生成失败');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ padding: '24px' }}>
            <Typography.Title heading={3}>单条生成</Typography.Title>
            <Card style={{ marginBottom: 24 }} bordered={false}>
                <Form layout="vertical" form={form} onSubmit={handleSubmit} initialValues={{ function_type: '流程函数', web_create_api: 'on' }}>
                    <Row gutter={24}>
                        <Col xs={24} sm={12}>
                            <Form.Item label="项目" field="project" rules={[{ required: true }]}>
                                <Select placeholder="请选择项目">
                                    {projects.map(p => <Option key={p.name} value={p.name}>{p.name}</Option>)}
                                </Select>
                            </Form.Item>
                        </Col>
                        <Col xs={24} sm={12}>
                            <Form.Item label="函数类型" field="function_type">
                                <Select>
                                    {['流程函数', '范围规则', 'UI函数', '按钮', '计划任务', '自定义控制器'].map(v => <Option key={v} value={v}>{v}</Option>)}
                                </Select>
                            </Form.Item>
                        </Col>
                        <Col xs={24} sm={12}>
                            <Form.Item label="绑定对象 API Name" field="object_api" help="输入中文名或 API 名以匹配">
                                <Input placeholder="如 AccountObj" />
                            </Form.Item>
                        </Col>
                        <Col xs={24} sm={12}>
                            <Form.Item label="函数名 (可选)" field="code_name">
                                <Input placeholder="例如：【流程】关联客户" />
                            </Form.Item>
                        </Col>
                        <Col span={24}>
                            <Form.Item label="业务需求" field="requirement" rules={[{ required: true }]}>
                                <Input.TextArea placeholder="填写完整业务需求" rows={6} />
                            </Form.Item>
                        </Col>
                        <Col span={24}>
                            <Button type="primary" htmlType="submit" size="large" loading={loading}>
                                确认生成函数
                            </Button>
                        </Col>
                    </Row>
                </Form>
            </Card>
            {result && (
                <Card title="执行结果">
                    <pre style={{ background: 'var(--color-fill-2)', padding: '16px', borderRadius: '4px', overflowX: 'auto' }}>
                        {result}
                    </pre>
                </Card>
            )}
        </div>
    );
}
