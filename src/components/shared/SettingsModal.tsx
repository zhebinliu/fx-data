
import React, { useEffect, useState } from 'react';
import { Modal, Radio, Typography, Divider, Message } from '@arco-design/web-react';
import { IconMoon, IconSun, IconSkin } from '@arco-design/web-react/icon';
import { useAuth } from '@/context/AuthContext';

const { Title } = Typography;

interface SettingsModalProps {
    visible: boolean;
    onCancel: () => void;
}

export function SettingsModal({ visible, onCancel }: SettingsModalProps) {
    const [user, setUser] = useState<any>(null); // Local user state for comparison
    const { user: contextUser, refreshUser } = useAuth();
    const [theme, setTheme] = useState<'light' | 'dark'>('light');
    const [primaryColor, setPrimaryColor] = useState<string>('#165DFF');
    const [aiConfig, setAiConfig] = useState<any>({});

    useEffect(() => {
        if (visible && contextUser && contextUser.preferences) {
            if (contextUser.preferences.theme) setTheme(contextUser.preferences.theme);
            if (contextUser.preferences.primaryColor) setPrimaryColor(contextUser.preferences.primaryColor);
            if (contextUser.preferences.aiConfig) setAiConfig(contextUser.preferences.aiConfig);
        }
    }, [visible, contextUser]);

    const applyTheme = (t: 'light' | 'dark') => {
        if (t === 'dark') {
            document.body.setAttribute('arco-theme', 'dark');
        } else {
            document.body.removeAttribute('arco-theme');
        }
    };

    const applyColor = (color: string) => {
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
    };

    const saveSettings = async (newTheme?: string, newColor?: string) => {
        try {
            await fetch('/api/auth/profile', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    theme: newTheme || theme,
                    primaryColor: newColor || primaryColor,
                    aiConfig: aiConfig
                })
            });
            await refreshUser();
            Message.success('设置已保存');
        } catch (e) {
            Message.error('保存设置失败');
        }
    };

    const handleThemeChange = (val: 'light' | 'dark') => {
        setTheme(val);
        applyTheme(val);
        saveSettings(val, undefined);
    };

    const handleColorChange = (color: string) => {
        setPrimaryColor(color);
        applyColor(color);
        saveSettings(undefined, color);
    };

    const colors = [
        '#165DFF', // Blue (Default)
        '#F53F3F', // Red
        '#00B42A', // Green
        '#FF7D00', // Orange
        '#722ED1', // Purple
        '#86909C', // Gray
    ];

    return (
        <Modal
            title={<span><IconSkin className="mr-2" /> 系统设置</span>}
            visible={visible}
            onOk={onCancel}
            onCancel={onCancel}
            okText="关闭"
            hideCancel
            style={{ width: 500 }}
        >
            <div>
                <Title heading={6}>界面模式</Title>
                <div className="flex gap-4 mt-2 mb-6">
                    <div
                        className={`cursor-pointer border rounded p-4 flex flex-col items-center gap-2 w-1/2 transition-all ${theme === 'light' ? 'border-[var(--color-primary-6)] bg-[var(--color-primary-light-1)] text-[var(--color-primary-6)]' : 'border-[var(--color-border-2)] text-[var(--color-text-2)]'}`}
                        onClick={() => handleThemeChange('light')}
                    >
                        <IconSun style={{ fontSize: 24 }} />
                        <span>浅色模式</span>
                    </div>
                    <div
                        className={`cursor-pointer border rounded p-4 flex flex-col items-center gap-2 w-1/2 transition-all ${theme === 'dark' ? 'border-[var(--color-primary-6)] bg-[var(--color-primary-light-1)] text-[var(--color-primary-6)]' : 'border-[var(--color-border-2)] text-[var(--color-text-2)]'}`}
                        onClick={() => handleThemeChange('dark')}
                    >
                        <IconMoon style={{ fontSize: 24 }} />
                        <span>深色模式</span>
                    </div>
                </div>

                <Divider />

                <Title heading={6}>主题色</Title>
                <div className="flex gap-3 mt-2 flex-wrap mb-6">
                    {colors.map(c => (
                        <div
                            key={c}
                            className={`w-8 h-8 rounded-full cursor-pointer flex items-center justify-center transition-transform hover:scale-110`}
                            style={{
                                backgroundColor: c,
                                boxShadow: primaryColor === c ? `0 0 0 2px var(--color-bg-2), 0 0 0 4px ${c}` : 'none'
                            }}
                            onClick={() => handleColorChange(c)}
                        />
                    ))}
                </div>

                <Divider />

                <Title heading={6}>AI 助手配置</Title>
                <div className="mt-2 flex flex-col gap-3">
                    <div className="flex gap-4 mb-2">
                        <Radio.Group
                            type="button"
                            value={aiConfig?.provider || 'custom'}
                            onChange={(val) => {
                                let newConfig = { ...aiConfig, provider: val };
                                if (val === 'qwen') {
                                    newConfig.baseUrl = "https://dashscope.aliyuncs.com/compatible-mode/v1";
                                    newConfig.model = "qwen-plus";
                                } else if (val === 'openai') {
                                    newConfig.baseUrl = "https://api.openai.com/v1";
                                    newConfig.model = "gpt-3.5-turbo";
                                }
                                setAiConfig(newConfig);
                            }}
                        >
                            <Radio value="openai">OpenAI</Radio>
                            <Radio value="qwen">通义千问 (DashScope)</Radio>
                            <Radio value="custom">自定义</Radio>
                        </Radio.Group>
                    </div>

                    <div>
                        <Typography.Text type="secondary" className="block text-xs mb-1">API 接口地址 (Base URL)</Typography.Text>
                        <input
                            type="text"
                            className="w-full border border-[var(--color-border-3)] rounded px-2 py-1.5 text-sm bg-[var(--color-bg-2)] text-[var(--color-text-1)] focus:border-[var(--color-primary-6)] outline-none transition-colors"
                            placeholder="https://api.openai.com/v1"
                            value={aiConfig?.baseUrl || ''}
                            onChange={(e) => setAiConfig({ ...aiConfig, baseUrl: e.target.value, provider: 'custom' })}
                        />
                    </div>
                    <div>
                        <Typography.Text type="secondary" className="block text-xs mb-1">API Key</Typography.Text>
                        <input
                            type="password"
                            className="w-full border border-[var(--color-border-3)] rounded px-2 py-1.5 text-sm bg-[var(--color-bg-2)] text-[var(--color-text-1)] focus:border-[var(--color-primary-6)] outline-none transition-colors"
                            placeholder="sk-..."
                            value={aiConfig?.apiKey || ''}
                            onChange={(e) => setAiConfig({ ...aiConfig, apiKey: e.target.value })}
                        />
                    </div>
                    <div>
                        <Typography.Text type="secondary" className="block text-xs mb-1">模型名称 (Model Name)</Typography.Text>
                        {aiConfig?.provider === 'qwen' ? (
                            <select
                                className="w-full border border-[var(--color-border-3)] rounded px-2 py-1.5 text-sm bg-[var(--color-bg-2)] text-[var(--color-text-1)] focus:border-[var(--color-primary-6)] outline-none transition-colors"
                                value={aiConfig?.model || 'qwen-plus'}
                                onChange={(e) => setAiConfig({ ...aiConfig, model: e.target.value })}
                            >
                                <option value="qwen-plus">qwen-plus (均衡)</option>
                                <option value="qwen-turbo">qwen-turbo (快速)</option>
                                <option value="qwen-max">qwen-max (高性能)</option>
                                <option value="qwen-long">qwen-long (长文本)</option>
                            </select>
                        ) : (
                            <input
                                type="text"
                                className="w-full border border-[var(--color-border-3)] rounded px-2 py-1.5 text-sm bg-[var(--color-bg-2)] text-[var(--color-text-1)] focus:border-[var(--color-primary-6)] outline-none transition-colors"
                                placeholder="gpt-3.5-turbo"
                                value={aiConfig?.model || ''}
                                onChange={(e) => setAiConfig({ ...aiConfig, model: e.target.value, provider: 'custom' })}
                            />
                        )}
                    </div>
                    <div className="flex justify-end mt-2">
                        <button
                            className="bg-[var(--color-primary-6)] text-white px-3 py-1.5 rounded text-sm hover:bg-[var(--color-primary-5)] transition-colors"
                            onClick={() => saveSettings()}
                        >
                            保存配置
                        </button>
                    </div>
                </div>
            </div>
        </Modal>
    );
}
