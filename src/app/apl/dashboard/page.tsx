"use client";
import React, { useEffect, useState } from 'react';
import { Card, Typography, Grid, Tag, Badge, Button, Message, Spin } from '@arco-design/web-react';
import { fetchProjects, fetchHistory, fetchSession, renewSession, APLProject, APLHistoryItem } from '@/lib/api/apl';

const { Row, Col } = Grid;
const { Title, Text } = Typography;

export default function APLDashboard() {
    const [projects, setProjects] = useState<APLProject[]>([]);
    const [history, setHistory] = useState<APLHistoryItem[]>([]);
    const [sessions, setSessions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState<string | null>(null);

    const loadData = async () => {
        try {
            const [projData, histData, sessData] = await Promise.all([
                fetchProjects(),
                fetchHistory(),
                fetchSession()
            ]);
            setProjects(projData);
            setHistory(histData);
            setSessions(sessData);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleRenewSession = async (project: string) => {
        setRefreshing(project);
        try {
            await renewSession(project);
            Message.success(`项目 ${project} session 刷新成功`);
            await loadData();
        } catch (err: any) {
            Message.error(`刷新失败: ${err.message || err}`);
        } finally {
            setRefreshing(null);
        }
    };

    const handleExportDocs = (project: string) => {
        window.location.href = `/api/apl/functions/export?project=${encodeURIComponent(project)}`;
    };

    const recentTasks = history.length;
    const successTasks = history.filter(h => h.status === 'success').length;
    const failedTasks = history.filter(h => h.status === 'failed').length;

    const sessionMap = new Map<string, any>(sessions.map(s => [s.project, s]));

    if (loading) {
        return <div style={{ padding: '40px', textAlign: 'center' }}><Spin size={32} /></div>;
    }

    return (
        <div style={{ padding: '24px', backgroundColor: '#f5f6fa', minHeight: '100%' }}>
            
            <div style={{ marginBottom: 32, paddingBottom: 16, borderBottom: '1px solid #e5e6eb' }}>
                <Title heading={2} style={{ margin: '0 0 8px 0', fontSize: '24px', fontWeight: 600 }}>纷享销客 APL 工作台</Title>
                <Text type="secondary" style={{ fontSize: '13px' }}>面向实施、顾问和开发同事的一体化控制面板</Text>
            </div>
            
            <Title heading={4} style={{ marginBottom: 16, fontSize: '16px', fontWeight: 600 }}>总览</Title>
            <Row gutter={[16, 16]} style={{ marginBottom: 32 }}>
                {[
                    { label: '项目数', value: projects.length },
                    { label: '最近任务', value: recentTasks },
                    { label: '成功任务', value: successTasks },
                    { label: '失败任务', value: failedTasks },
                ].map((stat, idx) => (
                    <Col xs={12} sm={12} md={6} key={idx}>
                        <Card bordered={true} style={{ borderRadius: 6, borderColor: '#e5e6eb' }} bodyStyle={{ padding: '16px 20px' }}>
                            <Text type="secondary" style={{ fontSize: '13px', display: 'block', marginBottom: 12 }}>{stat.label}</Text>
                            <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#1d2129', lineHeight: 1 }}>{stat.value}</div>
                        </Card>
                    </Col>
                ))}
            </Row>
            
            <Title heading={4} style={{ marginBottom: 16, fontSize: '16px', fontWeight: 600 }}>项目</Title>
            <Row gutter={[16, 16]}>
                {projects.map(p => {
                    const session = sessionMap.get(p.name) || {};
                    const loggedIn = !!session.logged_in;
                    const hasCert = !!p.has_certificate;

                    return (
                        <Col xs={24} sm={12} md={8} lg={6} xl={6} key={p.name} style={{ marginBottom: 24, display: 'flex' }}>
                            <Card 
                                className={`project-card ${p.is_current ? 'current' : ''}`}
                                bordered={!p.is_current}
                                style={{ 
                                    borderColor: p.is_current ? '#ff7d00' : 'var(--color-border)',
                                    width: '100%',
                                    display: 'flex',
                                    flexDirection: 'column'
                                }}
                                bodyStyle={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                    <div style={{ fontSize: '15px', fontWeight: 600, color: '#1d2129' }}>{p.name}</div>
                                    {p.is_current && <Tag color="orangered" size="small" style={{ borderRadius: 2 }}>当前项目</Tag>}
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                                        <Typography.Text type="secondary">登录状态</Typography.Text>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: session.status === 'ok' ? '#00b42a' : '#c9cdd4' }} />
                                            <Typography.Text style={{ fontWeight: 500 }}>
                                                {session.status === 'ok' ? '已登录' : '未登录'}
                                            </Typography.Text>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, alignItems: 'flex-start', flexWrap: 'wrap', gap: 4 }}>
                                        <Typography.Text type="secondary">session 有效期</Typography.Text>
                                        <Typography.Text style={{ fontWeight: 500, textAlign: 'right', fontSize: 13, wordBreak: 'break-all', maxWidth: '100%' }}>
                                            {session.session_valid === true ? '会话有效' : session.session_valid === false || session.session_valid === undefined ? '会话失效' : session.session_valid}
                                        </Typography.Text>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <Typography.Text type="secondary">开发者证书</Typography.Text>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: p.has_certificate ? '#00b42a' : '#c9cdd4' }} />
                                            <Typography.Text style={{ fontWeight: 500 }}>
                                                {p.has_certificate ? '已配置' : '未配置'}
                                            </Typography.Text>
                                        </div>
                                    </div>
                                </div>
                                
                                <div style={{ marginTop: 'auto', paddingTop: 24, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                    <Button 
                                        type="outline" 
                                        size="small" 
                                        style={{ color: '#ff7d00', borderColor: '#ff7d00', borderRadius: 16, backgroundColor: 'transparent', padding: '0 10px', fontSize: '12px' }}
                                        onClick={() => handleRenewSession(p.name)}
                                        loading={refreshing === p.name}
                                    >
                                        更换 session
                                    </Button>
                                    <Button 
                                        type="outline" 
                                        size="small" 
                                        style={{ color: '#ff7d00', borderColor: '#ff7d00', borderRadius: 16, backgroundColor: 'transparent', padding: '0 10px', fontSize: '12px' }}
                                        onClick={() => handleExportDocs(p.name)}
                                    >
                                        导出函数文档
                                    </Button>
                                </div>
                            </Card>
                        </Col>
                    );
                })}
            </Row>
        </div>
    );
}
