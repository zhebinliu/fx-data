import React, { useState, useRef, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Button, Input, List, Avatar, Typography, Trigger, Spin } from '@arco-design/web-react';
import { IconMessage, IconClose, IconSend, IconRobot, IconUser } from '@arco-design/web-react/icon';
import ReactMarkdown from 'react-markdown';

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

export function AIChatWidget() {
    const pathname = usePathname();
    const [visible, setVisible] = useState(false);
    const [input, setInput] = useState("");
    const [messages, setMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const getPageContext = (path: string) => {
        if (path === '/') return "Dashboard / Home";
        if (path.startsWith('/import')) return "Data Import: Upload and map Excel files to CRM objects.";
        if (path.startsWith('/data-processing')) return "Data Processing: Batch operations, VLookup, and data cleaning.";
        if (path.startsWith('/data-query')) return "Data Query: Search and filter CRM records using FQL.";
        if (path.startsWith('/data-update')) return "Data Update: Batch update existing records.";
        if (path.startsWith('/workflows')) return "Workflows: Build and manage automated data pipelines.";
        if (path.startsWith('/admin')) return "Admin: User management and system configuration.";
        return "Unknown Page";
    };

    const getSystemPrompt = () => {
        return `You are an expert CRM delivery assistant specializing in FxCRM, with deep hands-on experience delivering CRM solutions in the medical and manufacturing industries. You possess strong industry knowledge, best practices, and implementation expertise across these sectors.
        
System Capabilities:
1. Data Import: Import Excel/CSV data.
2. Data Update: Batch update records.
3. Data Query: Search CRM objects.
4. Workflows: Automate ETL tasks.

Current User Context:
- Current Page: ${pathname}
- Page Function: ${getPageContext(pathname)}

Please provide helpful advice based on the current page and system capabilities. If the user asks about the current page, explain what they can do here.`;
    };

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim() || loading) return;

        const userMsg = input.trim();
        const newMessages: Message[] = [...messages, { role: 'user', content: userMsg }];

        setMessages(newMessages);
        setInput("");
        setLoading(true);

        const systemPrompt = getSystemPrompt();

        try {
            const res = await fetch('/api/ai/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: newMessages,
                    systemPrompt: systemPrompt
                })
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || res.statusText);
            }

            if (!res.body) throw new Error("No response body");

            // Prepare assistant message placeholder
            setMessages(prev => [...prev, { role: 'assistant', content: "" }]);

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let done = false;
            let assistantText = "";

            while (!done) {
                const { value, done: doneReading } = await reader.read();
                done = doneReading;
                const chunkValue = decoder.decode(value, { stream: !done });

                // Parse SSE data
                // Format is usually "data: {...}\n\n"
                // But OpenAI returns chunks like: data: {"id":..., "choices":[{"delta":{"content":"..."}}]}

                const lines = chunkValue.split('\n');
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const dataStr = line.slice(6);
                        if (dataStr === '[DONE]') continue;
                        try {
                            const data = JSON.parse(dataStr);
                            const content = data.choices[0]?.delta?.content || "";
                            if (content) {
                                assistantText += content;
                                setMessages(prev => {
                                    const others = prev.slice(0, -1);
                                    return [...others, { role: 'assistant', content: assistantText }];
                                });
                            }
                        } catch (e) { }
                    }
                }
            }

        } catch (e: any) {
            setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${e.message}` }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed bottom-8 right-8 z-50 flex flex-col items-end gap-4">
            {/* Chat Window */}
            {visible && (
                <div className="w-[380px] h-[500px] bg-[var(--color-bg-2)] border border-[var(--color-border-2)] rounded-lg shadow-xl flex flex-col overflow-hidden animate-fade-in origin-bottom-right transition-all">
                    {/* Header */}
                    <div className="bg-[var(--color-primary-6)] p-3 flex justify-between items-center text-white">
                        <div className="flex items-center gap-2">
                            <IconRobot />
                            <span className="font-bold">实施 AI 助手</span>
                        </div>
                        <IconClose className="cursor-pointer hover:opacity-80" onClick={() => setVisible(false)} />
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-4 bg-[var(--color-fill-1)]">
                        {messages.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-60">
                                <IconRobot style={{ fontSize: 48, marginBottom: 12 }} />
                                <p className="text-sm">有什么可以帮您？</p>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-4">
                                {messages.map((msg, idx) => (
                                    <div key={idx} className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                                        <Avatar
                                            size={28}
                                            style={{ backgroundColor: msg.role === 'user' ? '#165DFF' : '#00B42A' }}
                                        >
                                            {msg.role === 'user' ? <IconUser /> : <IconRobot />}
                                        </Avatar>
                                        <div className={`p-2 rounded-lg text-sm max-w-[80%] ${msg.role === 'user' ? 'bg-[#E8F3FF] text-[#1D2129]' : 'bg-white text-[#1D2129] border border-gray-200'}`}>
                                            {msg.role === 'assistant' ? (
                                                <div className="prose prose-sm max-w-none">
                                                    <ReactMarkdown>
                                                        {msg.content}
                                                    </ReactMarkdown>
                                                </div>
                                            ) : (
                                                msg.content
                                            )}
                                        </div>
                                    </div>
                                ))}
                                {loading && messages[messages.length - 1]?.role === 'user' && (
                                    <div className="flex gap-2">
                                        <Avatar size={28} style={{ backgroundColor: '#00B42A' }}><IconRobot /></Avatar>
                                        <div className="flex items-center">
                                            <Spin dot />
                                        </div>
                                    </div>
                                )}
                                <div ref={messagesEndRef} />
                            </div>
                        )}
                    </div>

                    {/* Input */}
                    <div className="p-3 border-t border-[var(--color-border-2)] bg-[var(--color-bg-2)] flex gap-2">
                        <Input
                            placeholder="输入问题..."
                            value={input}
                            onChange={val => setInput(val)}
                            onPressEnter={handleSend}
                            disabled={loading}
                            className="bg-transparent border-[var(--color-border-3)]"
                        />
                        <Button
                            type="primary"
                            icon={<IconSend />}
                            onClick={handleSend}
                            loading={loading}
                        />
                    </div>
                </div>
            )}

            {/* Toggle Button */}
            <Button
                shape="circle"
                type="primary"
                size="large"
                className="w-12 h-12 shadow-lg !flex items-center justify-center text-xl transition-transform hover:scale-110"
                onClick={() => setVisible(!visible)}
            >
                {visible ? <IconClose /> : <IconMessage />}
            </Button>
        </div>
    );
}
