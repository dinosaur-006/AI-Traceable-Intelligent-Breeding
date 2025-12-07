/**
 * Main Logic for Coze API Integration
 * Supports multiple bots, backend proxy, and mock mode fallback.
 */

// Ensure Config is loaded
if (typeof CONFIG === 'undefined') {
    console.error('CONFIG is missing. Please load config.js first.');
}

/**
 * Call Coze API
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
        
        // Handle special case for Poster which uses a dedicated endpoint in our backend
        // to handle specific caching and logging logic required by the spec.
        if (botId === CONFIG.POSTER_BOT_ID) {
            // Check if input is combined "City Season" string
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
                // No Authorization header needed here if using backend proxy
                // The backend adds the Bearer token
            },
            body: JSON.stringify({
                bot_id: botId,
                user_id: "user_" + Date.now(), // Generate unique ID per session
                message: userMessage,          // Backend expects 'message'
                stream: false
            })
        });

        if (!response.ok) {
            // If 404/500, throw to catch block and try mock
            throw new Error(`Server Error: ${response.status}`);
        }

        const data = await response.json();
        
        // Handle Backend Proxy Response Format
        if (data.message) {
            return data.message;
        }
        
        // Handle Direct Coze Response Format (Fallback if URL is direct)
        if (data.messages) {
            const answer = data.messages.find(m => m.role === 'assistant' && m.type === 'answer');
            return answer ? answer.content : "AI 未返回有效内容";
        }

        return "未收到有效响应";

    } catch (error) {
        console.warn("API Call Failed, switching to Mock/Fallback:", error);
        
        // Fallback to Mock if API fails (Network error, Server down, etc.)
        // This ensures the demo always works
        return mockCozeResponse(userMessage, botId);
    }
}

/**
 * Mock Response Generator
 * Provides realistic responses for demo purposes when backend is unavailable.
 */
function mockCozeResponse(message, botId) {
    return new Promise((resolve) => {
        setTimeout(() => {
            // A. Seasonal Poster Bot (Image)
            if (botId === CONFIG.POSTER_BOT_ID) {
                // Strict mode: No mock image allowed as per user request
                // resolve("https://images.unsplash.com/photo-1516062423079-7ca13cdc7f5a?q=80&w=600&auto=format&fit=crop"); 
                resolve("Error: Mock generation disabled for Poster. Please use real API.");
                return;
            }

            // B. Recipe Bot (Detailed Text)
            if (botId === CONFIG.RECIPE_BOT_ID) {
                resolve(`
### 🍲 ${message} - 养生食谱 (AI推荐)

**🌱 食材准备：**
* **主料**：精选${message.substring(0,2)} 200g
* **辅料**：枸杞 10g, 红枣 3颗, 生姜 2片

**🔥 制作步骤：**
1. 将食材洗净，主料焯水去腥。
2. 所有材料放入炖盅，加入清水适量。
3. 大火烧开后转文火慢炖 1.5 小时。
4. 出锅前加入少许盐调味即可。

**💪 养生功效：**
滋阴补肾，益气养血，非常适合当前季节食用。
                `);
                return;
            }

            // C. Constitution Analysis Bot (JSON Analysis)
            if (botId === CONFIG.ANALYSIS_BOT_ID) {
                let scores = {};
                try { scores = JSON.parse(message); } catch(e) {}
                
                // Determine main type
                let mainType = "平和质";
                let maxScore = 0;
                for(let k in scores) {
                    if(scores[k] > maxScore) { maxScore = scores[k]; mainType = k; }
                }

                resolve(`
### 📋 AI 体质深度辨识

**📊 您的体质画像：**
* **核心体质**：${mainType} (得分: ${maxScore})
* **倾向体质**：气虚质 (示例)

**🔍 深度解析：**
根据您的测评数据，您的${mainType}特征较为明显。表现为...

**💡 专属调理建议：**
1. **饮食**：多吃健脾益气的食物，如山药、白术。
2. **运动**：建议进行舒缓的有氧运动，如八段锦。
3. **作息**：务必在23点前入睡，养精蓄锐。

**🍵 推荐茶饮：** 黄芪枸杞茶。
                `);
                return;
            }

            // D. Advisor Bot (Chat) - Context Aware
            let reply = "您好！我是您的AI健康顾问。";
            if (message.includes("你好") || message.includes("嗨")) {
                reply = "您好！很高兴为您服务。请告诉我您的健康困扰，我会为您提供针对性建议。";
            } else if (message.includes("失眠") || message.includes("睡不着")) {
                reply = "失眠多与心脾两虚或肝火旺有关。建议您：\n1. 睡前泡脚20分钟。\n2. 尝试饮用酸枣仁茶。\n3. 睡前远离手机屏幕。";
            } else if (message.includes("上火")) {
                reply = "上火时建议饮食清淡，避免辛辣。可以适量饮用菊花茶或绿豆汤来清热降火。";
            } else {
                reply = `收到您的问题：“${message}”。\n\n从养生角度来看，建议您注意情志调节，保持心情舒畅。饮食上顺应节气，起居有常。具体方案建议结合您的体质进行调整。`;
            }
            
            resolve(reply);

        }, 1500); 
    });
}
