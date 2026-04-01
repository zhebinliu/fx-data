"use client";

import React, { useEffect, useState } from 'react';
import { Card, Grid, Statistic, Button, Typography, Skeleton, Space, Link } from '@arco-design/web-react';
import { IconStorage, IconSettings, IconFile, IconImport, IconRight } from '@arco-design/web-react/icon';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

const { Row, Col } = Grid;
const { Title, Paragraph } = Typography;

export default function Dashboard() {
    const router = useRouter();
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        profiles: 0,
        dbConnections: 0,
        workflows: 0
    });

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await fetch('/data/api/dashboard/stats');
                const data = await res.json();
                if (data.success) {
                    setStats(data.stats);
                }
            } catch (error) {
                console.error("Failed to fetch dashboard stats", error);
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
    }, []);

    const QuickActionCard = ({ title, icon, description, onClick, color }: any) => (
        <Card
            hoverable
            className="cursor-pointer transition-all hover:translate-y-[-2px]"
            onClick={onClick}
            bordered={false}
            style={{ height: '100%', background: 'var(--color-bg-2)', borderRadius: 8 }}
        >
            <div className="flex items-start gap-4">
                <div
                    className="p-3 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: `var(--color-${color}-light-1)`, color: `rgb(var(--${color}-6))` }}
                >
                    {React.cloneElement(icon, { style: { fontSize: 24 } })}
                </div>
                <div className="flex-1">
                    <Title heading={6} style={{ marginTop: 0, marginBottom: 4 }}>{title}</Title>
                    <Paragraph type="secondary" className="text-xs mb-0" style={{ fontSize: 13 }}>
                        {description}
                    </Paragraph>
                </div>
                <div className="flex items-center justify-center h-full pt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <IconRight />
                </div>
            </div>
        </Card>
    );

    return (
        <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8">
            {/* Header Section */}
            <div>
                <Title heading={3} style={{ marginBottom: 4 }}>
                    欢迎回来, {user?.name || '用户'} 👋
                </Title>
                <Paragraph type="secondary">
                    这里是您的 FxCRM 数据集成控制台。您可以查看概览或快速开始任务。
                </Paragraph>
            </div>

            {/* Stats Overview */}
            <Row gutter={[24, 24]}>
                <Col xs={24} md={8}>
                    <Card bordered={false} className="shadow-sm rounded-lg" style={{ background: 'linear-gradient(135deg, #E8FFFB 0%, #F5F7FA 100%)' }}>
                        <Statistic
                            title="配置档案"
                            value={stats.profiles}
                            loading={loading}
                            groupSeparator
                            prefix={<IconSettings style={{ color: '#00B42A' }} />}
                            styleValue={{ color: '#00B42A', fontWeight: 600 }}
                        />
                    </Card>
                </Col>
                <Col xs={24} md={8}>
                    <Card bordered={false} className="shadow-sm rounded-lg" style={{ background: 'linear-gradient(135deg, #E8F3FF 0%, #F5F7FA 100%)' }}>
                        <Statistic
                            title="数据库连接"
                            value={stats.dbConnections}
                            loading={loading}
                            groupSeparator
                            prefix={<IconStorage style={{ color: '#165DFF' }} />}
                            styleValue={{ color: '#165DFF', fontWeight: 600 }}
                        />
                    </Card>
                </Col>
                <Col xs={24} md={8}>
                    <Card bordered={false} className="shadow-sm rounded-lg" style={{ background: 'linear-gradient(135deg, #FFF7E8 0%, #F5F7FA 100%)' }}>
                        <Statistic
                            title="工作流"
                            value={stats.workflows}
                            loading={loading}
                            groupSeparator
                            prefix={<IconFile style={{ color: '#FF7D00' }} />}
                            styleValue={{ color: '#FF7D00', fontWeight: 600 }}
                        />
                    </Card>
                </Col>
            </Row>

            <div className="my-8">
                <Title heading={5}>快速开始</Title>
            </div>

            {/* Quick Actions */}
            <Row gutter={[24, 24]} className="group-hover-container">
                <Col xs={24} sm={12} lg={8}>
                    <QuickActionCard
                        title="数据导入"
                        icon={<IconImport />}
                        color="arcoblue"
                        description="从 Excel、CSV 或数据库导入数据到 FxCRM 对象。"
                        onClick={() => router.push('/import')}
                    />
                </Col>
                <Col xs={24} sm={12} lg={8}>
                    <QuickActionCard
                        title="工作流自动化"
                        icon={<IconFile />}
                        color="orange"
                        description="创建和管理自动化数据处理和同步任务。"
                        onClick={() => router.push('/workflows')}
                    />
                </Col>
                <Col xs={24} sm={12} lg={8}>
                    <QuickActionCard
                        title="连接管理"
                        icon={<IconStorage />}
                        color="green"
                        description="配置外部数据库连接源以供导入使用。"
                        // Assuming this opens a modal or goes to a settings page. For now, maybe just stay or go to import?
                        // Let's go to import page with a query param or just import since that's where DB config is currently.
                        onClick={() => router.push('/import')}
                    />
                </Col>
            </Row>

        </div>
    );
}
