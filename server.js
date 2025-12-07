import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { v4 as uuidv4 } from 'uuid';
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
// Trust proxy (required for Zeabur/Render/Heroku)
app.set('trust proxy', 1); 

const PORT = process.env.PORT || 8080;
const JWT_SECRET = process.env.JWT_SECRET;

console.log('Initializing server...'); // Startup Log

// Coze API Config
const COZE_API_URL = process.env.COZE_API_URL || 'https://api.coze.cn/v3/chat';
const COZE_TOKEN = process.env.COZE_API_TOKEN;
const COZE_BOT_ID = process.env.COZE_BOT_ID;

const USERS_FILE = path.join(__dirname, 'data', 'users.json');

// ================= Middleware =================
app.use(helmet({
    contentSecurityPolicy: false, // Disable for local dev images/scripts
    crossOriginResourcePolicy: { policy: "cross-origin" }, // Allow cross-origin
    crossOriginEmbedderPolicy: false, // Disable COEP
    crossOriginOpenerPolicy: false // Disable COOP
}));
app.use(cors());
app.use(express.json());
// Serve static files
app.use(express.static(__dirname));

// Rate Limiter (Prevent Brute Force)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // Limit each IP to 20 requests per windowMs
    message: '请求过于频繁，请稍后再试'
});

// ================= Helpers =================
async function getUsers() {
    try {
        const data = await fs.promises.readFile(USERS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (e) {
        // If file doesn't exist or is empty, return empty array
        return [];
    }
}

async function saveUsers(users) {
    // Ensure directory exists (Only needed for local dev usually)
    const dir = path.dirname(USERS_FILE);
    if (!fs.existsSync(dir)){
        fs.mkdirSync(dir);
    }
    await fs.promises.writeFile(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
}

function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(String(email).toLowerCase());
}

function validatePassword(password) {
    // At least 8 chars, 1 uppercase, 1 lowercase, 1 number
    const re = /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{8,}$/;
    return re.test(password);
}

// Middleware to verify JWT
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) return res.status(401).json({ error: '未授权访问' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: '令牌无效或已过期' });
        req.user = user;
        next();
    });
}

// ================= Routes =================

// Health Check
app.get('/api', (req, res) => {
    res.json({ status: 'ok', env: process.env.NODE_ENV });
});

// 1. Register
app.post('/api/register', authLimiter, async (req, res) => {
    try {
        const { email, password, nick } = req.body;

        // Validation
        if (!email || !password || !nick) {
            return res.status(400).json({ error: '所有字段都是必填的' });
        }

        if (!validateEmail(email)) {
            return res.status(400).json({ error: '邮箱格式不正确' });
        }
        if (!validatePassword(password)) {
            return res.status(400).json({ error: '密码强度不足：需至少8位，包含大小写字母和数字' });
        }

        const users = await getUsers();
        if (users.find(u => u.email === email)) {
            return res.status(409).json({ error: '该邮箱已被注册' });
        }

        // Hash Password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUser = {
            id: Date.now().toString(),
            email,
            password: hashedPassword,
            nick,
            createdAt: new Date().toISOString(),
            profile: { // Default profile
                age: '--', height: '--', weight: '--', bio: '暂无个性签名'
            }
        };

        users.push(newUser);
        await saveUsers(users);

        res.status(201).json({ message: '注册成功，请登录' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: '服务器内部错误' });
    }
});

// 2. Login
app.post('/api/login', authLimiter, async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: '请输入邮箱和密码' });
        }

        const users = await getUsers();
        const user = users.find(u => u.email === email);

        if (!user) {
            return res.status(401).json({ error: '用户不存在或密码错误' });
        }

        // Support both 'password' (new) and 'passHash' (legacy) fields
        const dbPassword = user.password || user.passHash;
        if (!dbPassword) {
            // Should not happen for valid users, but handle it safely
            return res.status(401).json({ error: '用户数据异常，请联系管理员' });
        }

        const validPass = await bcrypt.compare(password, dbPassword);
        if (!validPass) {
            return res.status(401).json({ error: '用户不存在或密码错误' });
        }

        // Generate JWT
        const token = jwt.sign(
            { id: user.id, email: user.email, nick: user.nick },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            message: '登录成功',
            token,
            user: {
                nick: user.nick,
                email: user.email,
                profile: user.profile
            }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: '服务器内部错误' });
    }
});

// 3. Get Profile (Protected)
app.get('/api/user/profile', authenticateToken, async (req, res) => {
    const users = await getUsers();
    const user = users.find(u => u.id === req.user.id);
    if (!user) return res.status(404).json({ error: '用户未找到' });

    res.json({
        nick: user.nick,
        email: user.email,
        profile: user.profile || {}
    });
});

// 4. Update Profile (Protected)
app.put('/api/user/profile', authenticateToken, async (req, res) => {
    try {
        const { nick, age, height, weight, bio, assessment, aiReport } = req.body;
        const users = await getUsers();
        const userIndex = users.findIndex(u => u.id === req.user.id);

        if (userIndex === -1) return res.status(404).json({ error: '用户未找到' });

        // Update fields
        if(nick) users[userIndex].nick = nick;
        
        // Update nested profile
        const currentProfile = users[userIndex].profile || {};
        const newProfile = {
            ...currentProfile,
            age: age || currentProfile.age,
            height: height || currentProfile.height,
            weight: weight || currentProfile.weight,
            bio: bio || currentProfile.bio,
            aiReport: aiReport || currentProfile.aiReport
        };

        // Handle assessment specifically to maintain history
        if (assessment) {
            newProfile.assessment = assessment; // Latest
            if (!newProfile.assessmentHistory) {
                newProfile.assessmentHistory = [];
            }
            // Add to history if it's a new one (checking date or simple push)
            newProfile.assessmentHistory.push(assessment);
        }

        users[userIndex].profile = newProfile;

        await saveUsers(users);

        res.json({
            message: '资料更新成功',
            user: {
                nick: users[userIndex].nick,
                profile: users[userIndex].profile
            }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: '服务器错误' });
    }
});

// 5. Forgot Password
app.post('/api/forgot-password', authLimiter, async (req, res) => {
    try {
        const { email } = req.body;
        if(!email) return res.status(400).json({ error: '请输入邮箱' });

        const users = await getUsers();
        const user = users.find(u => u.email === email);

        if(user) {
            const resetToken = uuidv4();
            user.resetToken = resetToken;
            user.resetTokenExp = Date.now() + 3600000; // 1 hour
            await saveUsers(users);

            console.log(`[Email Service] To: ${email}`);
            console.log(`[Email Service] Subject: 重置密码`);
            const resetLink = `${req.protocol}://${req.get('host')}/reset_password.html?token=${resetToken}`;
            console.log(`[Email Service] Link: ${resetLink}`);
        }
        
        // Always return success to prevent email enumeration
        res.json({ message: '如果该邮箱已注册，重置链接已发送到您的邮箱。' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server Error' });
    }
});

// 6. Reset Password
app.post('/api/reset-password', authLimiter, async (req, res) => {
    try {
        const { token, newPassword } = req.body;
        if(!token || !newPassword) return res.status(400).json({ error: '无效请求' });

        if (!validatePassword(newPassword)) {
            return res.status(400).json({ error: '密码强度不足：需至少8位，包含大小写字母和数字' });
        }

        const users = await getUsers();
        const user = users.find(u => u.resetToken === token && u.resetTokenExp > Date.now());

        if(!user) return res.status(400).json({ error: '重置链接无效或已过期' });

        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);
        user.resetToken = null;
        user.resetTokenExp = null;
        
        await saveUsers(users);
        
        res.json({ message: '密码重置成功，请使用新密码登录' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server Error' });
    }
});

// 8. Recipes API (Mock)
app.get('/api/recipes', (req, res) => {
    const { season, tizhi } = req.query;
    res.json([
        { id: 1, title: '黄芪党参乌鸡汤', tags: ['气虚质', '春季'] },
        { id: 2, title: '陈皮红豆沙', tags: ['痰湿质', '四季'] }
    ]);
});

// 9. Coze Chat Proxy
app.post('/api/chat', async (req, res) => {
    try {
        const { message, stream, user_id, bot_id, bot_alias, additional_messages } = req.body;
        
        // Use the token from environment
        const token = COZE_TOKEN; 
        
        if (!token) {
             console.error('Coze API Token is missing!');
             return res.status(500).json({ error: 'Server configuration error: Missing API Token' });
        }

        // Determine Bot ID: 
        // 1. Client provided ID (highest priority)
        // 2. Client provided Alias (maps to env COZE_BOT_ID_ALIAS)
        // 3. Default Env ID
        let targetBotId = bot_id;
        if (!targetBotId && bot_alias) {
            const envKey = `COZE_BOT_ID_${bot_alias.toUpperCase()}`;
            targetBotId = process.env[envKey];
        }
        if (!targetBotId) {
            targetBotId = COZE_BOT_ID;
        }

        if (!targetBotId) {
             return res.status(400).json({ error: 'Bot ID not configured' });
        }

        // Construct payload
        const payload = {
            bot_id: targetBotId, 
            user_id: user_id || 'user_default',
            stream: stream !== false,
            auto_save_history: true
        };

        if (additional_messages) {
            payload.additional_messages = additional_messages;
        } else if (message) {
            payload.additional_messages = [
                {
                    role: 'user',
                    content: message,
                    content_type: 'text'
                }
            ];
        }

        const response = await fetch(COZE_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${COZE_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Coze API Error:', errorText);
            return res.status(response.status).json({ error: `Coze API Error: ${response.statusText}` });
        }

        if (stream !== false) {
            // Pipe the stream to the client
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let chunkCount = 0;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value);
                
                // Debug log for first few chunks
                if (chunkCount < 3) {
                    console.log(`[Coze Stream Chunk ${chunkCount}]:`, chunk.substring(0, 100));
                    chunkCount++;
                }

                res.write(chunk);
            }
            res.end();
        } else {
            const data = await response.json();
            res.json(data);
        }

    } catch (error) {
        console.error('Chat Proxy Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// 10. Generate Poster
app.post('/api/generate-poster', async (req, res) => {
    try {
        const { area } = req.body;
        if (!area) {
            return res.status(400).json({ error: '请输入地区信息' });
        }

        // Use Poster Bot ID
        const posterBotId = process.env.COZE_BOT_ID_POSTER;
        if (!posterBotId) {
            console.error('Missing COZE_BOT_ID_POSTER');
            return res.status(500).json({ error: '服务配置错误：缺少海报生成机器人ID' });
        }
        if (!COZE_TOKEN) {
             return res.status(500).json({ error: '服务配置错误：缺少 API Token' });
        }

        // 1. Create Chat
        const createRes = await fetch(COZE_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${COZE_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                bot_id: posterBotId, // Use specific bot ID
                user_id: 'user_poster_' + Date.now(),
                stream: false,
                auto_save_history: true,
                additional_messages: [
                    {
                        role: 'user',
                        content: area,
                        content_type: 'text'
                    }
                ]
            })
        });

        if (!createRes.ok) {
            const errText = await createRes.text();
            console.error('Coze Create Error:', errText);
            return res.status(createRes.status).json({ error: 'Failed to start generation task' });
        }

        const chatData = (await createRes.json()).data;
        const { id: chatId, conversation_id: conversationId } = chatData;

        // 2. Poll for status
        let status = chatData.status;
        let attempts = 0;
        const maxAttempts = 60; // 60 seconds timeout

        while ((status === 'in_progress' || status === 'created') && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            attempts++;
            
            const checkRes = await fetch(`${COZE_API_URL}/retrieve?chat_id=${chatId}&conversation_id=${conversationId}`, {
                headers: {
                    'Authorization': `Bearer ${COZE_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            });
            const checkJson = await checkRes.json();
            status = checkJson.data.status;
        }

        if (status !== 'completed') {
             return res.status(504).json({ error: '生成超时或失败，请重试' });
        }

        // 3. Get Messages
        const msgRes = await fetch(`${COZE_API_URL}/message/list?chat_id=${chatId}&conversation_id=${conversationId}`, {
            headers: {
                'Authorization': `Bearer ${COZE_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });
        const msgJson = await msgRes.json();
        
        if (msgJson.code !== 0 || !msgJson.data) {
             console.error('Coze Message Error:', msgJson);
             return res.status(500).json({ error: '获取生成结果失败' });
        }

        const messages = msgJson.data;

        // 4. Extract Image URL
        // Find the last assistant message
        const assistantMsgs = messages.filter(m => m.role === 'assistant' && m.type === 'answer');
        
        if (assistantMsgs.length === 0) {
             // If no answer, maybe it failed or produced something else. 
             // Sometimes the last message is tool output, but we need the answer that contains the image.
             return res.status(500).json({ error: '未获取到AI生成结果' });
        }
        
        const lastMsg = assistantMsgs[assistantMsgs.length - 1];
        const content = lastMsg.content;

        // Extract image from markdown ![image](url) or json format
        const imgRegex = /!\[.*?\]\((.*?)\)/;
        const match = content.match(imgRegex);
        
        let imageUrl = '';
        if (match && match[1]) {
            imageUrl = match[1];
        } else {
             const urlRegex = /(https?:\/\/[^\s]+)/;
             const urlMatch = content.match(urlRegex);
             if (urlMatch) {
                 imageUrl = urlMatch[0];
             }
        }
        
        if (!imageUrl) {
             return res.json({ imageUrl: null, text: content });
        }

        // 5. Save to User History (if authenticated)
        const authHeader = req.headers['authorization'];
        if (authHeader) {
            const token = authHeader.split(' ')[1];
            try {
                const decoded = jwt.verify(token, JWT_SECRET);
                const users = await getUsers();
                const userIndex = users.findIndex(u => u.id === decoded.id);
                
                if (userIndex !== -1) {
                    if (!users[userIndex].posterHistory) {
                        users[userIndex].posterHistory = [];
                    }
                    users[userIndex].posterHistory.unshift({
                        id: Date.now().toString(),
                        url: imageUrl,
                        area: area,
                        createdAt: new Date().toISOString()
                    });
                    // Limit history to last 20
                    if (users[userIndex].posterHistory.length > 20) {
                        users[userIndex].posterHistory = users[userIndex].posterHistory.slice(0, 20);
                    }
                    await saveUsers(users);
                }
            } catch (err) {
                console.warn('Failed to save poster to history:', err.message);
                // Continue, don't fail the request just because history save failed
            }
        }

        res.json({ imageUrl });

    } catch (error) {
        console.error('Generate Poster Error:', error);
        res.status(500).json({ error: '服务器内部错误' });
    }
});

// 11. Get Poster History
app.get('/api/user/posters', authenticateToken, async (req, res) => {
    try {
        const users = await getUsers();
        const user = users.find(u => u.id === req.user.id);
        if (!user) return res.status(404).json({ error: 'User not found' });
        
        res.json({ history: user.posterHistory || [] });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server Error' });
    }
});

// 7. Start Server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
});

export default app;
