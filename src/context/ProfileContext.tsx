"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Message, Modal, Input } from '@arco-design/web-react';

export interface ConfigProfile {
    id: string;
    name: string;
    appId: string;
    appSecret: string;
    permanentCode: string;
    currentOpenUserId: string;
}

export const DEFAULT_PROFILE: ConfigProfile = {
    id: "default",
    name: "默认配置",
    appId: "",
    appSecret: "",
    permanentCode: "",
    currentOpenUserId: ""
};

interface ProfileContextType {
    profiles: ConfigProfile[];
    activeProfileId: string;
    activeProfile: ConfigProfile;
    setActiveProfileId: (id: string) => void;
    updateProfile: (profile: Partial<ConfigProfile>) => Promise<void>;
    addProfile: (profile: Omit<ConfigProfile, 'id'>) => Promise<void>;
    deleteProfile: (id: string) => void;
    saveProfiles: () => void;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

export function ProfileProvider({ children }: { children: React.ReactNode }) {
    const [profiles, setProfiles] = useState<ConfigProfile[]>([DEFAULT_PROFILE]);
    const [activeProfileId, setActiveProfileId] = useState<string>("default");
    const [mobileModalVisible, setMobileModalVisible] = useState(false);
    const [mobileInput, setMobileInput] = useState('');
    const [mobileLoading, setMobileLoading] = useState(false);

    const applyProfiles = useCallback((result: any) => {
        if (Array.isArray(result.profiles) && result.profiles.length > 0) {
            setProfiles(result.profiles);
            if (result.activeProfileId && result.profiles.find((p: any) => p.id === result.activeProfileId)) {
                setActiveProfileId(result.activeProfileId);
            } else {
                setActiveProfileId(result.profiles[0].id);
            }
        }
    }, []);

    const fetchProfiles = useCallback(async (mobile?: string) => {
        try {
            const url = mobile
                ? `/data/api/config/profiles?mobile=${encodeURIComponent(mobile)}`
                : '/data/api/config/profiles';
            const res = await fetch(url);
            const result = await res.json();
            if (result.success) {
                applyProfiles(result);
            } else if (result.needsMobile) {
                setMobileModalVisible(true);
            } else {
                Message.error(result.error || '无法加载配置');
            }
        } catch (e) {
            console.error("Failed to load profiles from server", e);
            Message.error("无法加载服务器配置，请检查网络");
        }
    }, [applyProfiles]);

    // Load profiles from server on mount
    useEffect(() => {
        fetchProfiles();
    }, [fetchProfiles]);

    const handleMobileSubmit = async () => {
        if (!mobileInput.trim()) return;
        setMobileLoading(true);
        try {
            await fetchProfiles(mobileInput.trim());
            setMobileModalVisible(false);
            setMobileInput('');
        } catch (e) {
            Message.error('网络错误，请重试');
        } finally {
            setMobileLoading(false);
        }
    };

    const persistProfiles = async (newProfiles: ConfigProfile[], newActiveId: string) => {
        try {
            console.log("[ProfileContext] Persisting to server...", { profiles: newProfiles, activeProfileId: newActiveId });
            const res = await fetch('/data/api/config/profiles', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    profiles: newProfiles,
                    activeProfileId: newActiveId
                })
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || `Server error: ${res.status}`);
            }
            console.log("[ProfileContext] Successfully saved to server");
        } catch (e) {
            console.error("Failed to save profiles to server", e);
            Message.error("保存配置到服务器失败");
        }
    };

    const activeProfile = profiles.find(p => p.id === activeProfileId) || profiles[0] || DEFAULT_PROFILE;

    const handleUpdateProfile = async (updates: Partial<ConfigProfile>) => {
        console.log("[ProfileContext] Updating profile:", updates);
        const updatedProfiles = profiles.map(p =>
            p.id === activeProfileId ? { ...p, ...updates } : p
        );
        setProfiles(updatedProfiles);

        // Sync to CRM
        const updatedProfile = updatedProfiles.find(p => p.id === activeProfileId);
        if (updatedProfile && activeProfileId !== 'default') {
            try {
                const res = await fetch('/data/api/config/profiles', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ updateProfile: updatedProfile }),
                });
                const result = await res.json();
                if (!result.success) {
                    console.error('[ProfileContext] CRM update failed:', result.error);
                    Message.error('同步 CRM 失败: ' + (result.error || '未知错误'));
                }
            } catch (e) {
                console.error('[ProfileContext] CRM update error:', e);
                Message.error('同步 CRM 失败，请检查网络');
            }
        }
    };

    const handleAddProfile = async (profileData: Omit<ConfigProfile, 'id'>) => {
        const res = await fetch('/data/api/config/profiles', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ profile: profileData }),
        });
        const result = await res.json();
        if (!result.success) {
            throw new Error(result.error || 'CRM 创建失败');
        }
        await fetchProfiles();
        if (result.id) {
            handleSetActiveProfileId(result.id);
        }
    };

    const handleDeleteProfile = (id: string) => {
        if (profiles.length <= 1) {
            Message.warning("至少保留一个配置。");
            return;
        }
        const updatedProfiles = profiles.filter(p => p.id !== id);
        setProfiles(updatedProfiles);

        let nextId = activeProfileId;
        if (activeProfileId === id) {
            nextId = updatedProfiles[0].id;
            setActiveProfileId(nextId);
        }
        persistProfiles(updatedProfiles, nextId);
        Message.success("已删除配置。");
    };

    const saveProfiles = () => {
        persistProfiles(profiles, activeProfileId);
        Message.success("配置已保存到服务器。");
    };

    const handleSetActiveProfileId = (id: string) => {
        setActiveProfileId(id);
        localStorage.setItem("fxcrm_active_profile_id", id);
    };

    return (
        <ProfileContext.Provider value={{
            profiles,
            activeProfileId,
            activeProfile,
            setActiveProfileId: handleSetActiveProfileId,
            updateProfile: handleUpdateProfile,
            addProfile: handleAddProfile,
            deleteProfile: handleDeleteProfile,
            saveProfiles
        }}>
            {children}
            <Modal
                title="请输入您的手机号"
                visible={mobileModalVisible}
                onOk={handleMobileSubmit}
                confirmLoading={mobileLoading}
                onCancel={() => setMobileModalVisible(false)}
                okText="确认"
                cancelText="取消"
            >
                <p style={{ marginBottom: 12, color: 'var(--color-text-2)' }}>
                    请输入您在纷享销客中注册的手机号，用于查询您的账号信息。
                </p>
                <Input
                    placeholder="请输入手机号"
                    value={mobileInput}
                    onChange={setMobileInput}
                    onPressEnter={handleMobileSubmit}
                    maxLength={20}
                />
            </Modal>
        </ProfileContext.Provider>
    );
}

export function useProfiles() {
    const context = useContext(ProfileContext);
    if (context === undefined) {
        throw new Error('useProfiles must be used within a ProfileProvider');
    }
    return context;
}
