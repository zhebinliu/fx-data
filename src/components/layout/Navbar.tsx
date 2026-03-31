"use client";
import React, { useState } from 'react';
import {
    Layout, Breadcrumb, Select, Button, Dropdown, Menu, Space, Typography, Tooltip
} from '@arco-design/web-react';
import {
    IconEdit, IconPlus, IconQuestionCircle, IconUser, IconPoweroff
} from '@arco-design/web-react/icon';
import { useProfiles } from '@/context/ProfileContext';
import { ProfileModal } from '@/components/shared/ProfileModal';
import { HelpModal } from '@/components/shared/HelpModal';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

const { Header } = Layout;
const { Option } = Select;

const routeNames: Record<string, string> = {
    '/': '首页',
    '/import': '数据导入',
    '/data-update': '数据更新',
    '/data-query': '数据查询',
    '/data-processing': '数据处理',
    '/workflows': '自动化工作流',
    '/admin/users': '用户管理',
    '/crm/personnel': '人员管理',
    '/admin/exchange-rates': '汇率管理',
    '/admin/roles': '角色列表',
    '/apl/dashboard': 'APL 工作台',
    '/apl/single': '单条生成',
    '/apl/batch': '批量生成',
    '/apl/history': '历史记录',
    '/apl/settings': '配置管理'
};

export function Navbar() {
    const { profiles, activeProfileId, setActiveProfileId, addProfile } = useProfiles();
    const { user, logout } = useAuth();
    const [modalVisible, setModalVisible] = useState(false);
    const [helpModalVisible, setHelpModalVisible] = useState(false);
    const pathname = usePathname();

    const currentPageName = routeNames[pathname] || '当前页面';

    const handleAddProfile = () => {
        const name = prompt("请输入新配置名称:", "新配置");
        if (name) {
            addProfile(name);
        }
    };

    const userMenu = (
        <Menu>
            <Menu.Item key="1" onClick={logout}>
                <IconPoweroff style={{ marginRight: 8 }} />
                退出登录
            </Menu.Item>
        </Menu>
    );

    return (
        <Header style={{ 
            height: 60, 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            background: 'var(--color-bg-2)', 
            borderBottom: '1px solid var(--color-border)', 
            padding: '0 20px' 
        }}>
            <Breadcrumb>
                <Breadcrumb.Item>纷享销客工具库</Breadcrumb.Item>
                <Breadcrumb.Item>{currentPageName}</Breadcrumb.Item>
            </Breadcrumb>

            <Space size="large">
                <Space>
                    <Typography.Text type="secondary">当前配置:</Typography.Text>
                    <Select
                        value={activeProfileId}
                        onChange={setActiveProfileId}
                        style={{ width: 160 }}
                    >
                        {profiles.map(p => (
                            <Option key={p.id} value={p.id}>{p.name}</Option>
                        ))}
                    </Select>
                    <Tooltip content="修改当前配置">
                        <Button type="text" icon={<IconEdit />} onClick={() => setModalVisible(true)} />
                    </Tooltip>
                </Space>

                <Space>
                    <Button type="text" icon={<IconPlus />} onClick={handleAddProfile}>
                        新建配置
                    </Button>
                    <Tooltip content="配置帮助">
                        <Button type="text" icon={<IconQuestionCircle />} onClick={() => setHelpModalVisible(true)} />
                    </Tooltip>
                </Space>

                <div style={{ width: 1, height: 24, backgroundColor: 'var(--color-border)' }} />

                <Dropdown droplist={userMenu} position="bl">
                    <Button type="text" icon={<IconUser />}>
                        {user?.name || '用户'}
                    </Button>
                </Dropdown>
            </Space>
            
            <ProfileModal visible={modalVisible} onVisibleChange={setModalVisible} />
            <HelpModal visible={helpModalVisible} onCancel={() => setHelpModalVisible(false)} />
        </Header>
    );
}
