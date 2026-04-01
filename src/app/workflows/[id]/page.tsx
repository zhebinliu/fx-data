"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { Layout, Button, Card, Grid, Typography, Steps, Empty, Spin, Message, Space, Divider } from '@arco-design/web-react';
import { IconPlayArrow, IconSave, IconPlus, IconLeft, IconSettings, IconDelete, IconUp, IconDown, IconStorage, IconThunderbolt, IconExport, IconCheckCircle, IconCloseCircle, IconSync } from '@arco-design/web-react/icon';
import { useRouter, useParams } from 'next/navigation';
import { Workflow, WorkflowStep, StepType } from '@/types/workflow';
import { SourceStepConfig } from '@/components/features/workflow/steps/SourceStepConfig';
import { TransformStepConfig } from '@/components/features/workflow/steps/TransformStepConfig';
import { DestinationStepConfig } from '@/components/features/workflow/steps/DestinationStepConfig';
import { ProfileProvider } from '@/context/ProfileContext';
import { useWorkflowRunner, WorkflowLog } from '@/hooks/useWorkflowRunner';
import { Drawer, Timeline } from '@arco-design/web-react';
const TimelineItem = Timeline.Item;

const { Content, Sider } = Layout;
const { Title, Text } = Typography;
const Step = Steps.Step;

export default function WorkflowBuilderPage() {
    const router = useRouter();
    const params = useParams();
    const id = params.id as string;

    const [workflow, setWorkflow] = useState<Workflow | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [logDrawerVisible, setLogDrawerVisible] = useState(false);
    const [activeStepId, setActiveStepId] = useState<string | null>(null);

    const { runWorkflow, status, currentStepId, logs, stepStats } = useWorkflowRunner();
    const isRunning = status === 'RUNNING';

    // Fetch workflow
    useEffect(() => {
        if (id) fetchWorkflow(id);
    }, [id]);

    const fetchWorkflow = async (workflowId: string) => {
        try {
            setLoading(true);
            const res = await fetch('/data/api/workflows');
            const data = await res.json();
            if (data.success) {
                const wf = data.workflows.find((w: any) => w.id === workflowId);
                if (wf) {
                    setWorkflow(wf);
                    if (wf.steps.length > 0) {
                        setActiveStepId(wf.steps[0].id);
                    }
                } else {
                    Message.error("未找到工作流");
                    router.push('/workflows');
                }
            }
        } catch (error) {
            Message.error("网络错误");
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!workflow) return;
        try {
            setSaving(true);
            const res = await fetch('/data/api/workflows', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'save',
                    workflow
                })
            });
            const data = await res.json();
            if (data.success) {
                Message.success("保存成功");
                setWorkflow(data.workflows.find((w: any) => w.id === workflow.id));
            } else {
                Message.error("保存失败");
            }
        } catch (error) {
            Message.error("网络错误");
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteStep = (e: any, stepId: string) => {
        e.stopPropagation();
        if (!workflow) return;
        const updatedSteps = workflow.steps.filter(s => s.id !== stepId);
        setWorkflow({ ...workflow, steps: updatedSteps });
        if (activeStepId === stepId) {
            setActiveStepId(updatedSteps.length > 0 ? updatedSteps[0].id : null);
        }
    };

    const handleMoveStep = (e: any, index: number, direction: number) => {
        e.stopPropagation();
        if (!workflow) return;
        const steps = [...workflow.steps];
        const newIndex = index + direction;

        if (newIndex < 0 || newIndex >= steps.length) return;

        const temp = steps[index];
        steps[index] = steps[newIndex];
        steps[newIndex] = temp;

        setWorkflow({ ...workflow, steps });
    };

    const handleAddStep = (type: StepType) => {
        if (!workflow) return;

        let newStep: WorkflowStep = {
            id: crypto.randomUUID(),
            type,
            name: type === 'SOURCE_DB' ? '加载数据' : (type === 'TRANSFORM_VLOOKUP' ? 'VLookup' : '导出数据'),
            config: {}
        };

        const updatedWorkflow = {
            ...workflow,
            steps: [...workflow.steps, newStep]
        };

        setWorkflow(updatedWorkflow);
        setActiveStepId(newStep.id);
    };

    const handleRun = () => {
        if (!workflow) return;
        setLogDrawerVisible(true);
        runWorkflow(workflow);
    };

    const updateStepConfig = (stepId: string, newConfig: any) => {
        if (!workflow) return;
        const updatedSteps = workflow.steps.map(s =>
            s.id === stepId ? { ...s, config: newConfig } : s
        );
        setWorkflow({ ...workflow, steps: updatedSteps });
    };

    // Render configuration panel based on active step type
    const renderConfigPanel = () => {
        const step = workflow?.steps.find(s => s.id === activeStepId);
        if (!step) return <Empty description="请选择一个步骤进行配置" />;

        return (
            <div className="p-4">
                <Title heading={5}>{step.name} 配置</Title>
                <div className="border border-[var(--color-border-2)] p-6 rounded bg-[var(--color-bg-2)] shadow-sm">
                    {step.type === 'SOURCE_DB' ? (
                        <SourceStepConfig
                            config={step.config}
                            onChange={(newConfig) => {
                                updateStepConfig(step.id, newConfig);
                            }}
                        />
                    ) : step.type.startsWith('TRANSFORM') ? (
                        <TransformStepConfig
                            config={step.config}
                            onChange={(newConfig) => {
                                updateStepConfig(step.id, newConfig);
                            }}
                        />
                    ) : step.type === 'DESTINATION_FXCRM' ? (
                        <DestinationStepConfig
                            config={step.config}
                            onChange={(newConfig) => {
                                updateStepConfig(step.id, newConfig);
                            }}
                        />
                    ) : (
                        <div className="text-[var(--color-text-3)]">
                            <strong>{step.type}</strong> 的配置界面即将推出。
                            <pre className="mt-4 text-xs bg-[var(--color-fill-2)] p-2 rounded">{JSON.stringify(step.config, null, 2)}</pre>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    if (loading) return <div className="flex h-screen items-center justify-center"><Spin /></div>;
    if (!workflow) return null;

    return (
        <ProfileProvider>
            <Layout className="h-[calc(100vh-64px)] -m-6 bg-[var(--color-bg-2)]">
                <div className="bg-[var(--color-bg-2)] border-b border-[var(--color-border-2)] px-6 py-3 flex justify-between items-center shadow-sm z-10">
                    <div className="flex items-center gap-4">
                        <Button icon={<IconLeft />} onClick={() => router.push('/workflows')} />
                        <div>
                            <div className="text-lg font-bold text-[var(--color-text-1)]">{workflow.name}</div>
                            <div className="text-xs text-[var(--color-text-3)]">工作流构建器</div>
                        </div>
                    </div>
                    <Space>
                        <Button icon={<IconSave />} onClick={handleSave} loading={saving} disabled={isRunning}>保存</Button>
                        <Button type="primary" status="success" icon={<IconPlayArrow />} onClick={handleRun} loading={isRunning}>运行工作流</Button>
                    </Space>
                </div>

                <Layout className="flex-1 overflow-hidden">
                    <Sider width={300} className="bg-[var(--color-bg-2)] border-r border-[var(--color-border-2)] flex flex-col h-full" style={{ overflow: 'hidden' }}>
                        {/* Fixed Header */}
                        <div className="p-4 border-b border-[var(--color-border-1)] flex-shrink-0 bg-[var(--color-bg-2)] z-10">
                            <div className="flex justify-between items-center">
                                <Text bold className="text-[var(--color-text-1)]">流程步骤</Text>
                                {/* Simple Dropdown or Modal to add step can be here too */}
                            </div>
                        </div>

                        {/* Scrollable Step List */}
                        <div className="flex-1 overflow-y-auto p-4 scroll-smooth">
                            <Steps direction="vertical" current={workflow.steps.findIndex(s => s.id === activeStepId) + 1} style={{ width: '100%' }}>
                                {workflow.steps.map((step, index) => {
                                    const stats = stepStats[step.id];
                                    let statusIcon = undefined;
                                    let stepStatus: "wait" | "process" | "finish" | "error" = "wait";

                                    if (stats) {
                                        if (stats.status === 'RUNNING') {
                                            statusIcon = <IconSync spin style={{ color: '#165DFF' }} />;
                                            stepStatus = 'process';
                                        } else if (stats.status === 'SUCCESS') {
                                            // The user specifically requested "Green", overriding theme primary color
                                            statusIcon = <IconCheckCircle style={{ color: '#00B42A' }} />;
                                            stepStatus = 'finish';
                                        } else if (stats.status === 'ERROR') {
                                            statusIcon = <IconCloseCircle style={{ color: '#F53F3F' }} />;
                                            stepStatus = 'error';
                                        }
                                    }

                                    return (
                                        <Step
                                            key={step.id}
                                            status={stepStatus}
                                            icon={statusIcon}
                                            title={
                                                <div className="flex justify-between items-center group w-full pr-2">
                                                    <span className="truncate max-w-[120px] text-[var(--color-text-1)]" title={step.name}>{step.name}</span>
                                                    <div className="hidden group-hover:flex gap-1 flex-shrink-0">
                                                        <Button
                                                            icon={<IconUp />}
                                                            size="mini"
                                                            disabled={index === 0}
                                                            onClick={(e) => handleMoveStep(e, index, -1)}
                                                        />
                                                        <Button
                                                            icon={<IconDown />}
                                                            size="mini"
                                                            disabled={index === workflow.steps.length - 1}
                                                            onClick={(e) => handleMoveStep(e, index, 1)}
                                                        />
                                                        <Button
                                                            icon={<IconDelete />}
                                                            size="mini"
                                                            status="danger"
                                                            onClick={(e) => handleDeleteStep(e, step.id)}
                                                        />
                                                    </div>
                                                </div>
                                            }
                                            description={
                                                <div>
                                                    <div className="text-xs">{step.type}</div>
                                                    {stats && stats.status !== 'PENDING' && (
                                                        <div className="text-[10px] mt-1 text-[var(--color-text-3)] bg-[var(--color-fill-2)] px-1 py-0.5 rounded inline-block">
                                                            {stats.status === 'RUNNING' ? '运行中...' :
                                                                `入: ${stats.inputCount} ⮕ 出: ${stats.outputCount}`}
                                                        </div>
                                                    )}
                                                </div>
                                            }
                                            className={`cursor-pointer p-2 rounded hover:bg-[var(--color-fill-2)] ${activeStepId === step.id ? 'bg-[var(--color-primary-light-1)] border-r-2 border-[var(--color-primary-6)]' : ''}`}
                                            onClick={() => setActiveStepId(step.id)}
                                        />
                                    );
                                })}
                            </Steps>

                            {workflow.steps.length === 0 && (
                                <Empty description="暂无步骤" />
                            )}
                        </div>

                        {/* Fixed Bottom Actions */}
                        <div className="p-4 border-t border-[var(--color-border-1)] flex-shrink-0 bg-[var(--color-bg-2)] z-10">
                            <div className="grid grid-cols-1 gap-2">
                                <Button long size="small" onClick={() => handleAddStep('SOURCE_DB')}>+ 添加数据源 (Source)</Button>
                                <Button long size="small" onClick={() => handleAddStep('TRANSFORM_VLOOKUP')}>+ 添加转换 (Transform)</Button>
                                <Button long size="small" onClick={() => handleAddStep('DESTINATION_FXCRM')}>+ 添加导出 (Destination)</Button>
                            </div>
                        </div>
                    </Sider>
                    <Content className="bg-[var(--color-bg-1)] m-4 rounded shadow-sm overflow-y-auto">
                        {renderConfigPanel()}
                    </Content>
                </Layout>
            </Layout>

            <Drawer
                width={500}
                title={
                    <div className="flex items-center justify-between">
                        <span>运行日志</span>
                        {status === 'RUNNING' && <Spin dot />}
                        {status === 'COMPLETED' && <span className="text-green-600 font-bold ml-2">运行成功</span>}
                        {status === 'ERROR' && <span className="text-red-500 font-bold ml-2">运行失败</span>}
                    </div>
                }
                visible={logDrawerVisible}
                onCancel={() => setLogDrawerVisible(false)}
                footer={null}
            >
                <Timeline reverse={false}>
                    {logs.map((log, index) => (
                        <TimelineItem
                            key={index}
                            dotColor={log.type === 'error' ? '#F53F3F' : (log.type === 'success' ? '#00B42A' : '#165DFF')}
                            label={<span className="text-gray-400 text-xs">{new Date(log.timestamp).toLocaleTimeString()}</span>}
                        >
                            <div className={`p-2 rounded ${log.type === 'error' ? 'bg-[var(--color-danger-light-1)] text-[var(--color-danger-6)]' : 'bg-[var(--color-fill-2)] text-[var(--color-text-1)]'}`}>
                                {log.message}
                            </div>
                        </TimelineItem>
                    ))}
                    {logs.length === 0 && <Empty description="暂无日志" />}
                </Timeline>
            </Drawer>
        </ProfileProvider>
    );
}
