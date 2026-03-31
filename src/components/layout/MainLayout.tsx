"use client";

import React from 'react';
import { Layout } from '@arco-design/web-react';
import { Sidebar } from "@/components/layout/Sidebar";
import { Navbar } from "@/components/layout/Navbar";
import { AuthProvider } from "@/context/AuthContext";
import { ProfileProvider } from "@/context/ProfileContext";
import { AIChatWidget } from "@/components/shared/AIChatWidget";
import { usePathname } from 'next/navigation';

export function MainLayout({ children }: { children: React.ReactNode }) {
    const [collapsed, setCollapsed] = React.useState(false);
    const pathname = usePathname();
    const isLoginPage = pathname === '/login';

    if (isLoginPage) {
        return (
            <AuthProvider>
                {children}
            </AuthProvider>
        );
    }

    return (
        <AuthProvider>
            <ProfileProvider>
                <Layout style={{ minHeight: '100vh' }} hasSider>
                    <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />
                    <Layout>
                        <Navbar />
                        <Layout.Content style={{ margin: '16px', backgroundColor: 'var(--color-bg-1)' }}>
                            {children}
                        </Layout.Content>
                    </Layout>
                    <AIChatWidget />
                </Layout>
            </ProfileProvider>
        </AuthProvider>
    );
}
