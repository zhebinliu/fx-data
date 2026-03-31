"use client";
import React, { useEffect, useState } from 'react';
import { Typography, Card, Form, Select, Input, Button, Table, Badge, Grid, Space, Message, Modal } from '@arco-design/web-react';
import { fetchProjects, fetchHistory, APLProject, APLHistoryItem } from '@/lib/api/apl';

const { Title } = Typography;
const { Row, Col } = Grid;
const { Option } = Select;
const FormItem = Form.Item;

export default function APLHistory() {
    const [history, setHistory] = useState<APLHistoryItem[]>([]);
    const [projects, setProjects] = useState<APLProject[]>([]);
    const [loading, setLoading] = useState(false);
    const [form] = Form.useForm();
    const [filters, setFilters] = useState<Record<string, string>>({});
    
    // Log modal state
    const [logVisible, setLogVisible] = useState(false);
    const [logTitle, setLogTitle] = useState('');
    const [logContent, setLogContent] = useState('');

    const loadData = async (currentFilters: Record<string, string> = filters) => {
        setLoading(true);
        try {
            const h = await fetchHistory(currentFilters);
            setHistory(h);
        } catch (err: any) {
            Message.error(`加载历史记录失败: ${err.message || err}`);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProjects().then(setProjects).catch(console.error);
        loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const onSearch = (values: any) => {
        const newFilters: Record<string, string> = {};
        for (const [k, v] of Object.entries(values)) {
            if (v) newFilters[k] = String(v);
        }
        setFilters(newFilters);
        loadData(newFilters);
    };

    const handleViewLog = async (taskId: string, title: string) => {
        setLogTitle(title);
        setLogContent('加载中...');
        setLogVisible(true);
        try {
            const res = await fetch(`/api/apl/tasks/${taskId}/log`);
            const text = await res.text();
            setLogContent(text || '暂无日志');
        } catch (err: any) {
            setLogContent(`加载日志失败: ${err.message || err}`);
        }
    };

    const handleRerun = async (taskId: string) => {
        try {
            await fetch(`/api/apl/tasks/${taskId}/rerun`, { method: 'POST', body: JSON.stringify({}) });
            Message.success('重新执行已按计划启动');
            loadData();
        } catch (err: any) {
            Message.error(`重新执行失败: ${err.message || err}`);
        }
    };

    // Prepare table data with grouped rows mimicking the original python ui
    const tableData: any[] = [];
    let lastProject = '';
    history.forEach((task) => {
        const project = task.req_snapshot?.project || '-';
        if (project !== lastProject) {
            tableData.push({ isGroupRow: true, project, id: `group-${project}-${task.id}` });
            lastProject = project;
        }
        tableData.push({ ...task, isGroupRow: false });
    });

    const columns = [
        {
            title: '项目',
            dataIndex: 'project',
            render: (col: any, record: any) => {
                if (record.isGroupRow) {
                    return {
                        children: <div style={{ fontWeight: 600, color: '#1d2129' }}>{record.project}</div>,
                        props: { colSpan: 8 }
                    };
                }
                return record.req_snapshot?.project || '-';
            }
        },
        {
            title: '任务类型',
            dataIndex: 'kind',
            render: (col: any, record: any) => {
                if (record.isGroupRow) return { props: { colSpan: 0 } };
                if (col === 'single') return '单条生成';
                if (col === 'batch') return '批量生成';
                if (col === 'batch_upload') return '模板批量';
                return col || '-';
            }
        },
        {
            title: '状态',
            dataIndex: 'status',
            render: (col: any, record: any) => {
                if (record.isGroupRow) return { props: { colSpan: 0 } };
                if (col === 'success') return <Badge status="success" text="成功" />;
                if (col === 'failed') return <Badge status="error" text="失败" />;
                return <Badge status="processing" text="执行中" />;
            }
        },
        {
            title: '开始时间',
            dataIndex: 'started_at',
            render: (col: any, record: any) => {
                if (record.isGroupRow) return { props: { colSpan: 0 } };
                return col || '-';
            }
        },
        {
            title: '编译结果',
            dataIndex: 'compile_message',
            render: (col: any, record: any) => {
                if (record.isGroupRow) return { props: { colSpan: 0 } };
                return col || '-';
            }
        },
        {
            title: '部署结果',
            dataIndex: 'deploy_message',
            render: (col: any, record: any) => {
                if (record.isGroupRow) return { props: { colSpan: 0 } };
                return col || '-';
            }
        },
        {
            title: '系统 API',
            dataIndex: 'api_name',
            render: (col: any, record: any) => {
                if (record.isGroupRow) return { props: { colSpan: 0 } };
                return col || '-';
            }
        },
        {
            title: '操作',
            dataIndex: 'actions',
            render: (col: any, record: any) => {
                if (record.isGroupRow) return { props: { colSpan: 0 } };
                return (
                    <Space size="medium">
                        <Button type="text" size="small" style={{ padding: 0, color: '#ff7d00' }}>查看函数</Button>
                        {record.status === 'failed' && (
                            <Button type="text" size="small" style={{ padding: 0, color: '#ff7d00' }} onClick={() => handleRerun(record.id)}>重新执行</Button>
                        )}
                        {record.api_name && (
                            <Button type="text" size="small" style={{ padding: 0, color: '#ff7d00' }}>运行日志</Button>
                        )}
                        <Button type="text" size="small" style={{ padding: 0, color: '#ff7d00' }} onClick={() => handleViewLog(record.id, record.title || '任务日志')}>执行日志</Button>
                    </Space>
                );
            }
        }
    ];

    return (
        <div style={{ padding: '24px', backgroundColor: '#f5f6fa', minHeight: '100%' }}>
            <div style={{ marginBottom: 24 }}>
                <Title heading={3} style={{ margin: 0 }}>历史记录</Title>
            </div>

            <Card bordered={false} style={{ marginBottom: 16 }}>
                <Form form={form} layout="vertical" onSubmit={onSearch}>
                    <Grid.Row gutter={24}>
                        <Grid.Col span={4}>
                            <FormItem label="项目" field="project">
                                <Select placeholder="全部">
                                    <Option value="">全部</Option>
                                    {projects.map(p => <Option key={p.name} value={p.name}>{p.name}</Option>)}
                                </Select>
                            </FormItem>
                        </Grid.Col>
                        <Grid.Col span={4}>
                            <FormItem label="任务类型" field="kind">
                                <Select placeholder="全部">
                                    <Option value="">全部</Option>
                                    <Option value="single">单条生成</Option>
                                    <Option value="batch">批量生成</Option>
                                    <Option value="batch_upload">模板批量</Option>
                                </Select>
                            </FormItem>
                        </Grid.Col>
                        <Grid.Col span={4}>
                            <FormItem label="执行状态" field="status">
                                <Select placeholder="全部">
                                    <Option value="">全部</Option>
                                    <Option value="running">执行中</Option>
                                    <Option value="success">成功</Option>
                                    <Option value="failed">失败</Option>
                                </Select>
                            </FormItem>
                        </Grid.Col>
                        <Grid.Col span={4}>
                            <FormItem label="API名称关键字" field="api_name">
                                <Input placeholder="请输入..." allowClear />
                            </FormItem>
                        </Grid.Col>
                        <Grid.Col span={4} style={{ display: 'flex', alignItems: 'center' }}>
                            <Space style={{ marginTop: 12 }}>
                                <Button type="primary" htmlType="submit">查询</Button>
                                <Button onClick={() => { form.resetFields(); onSearch({}); }}>重置</Button>
                            </Space>
                        </Grid.Col>
                    </Grid.Row>
                </Form>
            </Card>

            <Card bordered={false}>
                <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
                    <Typography.Text type="secondary">
                        当前显示全部记录，共 {tableData.filter(d => !d.isGroupRow).length} 条
                    </Typography.Text>
                    <Button onClick={() => loadData()}>刷新</Button>
                </div>
                <Table 
                    columns={columns} 
                    data={tableData} 
                    rowKey="id"
                    loading={loading}
                    pagination={{ pageSize: 20 }}
                    rowClassName={(record) => record.isGroupRow ? 'history-group-row' : ''}
                />
            </Card>

            <Modal 
                title={logTitle} 
                visible={logVisible} 
                onCancel={() => setLogVisible(false)}
                footer={null}
                style={{ width: 800 }}
            >
                <div style={{ 
                    backgroundColor: '#1d2129', 
                    color: '#c9cdd4', 
                    padding: 16, 
                    borderRadius: 4, 
                    maxHeight: 500, 
                    overflowY: 'auto',
                    fontFamily: 'monospace',
                    whiteSpace: 'pre-wrap'
                }}>
                    {logContent}
                </div>
            </Modal>
            
            <style dangerouslySetInnerHTML={{__html: `
                .history-group-row td {
                    background-color: #f2f3f5 !important;
                }
            `}} />
        </div>
    );
}
