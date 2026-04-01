"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Message } from '@arco-design/web-react';

interface User {
    id: string;
    username: string;
    role: 'admin' | 'user';
    name: string;
    permissions: string[];
    preferences?: {
        theme?: 'light' | 'dark';
        primaryColor?: string;
        aiConfig?: {
            provider?: string;
            apiKey?: string;
            baseUrl?: string;
            model?: string;
        };
    };
}

interface AuthContextType {
    user: User | null;
    loading: boolean;
    login: (user: User) => void;
    logout: () => void;
    refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    const pathname = usePathname();

    const applyPreferences = (prefs?: User['preferences']) => {
        if (!prefs) return;

        // Apply Theme
        if (prefs.theme === 'dark') {
            document.body.setAttribute('arco-theme', 'dark');
        } else {
            document.body.removeAttribute('arco-theme');
        }

        // Apply Color
        if (prefs.primaryColor) {
            const color = prefs.primaryColor;
            const styleId = 'dynamic-theme-color';
            let styleTag = document.getElementById(styleId);
            if (!styleTag) {
                styleTag = document.createElement('style');
                styleTag.id = styleId;
                document.head.appendChild(styleTag);
            }
            styleTag.innerHTML = `
                body { 
                    --arcoblue-6: ${color}; 
                    --primary-6: ${color};
                    --color-primary-6: ${color};
                    --link-6: ${color};
                    --color-link-6: ${color};
                    --color-menu-light-item-text-selected: ${color};
                    --color-menu-dark-item-text-selected: ${color};
                }
                .arco-btn-primary, .arco-radio-checked .arco-radio-mask {
                    background-color: ${color} !important;
                    border-color: ${color} !important;
                }
                .arco-btn-text:hover {
                    background-color: var(--color-fill-2);
                }
                .arco-menu-selected {
                    color: ${color} !important;
                }
                .text-primary {
                    color: ${color} !important;
                }
            `;
        }
    };

    const refreshUser = async () => {
        try {
            const res = await fetch('/data/api/auth/me');
            const data = await res.json();
            if (data.success && data.user) {
                setUser(data.user);
                applyPreferences(data.user.preferences);
            } else {
                setUser(null);
            }
        } catch (e) {
            console.error("Auth check failed", e);
            setUser(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        refreshUser();
    }, []);

    // Protected Route Logic
    useEffect(() => {
        if (!loading) {
            if (!user && pathname !== '/login') {
                router.push('/login');
            } else if (user && pathname === '/login') {
                router.push('/');
            }
            if (user) {
                applyPreferences(user.preferences);
            }
        }
    }, [user, loading, pathname, router]);


    const login = (newUser: User) => {
        setUser(newUser);
        router.push('/');
    };

    const logout = async () => {
        try {
            await fetch('/data/api/auth/logout', { method: 'POST' });
            setUser(null);
            router.push('/login');
            Message.success('已退出登录');
        } catch (e) {
            Message.error('退出失败');
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-1)]">
                <div className="flex flex-col items-center">
                    <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    <div className="mt-4 text-gray-500">Loading...</div>
                </div>
            </div>
        );
    }

    return (
        <AuthContext.Provider value={{ user, loading, login, logout, refreshUser }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
