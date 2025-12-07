/**
 * AI Advisor Logic - Handles Coze API integration
 */

// Check if config exists
if (typeof CONFIG === 'undefined') {
    console.warn('Config not found, falling back to mock mode.');
    var CONFIG = { USE_MOCK: true };
}

async function callCozeAPI(userMessage, botId = null) {
    // Use provided botId or default from config
    const targetBotId = botId || CONFIG.BOT_ID;

    if (CONFIG.USE_MOCK) {
        return mockCozeResponse(userMessage, targetBotId);
    }

    try {
        const response = await fetch(CONFIG.API_BASE_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${CONFIG.COZE_API_KEY}`,
                'Content-Type': 'application/json',
                'Accept': '*/*'
            },
            body: JSON.stringify({
                conversation_id: 'conv_' + Date.now(), // Generate unique ID per request for simplicity in this context
                bot_id: targetBotId,
                user: "user_123", // Identify user
                query: userMessage,
                stream: false
            })
        });

        if (!response.ok) {
            throw new Error(`API Error: ${response.status}`);
        }

        const data = await response.json();
        // Adapt based on actual Coze API response structure (v2 vs v3)
        const aiMsg = data.messages ? data.messages.find(m => m.type === 'answer') : null;
        return aiMsg ? aiMsg.content : "抱歉，我暂时无法连接到大脑。";

    } catch (error) {
        console.error("Coze API Call Failed:", error);
        return "网络连接异常，请稍后再试。(API Error)";
    }
}

function mockCozeResponse(text, botId) {
    return new Promise((resolve) => {
        setTimeout(() => {
            // If it's the analysis bot
            if (botId === CONFIG.ANALYSIS_BOT_ID) {
                let analysis = `
### 📋 AI 体质辨识报告

**核心体质：** 气虚质 (倾向度较高)
**兼夹体质：** 阳虚质 (轻微)

**🔍 深度解析：**
您目前的主要问题在于“元气不足”，表现为容易疲乏、气短、懒言。这通常与长期的工作压力大、饮食不规律有关。此外，轻微的阳虚表现为手脚偶尔冰凉，说明体内阳气也有所亏损，不能很好地温煦四肢。

**💡 调理建议：**
1. **饮食：** 多吃益气健脾的食物，如**黄芪、党参、山药、牛肉**。避免生冷寒凉，以免伤及脾胃阳气。
2. **起居：** 保证充足睡眠，避免熬夜耗伤气血。中午可小憩 20 分钟。
3. **运动：** 适合柔和的运动，如**八段锦、太极拳**，不宜剧烈运动导致大汗淋漓（气随汗脱）。

**🍵 专属茶饮：** 黄芪枸杞茶（补气固表）。
                `;
                resolve(analysis);
                return;
            }

            // Default Chat Bot logic
            let reply = "收到您的提问。作为您的AI顾问，建议您结合体质进行调理。保持良好的作息和饮食习惯对健康至关重要。";
            
            if(text.includes("上火") || text.includes("熬夜")) {
                reply = `
                    <strong>针对"上火熬夜"的调理建议：</strong><br><br>
                    1. <strong>食疗推荐：</strong> 麦冬百合茶、绿豆汤（适量）。<br>
                    2. <strong>穴位按摩：</strong> 按揉太冲穴（疏肝理气）。<br>
                    3. <strong>注意事项：</strong> 23点前入睡，避免辛辣。<br><br>
                    <button class="btn-outline" style="font-size:0.8rem; padding:4px 10px;" onclick="showKnowledgeCard()">查看推荐食材详情</button>
                `;
            } else if (text.includes("补品") || text.includes("父母")) {
                reply = "冬季进补，建议优先选择温补类，如人参、鹿茸（遵医嘱）。对于老年人，西洋参性质较平和，适合长期调理。";
            } else if (text.includes("视疲劳") || text.includes("眼睛")) {
                reply = "缓解视疲劳建议：<br>1. 多远眺放松。<br>2. 饮用菊花枸杞茶（清肝明目）。<br>3. 避免长时间连续用眼，每45分钟休息一下。";
            } else if (text.includes("你好") || text.includes("嗨")) {
                reply = "您好！有什么我可以帮您的吗？";
            }
            
            resolve(reply);
        }, 1500);
    });
}

// Export functions if using modules, but for simple HTML include:
window.callCozeAPI = callCozeAPI;
