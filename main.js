
const chatWindow = document.getElementById('chatWindow');
const knowledgeContainer = document.getElementById('knowledgeContainer');

// Coze API Configuration
const COZE_CONFIG = {
    // token: 'pat_...', // Token should be handled server-side (in server.js)
    // botId: '7574631776337788955', // REMOVED: Managed by server env
    botId: null, 
    botAlias: null, // Set this to 'advisor', 'nutrition' etc. to switch bots via server env
    baseUrl: '/api/chat' 
};

// Check for file protocol usage
if (window.location.protocol === 'file:') {
    alert('⚠️ 警告：检测到您正在直接打开文件！\n\nAI 功能需要服务器支持才能运行。\n请使用 Vercel 部署链接或本地服务器访问。');
}

// ==========================================
// Storage Service (Encrypted LocalStorage)
// ==========================================
const StorageService = {
    KEY: 'ai_health_sessions_v1',
    
    save(data) {
        try {
            // Simple obfuscation/encryption
            const json = JSON.stringify(data);
            const encrypted = btoa(encodeURIComponent(json));
            localStorage.setItem(this.KEY, encrypted);
        } catch (e) {
            console.error('Storage save failed:', e);
            if (e.name === 'QuotaExceededError') {
                alert('存储空间已满，请清理旧会话');
            }
        }
    },

    load() {
        try {
            const raw = localStorage.getItem(this.KEY);
            if (!raw) return null;
            const json = decodeURIComponent(atob(raw));
            return JSON.parse(json);
        } catch (e) {
            console.error('Storage load failed:', e);
            return null;
        }
    }
};

// ==========================================
// Session Manager
// ==========================================
const SessionManager = {
    sessions: [],
    activeSessionId: null,

    init() {
        const data = StorageService.load();
        if (data && data.sessions) {
            this.sessions = data.sessions;
            this.activeSessionId = data.activeSessionId;
        } else {
            this.createSession(true); // Create initial session
        }
        
        // Cleanup old empty sessions
        this.sessions = this.sessions.filter(s => s.messages.length > 0 || s.id === this.activeSessionId);
        
        this.renderSidebar();
        this.restoreActiveSession();
    },

    createSession(isInit = false) {
        const newSession = {
            id: 'session_' + Date.now(),
            title: '新会话',
            timestamp: Date.now(),
            messages: [],
            cards: [], // Store insight cards
            pinned: false
        };
        
        this.sessions.unshift(newSession);
        this.activeSessionId = newSession.id;
        this.save();
        
        if (!isInit) {
            this.renderSidebar();
            this.restoreActiveSession();
        }
        return newSession.id;
    },

    getActiveSession() {
        return this.sessions.find(s => s.id === this.activeSessionId);
    },

    addMessage(role, content, isHtml = false) {
        const session = this.getActiveSession();
        if (!session) return;

        const msg = {
            id: 'msg-' + Date.now(),
            role,
            content,
            isHtml,
            timestamp: Date.now()
        };
        
        session.messages.push(msg);
        session.timestamp = Date.now(); // Update last active
        
        // Auto-update title for first user message
        if (role === 'user' && session.messages.length <= 2) {
            session.title = extractTopic(content);
        }

        this.save();
        this.renderSidebar(); // Re-order by time
        return msg.id;
    },

    addCard(topic, content, targetMsgId) {
        const session = this.getActiveSession();
        if (!session) return;

        const card = {
            id: 'card-' + Date.now(),
            topic,
            content,
            targetMsgId,
            timestamp: Date.now(),
            pinned: false,
            collapsed: false
        };
        session.cards.unshift(card);
        this.save();
        return card.id;
    },

    updateCard(cardId, content) {
        const session = this.getActiveSession();
        if (!session) return;
        const card = session.cards.find(c => c.id === cardId);
        if (card) {
            card.content = content;
            this.save();
        }
    },

    switchSession(sessionId) {
        if (this.activeSessionId === sessionId) return;
        this.activeSessionId = sessionId;
        this.save();
        this.renderSidebar();
        this.restoreActiveSession();
    },

    deleteSession(sessionId, event) {
        if (event) event.stopPropagation();
        if (!confirm('确定要删除此会话吗？')) return;

        this.sessions = this.sessions.filter(s => s.id !== sessionId);
        
        if (this.activeSessionId === sessionId) {
            if (this.sessions.length > 0) {
                this.activeSessionId = this.sessions[0].id;
            } else {
                this.createSession();
            }
        }
        
        this.save();
        this.renderSidebar();
        this.restoreActiveSession();
    },

    save() {
        StorageService.save({
            sessions: this.sessions,
            activeSessionId: this.activeSessionId
        });
    },

    renderSidebar(filterText = '') {
        const listEl = document.getElementById('sessionList');
        if (!listEl) return;
        listEl.innerHTML = '';
        
        const filtered = this.sessions.filter(s => 
            s.title.includes(filterText) || 
            (s.messages[0] && s.messages[0].content.includes(filterText))
        );

        filtered.forEach(session => {
            const li = document.createElement('li');
            li.className = `sidebar-item ${session.id === this.activeSessionId ? 'active' : ''}`;
            li.onclick = () => this.switchSession(session.id);
            
            // Format time (MM/DD)
            const date = new Date(session.timestamp);
            const timeStr = `${date.getMonth()+1}/${date.getDate()}`;
            
            // Simplify Title (First 4 chars)
            let shortTitle = session.title;
            if (shortTitle.length > 6) shortTitle = shortTitle.substring(0, 6) + '..';

            li.innerHTML = `
                <div style="font-weight:500; color:var(--text-main);">${shortTitle}</div>
                <div style="font-size:0.75rem; color:var(--text-secondary);">${timeStr}</div>
            `;
            listEl.appendChild(li);
        });
    },

    restoreActiveSession() {
        const session = this.getActiveSession();
        if (!session) return;

        // 1. Clear UI
        if (chatWindow) chatWindow.innerHTML = '';
        if (knowledgeContainer) knowledgeContainer.innerHTML = '';

        // 2. Render Messages
        if (session.messages.length === 0) {
            // Add welcome if empty
            renderWelcomeMessage();
        } else {
            session.messages.forEach(msg => {
                renderMessageToDOM(msg.content, msg.role, msg.isHtml, msg.id);
            });
        }

        // 3. Render Cards
        if (session.cards.length > 0) {
            // Reverse to keep order correct (unshifted)
            [...session.cards].reverse().forEach(card => {
                renderCardToDOM(card);
            });
        } else {
            // Initial state
            if (knowledgeContainer) {
                knowledgeContainer.innerHTML = `
                    <div class="knowledge-card">
                        <div class="k-title">等待分析...</div>
                        <div class="k-desc">当我们在对话中提及时，相关滋补品的产地、功效卡片将自动显示在这里。</div>
                    </div>
                `;
            }
        }
        
        scrollToBottom();
    }
};

// ==========================================
// Global Functions (UI Handlers)
// ==========================================

function startNewChat() {
    SessionManager.createSession();
}

function sendMessage() {
    const inputField = document.getElementById('userInput');
    if (!inputField) return;
    const text = inputField.value.trim();
    if (!text) return;

    // 1. Add to Session & UI
    const msgId = SessionManager.addMessage('user', text);
    renderMessageToDOM(text, 'user', false, msgId);
    inputField.value = '';

    // 2. Call API
    generateAIResponse(text, msgId);
}

function filterSessions(text) {
    SessionManager.renderSidebar(text);
}

// Helper: Render single message to DOM (Visual only)
function renderMessageToDOM(text, type, isHtml, msgId) {
    if (!chatWindow) return;
    const div = document.createElement('div');
    div.className = `message ${type}`;
    div.id = msgId;
    
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    
    if (isHtml) {
        bubble.innerHTML = text;
    } else {
        bubble.textContent = text;
    }
    
    if (type === 'user') {
        const icon = document.createElement('i');
        icon.className = 'fas fa-check-circle saved-icon';
        icon.title = '已保存到档案';
        bubble.appendChild(icon);
    }
    
    div.appendChild(bubble);
    chatWindow.appendChild(div);
}

function renderWelcomeMessage() {
    if (!chatWindow) return;
    const welcomeDiv = document.createElement('div');
    welcomeDiv.className = 'message ai';
    welcomeDiv.innerHTML = `
        <div class="bubble">
            <div class="ai-name">AI 溯源顾问</div>
            您好！我是您的专属健康顾问。基于您的体质档案，今天想了解哪方面的滋补建议？<br><br>
            <div class="preset-container">
                <div class="preset-title">猜您想问：</div>
                <div class="preset-list">
                    <div class="preset-item" onclick="sendPreset('最近总是熬夜，喝什么好？')">
                        <span class="preset-num">1.</span> 熬夜后如何快速恢复状态？
                    </div>
                    <div class="preset-item" onclick="sendPreset('什么是气虚体质？')">
                        <span class="preset-num">2.</span> 气虚体质有哪些典型表现？
                    </div>
                    <div class="preset-item" onclick="sendPreset('推荐几款秋季滋补品')">
                        <span class="preset-num">3.</span> 秋季适合吃什么滋补品？
                    </div>
                </div>
            </div>
        </div>
    `;
    chatWindow.appendChild(welcomeDiv);
}

function renderCardToDOM(card) {
    if (!knowledgeContainer) return;
    const div = document.createElement('div');
    div.className = `insight-card ${card.pinned ? 'pinned' : ''}`;
    div.id = card.id;
    div.dataset.targetMsgId = card.targetMsgId;

    div.innerHTML = `
        <div class="card-header" onclick="toggleCard('${card.id}')">
            <span class="card-title" onclick="scrollToMessage('${card.targetMsgId}', event)">
                <i class="fas fa-hashtag" style="color: var(--tech-cyan); font-size: 0.8rem;"></i>
                ${card.topic}
            </span>
            <div class="card-actions">
                <i class="fas fa-thumbtack action-btn ${card.pinned ? 'active' : ''}" onclick="pinCard('${card.id}', event)" title="置顶"></i>
                <i class="fas fa-chevron-up action-btn toggle-icon" title="折叠/展开"></i>
                <i class="fas fa-times action-btn" onclick="removeCard('${card.id}', event)" title="移除"></i>
            </div>
        </div>
        <div class="card-body ${card.collapsed ? 'collapsed' : ''}" id="${card.id}-body">
            ${card.content}
        </div>
    `;
    knowledgeContainer.prepend(div);
}

// ==========================================
// Core Logic & API
// ==========================================

async function generateAIResponse(userText, userMsgId) {
    // Create placeholder UI
    const loadingId = 'loading-' + Date.now();
    renderMessageToDOM('<i class="fas fa-circle-notch fa-spin"></i> 思考中...', 'ai', true, loadingId);
    scrollToBottom();

    // Create Card
    const topic = extractTopic(userText);
    const loaderContent = `<div class="brand-loader"><i class="fas fa-circle-notch"></i> 正在基于报告生成定制方案...</div>`;
    const cardId = SessionManager.addCard(topic, loaderContent, userMsgId);
    renderCardToDOM({ id: cardId, topic, content: loaderContent, targetMsgId: userMsgId });

    const bubbleEl = document.getElementById(loadingId).querySelector('.bubble');
    let fullResponse = "";

    try {
        const response = await fetch(COZE_CONFIG.baseUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: userText,
                stream: true,
                user_id: 'user_global',
                bot_id: COZE_CONFIG.botId,
                bot_alias: COZE_CONFIG.botAlias
            })
        });

        if (!response.ok) throw new Error(`API Error ${response.status}`);

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let currentEvent = null;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop();

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed) continue;
                if (trimmed.startsWith('event:')) {
                    currentEvent = trimmed.slice(6).trim();
                    continue;
                }
                if (trimmed.startsWith('data:')) {
                    const dataStr = trimmed.slice(5).trim();
                    if (!dataStr || dataStr === '[DONE]') continue;
                    
                    try {
                        const data = JSON.parse(dataStr);
                        if ((currentEvent === 'conversation.message.delta' || data.event === 'conversation.message.delta') && data.type === 'answer') {
                            fullResponse += data.content;
                            
                            // Render Markdown
                            if (typeof marked !== 'undefined') {
                                bubbleEl.innerHTML = marked.parse(fullResponse);
                            } else {
                                bubbleEl.innerText = fullResponse;
                            }
                            
                            // Update Card UI (Throttled)
                            if (fullResponse.length % 50 === 0) {
                                const summary = generateSummary(fullResponse);
                                const cardBody = document.getElementById(`${cardId}-body`);
                                if (cardBody) cardBody.innerHTML = summary;
                            }
                            
                            scrollToBottom();
                        }
                        
                        if (currentEvent === 'conversation.chat.completed' || data.event === 'conversation.chat.completed') {
                             // Save AI Message to Session
                             SessionManager.addMessage('ai', fullResponse, true);
                             
                             // Final Card Update
                             const summary = generateSummary(fullResponse);
                             SessionManager.updateCard(cardId, summary);
                             const cardBody = document.getElementById(`${cardId}-body`);
                             if (cardBody) cardBody.innerHTML = summary;
                        }
                    } catch (e) { console.warn('SSE Parse Error', e); }
                }
            }
        }
    } catch (error) {
        console.error(error);
        bubbleEl.innerHTML = `<span style="color: #d32f2f;">连接中断: ${error.message}</span>`;
        SessionManager.addMessage('ai', `[Error] ${error.message}`, false);
    }
}

// ==========================================
// Helpers
// ==========================================

function extractTopic(text) {
    let topic = text.split(/[，。？！,?!]/)[0];
    if (topic.length > 12) topic = topic.substring(0, 12) + '...';
    return topic || "新话题";
}

function generateSummary(fullContent) {
    // Same logic as before
    const headings = fullContent.match(/^#+\s+(.*)$/gm);
    const boldRegex = /\*\*(.*?)\*\*/g;
    const boldTexts = [];
    let match;
    while ((match = boldRegex.exec(fullContent)) !== null) {
        if (match[1].length > 1 && match[1].length < 20) boldTexts.push(match[1]);
    }

    if (headings && headings.length > 0) {
        const cleanHeadings = headings.slice(0, 3).map(h => h.replace(/^#+\s+/, ''));
        return '<ul style="padding-left: 16px; margin: 0; list-style-type: circle;">' + 
            cleanHeadings.map(h => `<li style="margin-bottom:4px;">${h}</li>`).join('') + '</ul>';
    } else if (boldTexts.length > 0) {
        const uniqueBolds = [...new Set(boldTexts)].slice(0, 6);
        return '<div style="display:flex; flex-wrap:wrap; gap:6px;">' + 
            uniqueBolds.map(t => `<span class="keyword-highlight">${t}</span>`).join('') + '</div>';
    } else {
        let clean = fullContent.replace(/[#*`]/g, '').split('\n')[0];
        if (clean.length < 20) clean = fullContent.replace(/[#*`]/g, '').substring(0, 80) + '...';
        return clean;
    }
}

function sendPreset(text) {
    const input = document.getElementById('userInput');
    if (input) {
        input.value = text;
        sendMessage();
    }
}

function scrollToBottom() {
    if (chatWindow) chatWindow.scrollTop = chatWindow.scrollHeight;
}

function toggleCard(cardId) {
    const cardBody = document.getElementById(`${cardId}-body`);
    const icon = document.querySelector(`#${cardId} .toggle-icon`);
    if (cardBody) {
        cardBody.classList.toggle('collapsed');
        if (cardBody.classList.contains('collapsed')) {
            icon.classList.replace('fa-chevron-up', 'fa-chevron-down');
        } else {
            icon.classList.replace('fa-chevron-down', 'fa-chevron-up');
        }
    }
}

function pinCard(cardId, event) {
    event.stopPropagation();
    const card = document.getElementById(cardId);
    if (card) card.classList.toggle('pinned');
    // Note: Persistence for pinned state requires updating SessionManager
}

function removeCard(cardId, event) {
    event.stopPropagation();
    const card = document.getElementById(cardId);
    if (card) card.remove();
    // Note: Persistence for remove requires updating SessionManager
}

function scrollToMessage(msgId, event) {
    if (event) event.stopPropagation();
    const msgDiv = document.getElementById(msgId);
    if (msgDiv) {
        msgDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
        msgDiv.classList.add('highlight-message');
        setTimeout(() => msgDiv.classList.remove('highlight-message'), 2000);
    }
}

// Init
window.onload = () => {
    if (typeof SessionManager !== 'undefined') {
        SessionManager.init();
    }
    
    // Bind Enter key for textarea
    const input = document.getElementById('userInput');
    if (input) {
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
    }
};

// ==========================================
// Recipe Module Logic (Added Extension)
// ==========================================

// New Coze Bot ID for Recipes
// const COZE_BOT_ID_RECIPES = '7578549922430566450'; // REMOVED: Managed by server alias

// 模拟 Coze API 调用，实际中替换为 fetch(Coze API...)
async function generateRecipe(query) {
    // 假设这是 Coze 返回的 JSON 数组（为了演示，我们先模拟多份食谱）
    // 实际 Coze 如果只能返回一个，你需要循环调用多次或优化 prompt
    await new Promise(resolve => setTimeout(resolve, 1500)); // 模拟网络延迟

    // 假设 Coze 返回了多份食谱的结构化文本（简化演示，前端处理）
    // 这里我们将上面的单个食谱 prompt 复制多份来模拟 Gallery
    const recipeTemplate = `
###食谱名称###
{name}

###中医原理/功效###
{principle}

###食材列表###
* 大米：100克
* **黄芪：15克 (道地源自内蒙古)**
* **怀山药：50克 (河南焦作)**
* 瘦肉：50克
* 生姜：2片

###制作步骤###
1. 瘦肉切丁，山药去皮切块，黄芪装入纱布袋。
2. ...

###溯源提示###
{traceability}
`;

    const recipes = [
        { query: `针对 ${query} 的黄芪山药健脾粥`, name: `黄芪山药健脾粥`, principle: `补气益脾，适合${query}`, traceability: `黄芪溯源自内蒙古，山药溯源自焦作。` },
        { query: `针对 ${query} 的百合润肺汤`, name: `百合润肺汤`, principle: `清热润肺，适合${query}`, traceability: `百合溯源自湖南，枸杞溯源自宁夏中宁。` },
        { query: `针对 ${query} 的红枣桂圆茶`, name: `红枣桂圆茶`, principle: `养血安神，适合${query}`, traceability: `红枣溯源自新疆，桂圆溯源自福建莆田。` }
    ];

    return recipes.map(r => recipeTemplate
        .replace('{name}', r.name)
        .replace('{principle}', r.principle)
        .replace('{traceability}', r.traceability)
    );
}


async function loadRecipes() {
    const tizhiSelect = document.getElementById('tizhiFilter');
    const seasonSelect = document.getElementById('seasonFilter');
    
    if (!tizhiSelect || !seasonSelect) return; // Guard clause

    const tizhi = tizhiSelect.value;
    const season = seasonSelect.value;
    const gallery = document.getElementById('recipeGallery');
    
    if (!gallery) return;

    // 构造查询关键词
    const query = `${season} 季节，${tizhi} 适合的食谱`;

    gallery.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; padding: 40px;"><i class="fas fa-sync fa-spin fa-2x" style="color: var(--accent-color);"></i><p style="color: var(--text-secondary); margin-top: 10px;">AI正在为您检索 ${query}...</p></div>`;

    const structuredRecipes = await generateRecipe(query);

    gallery.innerHTML = ''; // 清空加载提示

    structuredRecipes.forEach(recipeText => {
        // 使用正则和分隔符解析 Coze 的结构化文本
        const name = recipeText.match(/###食谱名称###\s*([\s\S]*?)\s*###中医原理/)?.[1]?.trim() || '未知食谱';
        const principle = recipeText.match(/###中医原理\/功效###\s*([\s\S]*?)\s*###食材列表/)?.[1]?.trim() || '原理待查';
        const ingredients = recipeText.match(/###食材列表###\s*([\s\S]*?)\s*###制作步骤/)?.[1]?.trim() || '食材缺失';
        const steps = recipeText.match(/###制作步骤###\s*([\s\S]*?)\s*###溯源提示/)?.[1]?.trim() || '步骤缺失';
        const traceability = recipeText.match(/###溯源提示###\s*([\s\S]*?)\s*$/)?.[1]?.trim() || '无溯源信息';

        const cardHtml = createRecipeCard(name, principle, ingredients, steps, traceability);
        gallery.innerHTML += cardHtml;
    });

    // 重新运行高亮和溯源链接绑定
    highlightProducts();
}

function createRecipeCard(name, principle, ingredients, steps, traceability) {
    // 创建食谱卡片 HTML 结构
    return `
    <div class="glass-card recipe-card" style="padding: 25px; display: flex; flex-direction: column; justify-content: space-between;">
        <div>
            <h3 style="color: var(--primary-color); margin-bottom: 10px;">${name}</h3>
            <p style="font-size: 0.9rem; color: var(--text-secondary); border-bottom: 1px dashed #eee; padding-bottom: 10px;">功效：${principle}</p>
            
            <div style="margin-top: 15px;">
                <h4 style="font-size: 1rem; color: var(--text-main); margin-bottom: 8px;"><i class="fas fa-carrot"></i> 关键食材 (点击溯源):</h4>
                <ul class="ingredient-list" style="font-size: 0.9rem; line-height: 1.8;">
                    ${ingredients.replace(/\*/g, '').trim().split('\n').map(item => `<li>${item.trim()}</li>`).join('')}
                </ul>
            </div>
        </div>
        
        <div style="margin-top: 20px; display: flex; justify-content: space-between; align-items: flex-end;">
            <p style="font-size: 0.8rem; color: #888; max-width: 60%;">${traceability}</p>
            <button class="btn-primary" style="padding: 10px 15px; font-size: 0.9rem;" onclick="showRecipeDetail('${name}')">
                查看完整步骤 <i class="fas fa-arrow-right"></i>
            </button>
        </div>
    </div>
    `;
}

// 示例函数：查看完整步骤（通常是弹窗或跳转详情页）
function showRecipeDetail(name) {
    window.location.href = `recipe-detail.html?name=${encodeURIComponent(name)}`;
}

async function fetchRecipeDetail(recipeName) {
    const contentDiv = document.getElementById('recipeContent');
    const loadingDiv = document.getElementById('loadingState');
    let fullResponse = "";

    try {
        const response = await fetch(COZE_CONFIG.baseUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${COZE_CONFIG.token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                bot_alias: 'recipe', // Use server alias
                // bot_id: COZE_BOT_ID_RECIPES, // REMOVED
                user_id: 'user_recipe_gen',
                stream: true,
                auto_save_history: true,
                additional_messages: [{ 
                    role: 'user', 
                    content: `请生成【${recipeName}】的详细食谱，包含：1. 食材清单（精确到克）；2. 详细制作步骤；3. 每一味食材的中医功效与溯源地推荐（如：新会陈皮、宁夏枸杞）。请使用 Markdown 格式输出。`, 
                    content_type: 'text' 
                }]
            })
        });

        if (!response.ok) throw new Error(`API Error ${response.status}`);

        // 开始流式读取
        loadingDiv.style.display = 'none';
        contentDiv.style.display = 'block';

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let currentEvent = null;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop();

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed) continue;
                if (trimmed.startsWith('event:')) {
                    currentEvent = trimmed.slice(6).trim();
                    continue;
                }
                if (trimmed.startsWith('data:')) {
                    const dataStr = trimmed.slice(5).trim();
                    if (!dataStr || dataStr === '[DONE]') continue;
                    
                    try {
                        const data = JSON.parse(dataStr);
                        if ((currentEvent === 'conversation.message.delta' || data.event === 'conversation.message.delta') && data.type === 'answer') {
                            fullResponse += data.content;
                            // Render Markdown
                            if (typeof marked !== 'undefined') {
                                contentDiv.innerHTML = marked.parse(fullResponse);
                            } else {
                                contentDiv.innerText = fullResponse;
                            }
                        }
                    } catch (e) { console.warn('SSE Parse Error', e); }
                }
            }
        }
    } catch (error) {
        console.error(error);
        loadingDiv.innerHTML = `<p style="color: #ff6b6b;">获取食谱失败: ${error.message}</p>`;
    }
}

function highlightProducts() {
    // Simple implementation to satisfy the call
    const ingredients = document.querySelectorAll('.ingredient-list li');
    ingredients.forEach(li => {
        if (li.textContent.includes('溯源')) {
            li.style.color = 'var(--accent-color)';
            li.style.fontWeight = 'bold';
            li.style.cursor = 'pointer';
            li.title = '点击查看溯源信息';
            li.onclick = () => alert('溯源信息：' + li.textContent);
        }
    });
}

// 页面加载时执行
document.addEventListener('DOMContentLoaded', () => {
    if (document.body.id === 'recipes-page') {
        // 确保 recipes.html 的 body 标签有 id="recipes-page"
        loadRecipes(); // 首次加载默认体质和季节
    }
});
