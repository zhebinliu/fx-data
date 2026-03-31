"use client";

import React, { useState } from 'react';
import { Layout, Menu, Button, Space, Typography } from '@arco-design/web-react';
import {
    IconHome, IconApps, IconEdit, IconSettings, IconBranch, IconUser,
    IconImport, IconLeft, IconRight, IconSearch, IconTool,
    IconCodeBlock, IconList, IconPlusCircle, IconFolderAdd
} from '@arco-design/web-react/icon';
import { usePathname, useRouter } from 'next/navigation';
import { SettingsModal } from '@/components/shared/SettingsModal';
import { useAuth } from '@/context/AuthContext';
import { PERMISSIONS } from '@/constants';

const { Sider } = Layout;
const MenuItem = Menu.Item;
const SubMenu = Menu.SubMenu;

interface SidebarProps {
    collapsed: boolean;
    setCollapsed: (collapsed: boolean) => void;
}

export function Sidebar({ collapsed, setCollapsed }: SidebarProps) {
    const pathname = usePathname();
    const router = useRouter();
    const [showSettings, setShowSettings] = useState(false);
    const { user } = useAuth();
    
    // Auto-open active submenu on load
    const activeSubkey = pathname.startsWith('/apl') ? 'apl-automation' : 
                         pathname.startsWith('/admin') || pathname.startsWith('/crm') ? 'system-management' : 
                         pathname !== '/' ? 'data-management' : '';
    const [openKeys, setOpenKeys] = useState<string[]>([activeSubkey]);

    const allMenuItems = [
        {
            key: '/',
            icon: <IconHome />,
            label: '首页',
            permission: PERMISSIONS.IMPORT
        },
        {
            key: 'data-management',
            icon: <IconApps />,
            label: '数据管理',
            permission: PERMISSIONS.IMPORT,
            children: [
                { key: '/import', icon: <IconImport />, label: '数据导入', permission: PERMISSIONS.IMPORT },
                { key: '/data-update', icon: <IconEdit />, label: '数据更新', permission: PERMISSIONS.UPDATE },
                { key: '/data-query', icon: <IconSearch />, label: '数据查询', permission: PERMISSIONS.QUERY },
                { key: '/data-processing', icon: <IconTool />, label: '数据处理', permission: PERMISSIONS.PROCESS },
                { key: '/workflows', icon: <IconBranch />, label: '自动化工作流', permission: PERMISSIONS.WORKFLOW },
            ]
        },
        {
            key: 'system-management',
            icon: <IconSettings />,
            label: '后台管理',
            permission: 'admin',
            children: [
                { key: '/crm/personnel', icon: <IconUser />, label: '人员管理', permission: PERMISSIONS.IMPORT },
                { key: '/admin/exchange-rates', icon: <IconSettings />, label: '汇率管理', permission: 'admin' },
                { key: '/admin/roles', icon: <IconUser />, label: '角色列表', permission: 'admin' }
            ]
        },
        {
            key: 'apl-automation',
            icon: <IconCodeBlock />,
            label: 'APL 自动化',
            permission: PERMISSIONS.PROCESS,
            children: [
                { key: '/apl/dashboard', icon: <IconHome />, label: '工作台', permission: PERMISSIONS.PROCESS },
                { key: '/apl/single', icon: <IconPlusCircle />, label: '单条生成', permission: PERMISSIONS.PROCESS },
                { key: '/apl/batch', icon: <IconFolderAdd />, label: '批量生成', permission: PERMISSIONS.PROCESS },
                { key: '/apl/history', icon: <IconList />, label: '历史记录', permission: PERMISSIONS.PROCESS },
                { key: '/apl/settings', icon: <IconSettings />, label: '配置管理', permission: PERMISSIONS.PROCESS }
            ]
        }
    ];

    const generateMenu = (items: any[]) => {
        return items.map(item => {
            if (user?.role !== 'admin' && item.permission && item.permission !== 'public' && !user?.permissions?.includes(item.permission)) {
                return null;
            }

            if (item.children) {
                const visibleChildren = generateMenu(item.children);
                if (visibleChildren.every(child => child === null)) return null;

                return (
                    <SubMenu key={item.key} title={<span>{item.icon} {item.label}</span>}>
                        {visibleChildren}
                    </SubMenu>
                );
            }

            return (
                <MenuItem key={item.key} onClick={() => router.push(item.key)}>
                    {item.icon} {item.label}
                </MenuItem>
            );
        }).filter(Boolean);
    };

    return (
        <Sider
            collapsed={collapsed}
            onCollapse={setCollapsed}
            collapsible
            trigger={null}
            breakpoint="xl"
            style={{ borderRight: '1px solid var(--color-border)' }}
        >
            <div style={{ height: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid var(--color-border)' }}>
                <img src="/image/fxiaoke_logonew.png" alt="Logo" style={{ height: 28, marginRight: collapsed ? 0 : 8 }} />
                {!collapsed && <Typography.Text bold style={{ fontSize: 13, color: 'var(--color-text-2)' }}>技术预览版</Typography.Text>}
            </div>

            <div style={{ height: 'calc(100% - 110px)', overflowY: 'auto' }}>
                <Menu
                    selectedKeys={[pathname]}
                    openKeys={openKeys}
                    onClickSubMenu={(_, openKeys) => setOpenKeys(openKeys)}
                    style={{ width: '100%' }}
                >
                    {generateMenu(allMenuItems)}
                </Menu>
            </div>

            <div style={{ position: 'absolute', bottom: 0, width: '100%', borderTop: '1px solid var(--color-border)' }}>
                <Menu selectedKeys={[]} style={{ width: '100%' }}>
                    {user?.role === 'admin' && (
                        <MenuItem key="/admin/users" onClick={() => router.push('/admin/users')}>
                            <IconUser /> 用户管理
                        </MenuItem>
                    )}
                    <MenuItem key="settings" onClick={() => setShowSettings(true)}>
                        <IconSettings /> 系统设置
                    </MenuItem>
                    <MenuItem key="collapse" onClick={() => setCollapsed(!collapsed)}>
                        {collapsed ? <IconRight /> : <IconLeft />} 收起菜单
                    </MenuItem>
                </Menu>
            </div>

            <SettingsModal visible={showSettings} onCancel={() => setShowSettings(false)} />
        </Sider>
    );
}
