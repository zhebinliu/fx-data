"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Message } from '@arco-design/web-react';

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
    updateProfile: (profile: Partial<ConfigProfile>) => void;
    addProfile: (name: string) => void;
    deleteProfile: (id: string) => void;
    saveProfiles: () => void;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

export function ProfileProvider({ children }: { children: React.ReactNode }) {
    const [profiles, setProfiles] = useState<ConfigProfile[]>([DEFAULT_PROFILE]);
    const [activeProfileId, setActiveProfileId] = useState<string>("default");

    // Load profiles from server on mount
    useEffect(() => {
        const fetchProfiles = async () => {
            try {
                const res = await fetch('/api/config/profiles');
                const result = await res.json();

                if (result.success) {
                    if (Array.isArray(result.profiles) && result.profiles.length > 0) {
                        setProfiles(result.profiles);
                        if (result.activeProfileId && result.profiles.find((p: any) => p.id === result.activeProfileId)) {
                            setActiveProfileId(result.activeProfileId);
                        } else {
                            setActiveProfileId(result.profiles[0].id);
                        }
                        console.log("[ProfileContext] Profiles loaded from server:", result.profiles);
                    } else {
                        console.log("[ProfileContext] No profiles on server, using default");
                    }
                }
            } catch (e) {
                console.error("Failed to load profiles from server", e);
                Message.error("无法加载服务器配置，请检查网络");
            }
        };

        fetchProfiles();
    }, []);

    const persistProfiles = async (newProfiles: ConfigProfile[], newActiveId: string) => {
        try {
            console.log("[ProfileContext] Persisting to server...", { profiles: newProfiles, activeProfileId: newActiveId });
            const res = await fetch('/api/config/profiles', {
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

    const handleUpdateProfile = (updates: Partial<ConfigProfile>) => {
        console.log("[ProfileContext] Updating profile:", updates);
        const updatedProfiles = profiles.map(p =>
            p.id === activeProfileId ? { ...p, ...updates } : p
        );
        setProfiles(updatedProfiles);
        // Auto-save to server
        persistProfiles(updatedProfiles, activeProfileId);
    };

    const handleAddProfile = (name: string) => {
        const newProfile = { ...DEFAULT_PROFILE, id: Date.now().toString(), name };
        const updatedProfiles = [...profiles, newProfile];
        setProfiles(updatedProfiles);
        setActiveProfileId(newProfile.id);
        persistProfiles(updatedProfiles, newProfile.id);
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
