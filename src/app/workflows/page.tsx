"use client";

import React, { useEffect, useState } from 'react';
import { Layout, Button, Card, Grid, Typography, Empty, Spin, Message, Modal, Input } from '@arco-design/web-react';
import { IconPlus, IconMindMapping, IconDelete, IconEdit } from '@arco-design/web-react/icon';
import { useRouter } from 'next/navigation';
import { Workflow } from '@/types/workflow';

const { Content } = Layout;
const { Row, Col } = Grid;
const { Title, Text } = Typography;

export default function WorkflowsPage() {
    const router = useRouter();
    const [workflows, setWorkflows] = useState<Workflow[]>([]);
    const [loading, setLoading] = useState(true);
    const [createModalVisible, setCreateModalVisible] = useState(false);
    const [newWorkflowName, setNewWorkflowName] = useState("");

    // Fetch workflows
    useEffect(() => {
        fetchWorkflows();
    }, []);

    const fetchWorkflows = async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/workflows');
            const data = await res.json();
            if (data.success) {
                setWorkflows(data.workflows);
            } else {
                Message.error(data.error || "加载工作流失败");
            }
        } catch (error) {
            Message.error("网络错误");
        } finally {
            setLoading(false);
        }
    };

    const handleCreateWorkflow = async () => {
        if (!newWorkflowName.trim()) {
            Message.warning("请输入工作流名称");
            return;
        }
        try {
            const res = await fetch('/api/workflows', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'save',
                    workflow: {
                        name: newWorkflowName,
                        steps: []
                    }
                })
            });
            const data = await res.json();
            if (data.success) {
                Message.success("工作流创建成功");
                setCreateModalVisible(false);
                setNewWorkflowName("");
                fetchWorkflows();
            } else {
                Message.error(data.error || "创建工作流失败");
            }
        } catch (error) {
            Message.error("创建工作流失败");
        }
    };

    const handleDelete = async (e: any, id: string) => {
        e.stopPropagation();
        Modal.confirm({
            title: '删除工作流',
            content: '确定要删除这个工作流吗？此操作无法撤销。',
            onOk: async () => {
                try {
                    const res = await fetch('/api/workflows', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'delete', id })
                    });
                    const data = await res.json();
                    if (data.success) {
                        Message.success("删除成功");
                        fetchWorkflows();
                    }
                } catch (error) {
                    Message.error("删除失败");
                }
            }
        });
    };

    return (
        <Layout className="h-screen bg-[var(--color-bg-1)] p-6 overflow-auto">
            <div className="max-w-6xl mx-auto w-full">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <Title heading={3} className="!m-0 flex items-center gap-2">
                            <IconMindMapping className="text-[var(--color-primary-6)]" />
                            自动化工作流
                        </Title>
                        <Text type="secondary">构建和管理自动化数据处理管道。</Text>
                    </div>
                    <Button type="primary" icon={<IconPlus />} onClick={() => setCreateModalVisible(true)}>
                        新建工作流
                    </Button>
                </div>

                {loading ? (
                    <div className="flex justify-center p-12">
                        <Spin dot />
                    </div>
                ) : workflows.length === 0 ? (
                    <div className="bg-[var(--color-bg-2)] rounded p-12 flex justify-center">
                        <Empty description="暂无工作流，请点击右上角新建" />
                    </div>
                ) : (
                    <Row gutter={[24, 24]}>
                        {workflows.map(wf => (
                            <Col key={wf.id} xs={24} sm={12} md={8} lg={8} xl={6}>
                                <Card
                                    hoverable
                                    className="cursor-pointer transition-all hover:-translate-y-1"
                                    onClick={() => router.push(`/workflows/${wf.id}`)}
                                    actions={[
                                        <Button key="run" type="text" size="small" icon={<IconMindMapping />}>运行</Button>,
                                        <Button key="delete" type="text" status="danger" size="small" icon={<IconDelete />} onClick={(e) => handleDelete(e, wf.id)}>删除</Button>
                                    ]}
                                >
                                    <Card.Meta
                                        title={<div className="font-bold truncate" title={wf.name}>{wf.name}</div>}
                                        description={
                                            <div className="text-xs text-[var(--color-text-3)] mt-2 h-[40px]">
                                                {wf.steps.length} 个步骤 • 更新于 {new Date(wf.updatedAt).toLocaleDateString()}
                                            </div>
                                        }
                                    />
                                </Card>
                            </Col>
                        ))}
                    </Row>
                )}
            </div>

            <Modal
                title="新建工作流"
                visible={createModalVisible}
                onOk={handleCreateWorkflow}
                onCancel={() => setCreateModalVisible(false)}
                autoFocus={false}
                focusLock={true}
            >
                <div className="mb-2">工作流名称</div>
                <Input
                    placeholder="例如：每月销售数据导入"
                    value={newWorkflowName}
                    onChange={setNewWorkflowName}
                    onPressEnter={handleCreateWorkflow}
                />
            </Modal>
        </Layout>
    );
}
