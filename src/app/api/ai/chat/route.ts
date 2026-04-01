import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const { messages, systemPrompt } = await request.json();
        const aiConfig = user.preferences?.aiConfig;

        if (!aiConfig || !aiConfig.apiKey || !aiConfig.baseUrl) {
            return NextResponse.json({ success: false, error: "AI Configuration missing. Please configure in Settings." }, { status: 400 });
        }

        const apiKey = aiConfig.apiKey;
        const baseUrl = aiConfig.baseUrl.replace(/\/+$/, ''); // Remove trailing slash
        const model = aiConfig.model || 'gpt-3.5-turbo';

        const endpoint = `${baseUrl}/chat/completions`;

        console.log(`[AI Chat] Proxying to ${endpoint} with model ${model}`);

        // Prepend system prompt if exists
        const finalMessages = systemPrompt
            ? [{ role: 'system', content: systemPrompt }, ...messages]
            : messages;

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: model,
                messages: finalMessages,
                stream: true // We will handle streaming if possible, but for MVP maybe just text
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("[AI Chat] Upstream Error:", errorText);
            return NextResponse.json({ success: false, error: `Upstream AI Error: ${response.statusText}` }, { status: 500 });
        }

        // For true streaming response in Next.js App Router:
        // We can return the response body directly if we want to stream.
        // Let's assume we want to stream.
        return new Response(response.body, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            },
        });

    } catch (error: any) {
        console.error("[AI Chat] Internal Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
