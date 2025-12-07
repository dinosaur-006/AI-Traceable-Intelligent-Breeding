/**
 * Main Logic for Coze API Integration
 * Supports multiple bots, backend proxy, and mock mode fallback.
 */

// Ensure Config is loaded
if (typeof CONFIG === 'undefined') {
    console.error('CONFIG is missing. Please load config.js first.');
}

/**
 * Call Coze API (Non-Streaming)
 * @param {string} userMessage - The user's input (text or JSON string).
 * @param {string} botId - The specific Bot ID to call.
 * @returns {Promise<string>} - The AI's response content (text or image URL).
 */
async function callCozeAPI(userMessage, botId) {
    if (!botId) {
        console.error("Bot ID is required.");
        return "系统错误: 缺少 Bot ID";
    }

    // 1. Forced Mock Mode
    if (CONFIG.USE_MOCK) {
        console.log(`[Mock Mode] Calling Bot: ${botId}`);
        return mockCozeResponse(userMessage, botId);
    }

    // 2. Real API Call (via Proxy)
    try {
        console.log(`[API] Calling ${CONFIG.API_BASE_URL} for Bot ${botId}`);
        
        // Handle special case for Poster
        if (botId === CONFIG.POSTER_BOT_ID) {
            // Strict: No Mock Image Allowed for Poster
            // The user explicitly requested: "Do not use preset image, must use agent generated"
            
            const parts = userMessage.split(' ');
            const area = parts[0];
            const season = parts.length > 1 ? parts[1] : '';

            const response = await fetch('/api/generate-poster', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ area, season })
            });
            
            if (!response.ok) throw new Error(`Poster API Error: ${response.status}`);
            const data = await response.json();
            return data.imageUrl || data.text || "生成失败";
        }

        // Standard Chat API for other bots
        const response = await fetch(CONFIG.API_BASE_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                bot_id: botId,
                user_id: "user_" + Date.now(),
                message: userMessage,
                stream: false
            })
        });

        if (!response.ok) {
            throw new Error(`Server Error: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.message) return data.message;
        if (data.messages) {
            const answer = data.messages.find(m => m.role === 'assistant' && m.type === 'answer');
            return answer ? answer.content : "AI 未返回有效内容";
        }

        return "未收到有效响应";

    } catch (error) {
        console.warn("API Call Failed, switching to Mock/Fallback:", error);
        return mockCozeResponse(userMessage, botId);
    }
}

/**
 * Call Coze API (Streaming)
 * @param {string} userMessage 
 * @param {string} botId 
 * @param {function} onChunk - Callback for each text chunk
 * @param {function} onDone - Callback when stream ends
 * @param {function} onError - Callback for errors
 */
async function callCozeAPIStream(userMessage, botId, onChunk, onDone, onError) {
    if (CONFIG.USE_MOCK) {
        console.log(`[Mock Stream] Calling Bot: ${botId}`);
        const fullResponse = await mockCozeResponse(userMessage, botId);
        let i = 0;
        const interval = setInterval(() => {
            if (i < fullResponse.length) {
                // Send random chunk size for realism
                const chunkSize = Math.floor(Math.random() * 3) + 1;
                const chunk = fullResponse.substring(i, i + chunkSize);
                onChunk(chunk);
                i += chunkSize;
            } else {
                clearInterval(interval);
                onDone();
            }
        }, 50);
        return;
    }

    try {
        const response = await fetch(CONFIG.API_BASE_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                bot_id: botId,
                message: userMessage,
                stream: true,
                user_id: "user_" + Date.now()
            })
        });

        if (!response.ok) throw new Error(`API Error: ${response.status}`);

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value, { stream: true });
            buffer += chunk;
            const lines = buffer.split('\n');
            buffer = lines.pop(); // Keep incomplete line

            for (const line of lines) {
                if (line.startsWith('data:')) {
                    try {
                        const dataStr = line.slice(5).trim();
                        if (!dataStr) continue;
                        const data = JSON.parse(dataStr);
                        
                        // Parse Coze V3 Delta
                        // Standard V3 Stream: event: conversation.message.delta -> data: { content: "...", type: "answer" }
                        // Also event: conversation.message.completed -> data: { content: "full_content" ... }
                        
                        // Fix: Only process delta events to avoid duplication
                        if (data.event === 'conversation.message.delta') {
                             if (data.content) {
                                 onChunk(data.content);
                             }
                        } else if (data.type === 'answer' && !data.event) {
                             // Fallback for some proxies that might strip event name but send incremental chunks
                             // However, if it's 'completed' event (which usually has event field), we skip.
                             // Safest is to rely on content_type usually being 'text' in delta
                             if (data.content) {
                                 onChunk(data.content);
                             }
                        }
                    } catch (e) {
                        // Ignore parse errors for keep-alive or malformed lines
                    }
                }
            }
        }
        onDone();

    } catch (error) {
        console.error("Stream Failed:", error);
        onError(error);
        // Fallback to mock stream on error
        const fullResponse = await mockCozeResponse(userMessage, botId);
        onChunk(fullResponse);
        onDone();
    }
}

/**
 * Mock Response Generator
 */
function mockCozeResponse(message, botId) {
    return new Promise((resolve) => {
        // Immediate mock for logic, caller handles delay
        // A. Seasonal Poster Bot (Image)
        if (botId === CONFIG.POSTER_BOT_ID) {
            // Strict: No Mock Image Allowed for Poster
            resolve("Error: Mock generation disabled for Poster. Please use real API to generate image."); 
            return;
        }

        // B. Recipe Bot
        if (botId === CONFIG.RECIPE_BOT_ID) {
            resolve(`### 🍲 ${message} - 养生食谱 (AI定制)\n\n**🌱 食材准备：**\n* 主料：精选${message.substring(0,2)} 200g\n* 辅料：枸杞 10g, 红枣 3颗\n\n**🔥 制作步骤：**\n1. 洗净食材。\n2. 炖煮2小时。\n\n**💪 功效：**\n滋补养生。`);
            return;
        }

        // C. Constitution Analysis Bot
        if (botId === CONFIG.ANALYSIS_BOT_ID) {
            resolve(`### 📋 AI 体质辨识报告\n\n**核心体质：** 气虚质\n**调理建议：** 多吃山药，少熬夜。`);
            return;
        }

        // D. Advisor Bot
        let reply = "您好！我是您的AI健康顾问。";
        if (message.includes("你好") || message.includes("嗨")) {
            reply = "您好！很高兴为您服务。请告诉我您的健康困扰，我会为您提供针对性建议。";
        } else if (message.includes("失眠")) {
            reply = "失眠多与心脾两虚有关。建议：\n1. 睡前泡脚。\n2. 喝酸枣仁茶。";
        } else {
            reply = `收到您的问题：“${message}”。\n建议您注意休息，保持心情舒畅。饮食上顺应节气，起居有常。`;
        }
        resolve(reply);
    });
}
