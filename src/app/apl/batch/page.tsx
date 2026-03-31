"use client";
import React, { useEffect, useState } from 'react';
import { Card, Typography, Select, Button, Grid, Upload, Form, Message, Checkbox } from '@arco-design/web-react';
import { fetchProjects, submitBatchGeneration, uploadBatchCsv, APLProject } from '@/lib/api/apl';

const Option = Select.Option;
const { Row, Col } = Grid;

export default function APLBatchGeneration() {
    const [projects, setProjects] = useState<APLProject[]>([]);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [form1] = Form.useForm();
    const [form2] = Form.useForm();

    useEffect(() => {
        fetchProjects().then(data => {
            setProjects(data);
            const current = data.find(p => p.is_current);
            if (current) {
                form1.setFieldValue('project', current.name);
                form2.setFieldValue('project', current.name);
            }
        }).catch(console.error);
    }, [form1, form2]);

    const handleUploadSubmit = async (values: any) => {
        if (!file) {
            Message.error("请先选择 CSV 文件");
            return;
        }
        setLoading(true);
        setResult('');
        const formData = new FormData();
        formData.append('file', file);
        formData.append('project', values.project || '');
        formData.append('web_create_api', values.web_create_api ? 'on' : 'off');

        try {
            const res = await uploadBatchCsv(formData);
            setResult(JSON.stringify(res, null, 2));
            Message.success('批量上传任务已提交');
        } catch (err: any) {
            Message.error(err.message || '上传失败');
        } finally {
            setLoading(false);
        }
    };

    const handleExistingSubmit = async (values: any) => {
        setLoading(true);
        setResult('');
        try {
            const res = await submitBatchGeneration({
                project: values.project || '',
                web_create_api: values.web_create_api ? 'on' : 'off',
                dry_run: values.dry_run ? 'on' : 'off',
                regenerate: values.regenerate ? 'on' : 'off'
            });
            setResult(JSON.stringify(res, null, 2));
            Message.success('批量生成任务已提交');
        } catch (err: any) {
            Message.error(err.message || '执行失败');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ padding: '24px' }}>
            <Typography.Title heading={3}>批量生成</Typography.Title>
            <Typography.Text type="secondary">
                支持通过上传 CSV 或者执行已有配置的项目记录进行全量分析与处理。
            </Typography.Text>

            <Row gutter={24} style={{ marginTop: 24 }}>
                <Col xs={24} md={12}>
                    <Card style={{ height: '100%' }} bordered={false} title="方式一：上传 CSV 模板">
                        <Form layout="vertical" form={form1} onSubmit={handleUploadSubmit} initialValues={{ web_create_api: true }}>
                            <Form.Item label="项目" field="project">
                                <Select placeholder="优先以文件内为准" allowClear>
                                    {projects.map(p => <Option key={p.name} value={p.name}>{p.name}</Option>)}
                                </Select>
                            </Form.Item>
                            <Form.Item label="CSV 文件" required>
                                <Upload 
                                    drag 
                                    accept=".csv" 
                                    limit={1}
                                    autoUpload={false} 
                                    onChange={(_, file) => setFile(file.originFile || null)}
                                />
                            </Form.Item>
                            <Form.Item field="web_create_api" triggerPropName="checked">
                                <Checkbox>自动同步云端 API</Checkbox>
                            </Form.Item>
                            <Form.Item>
                                <Button type="primary" htmlType="submit" disabled={loading}>
                                    上传并执行
                                </Button>
                            </Form.Item>
                        </Form>
                    </Card>
                </Col>
                
                <Col xs={24} md={12}>
                    <Card style={{ height: '100%' }} bordered={false} title="方式二：执行已有记录">
                        <Form layout="vertical" form={form2} onSubmit={handleExistingSubmit} initialValues={{ web_create_api: true, dry_run: false, regenerate: false }}>
                            <Form.Item label="项目" field="project">
                                <Select placeholder="当前执行项目" allowClear>
                                    {projects.map(p => <Option key={p.name} value={p.name}>{p.name}</Option>)}
                                </Select>
                            </Form.Item>
                            <Form.Item field="web_create_api" triggerPropName="checked">
                                <Checkbox>自动同步云端 API</Checkbox>
                            </Form.Item>
                            <Form.Item field="dry_run" triggerPropName="checked">
                                <Checkbox>Dry Run (不实际调用 API)</Checkbox>
                            </Form.Item>
                            <Form.Item field="regenerate" triggerPropName="checked">
                                <Checkbox>Regenerate (强制重新生成)</Checkbox>
                            </Form.Item>
                            <Form.Item>
                                <Button type="primary" htmlType="submit" disabled={loading}>
                                    执行任务
                                </Button>
                            </Form.Item>
                        </Form>
                    </Card>
                </Col>
            </Row>

            {result && (
                <Card title="执行结果" style={{ marginTop: 24 }}>
                    <pre style={{ background: 'var(--color-fill-2)', padding: '16px', borderRadius: '4px', overflowX: 'auto' }}>
                        {result}
                    </pre>
                </Card>
            )}
        </div>
    );
}
