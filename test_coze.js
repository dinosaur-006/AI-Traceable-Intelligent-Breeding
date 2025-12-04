
// import fetch from 'node-fetch'; // Not needed in Node 18+
// Use native fetch
import 'dotenv/config';

const COZE_API_URL = process.env.COZE_API_URL || 'https://api.coze.cn/v3/chat';
const COZE_TOKEN = process.env.COZE_API_TOKEN;
const BOT_ID = process.env.COZE_BOT_ID;

async function testCoze() {
    console.log('Testing Coze API...');
    try {
        const response = await fetch(COZE_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${COZE_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                bot_id: BOT_ID,
                user_id: 'test_user',
                stream: false,
                auto_save_history: true,
                additional_messages: [
                    {
                        role: 'user',
                        content: '北京', // Test input
                        content_type: 'text'
                    }
                ]
            })
        });

        let chatData;
        if (!response.ok) {
            console.error('Status:', response.status);
            console.error('Text:', await response.text());
            return;
        } else {
            const json = await response.json();
            chatData = json.data;
            console.log('Chat Created:', chatData.id);
        }

        // Polling
        let status = chatData.status;
        while (status === 'in_progress' || status === 'created') {
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s
            const checkRes = await fetch(`${COZE_API_URL}/retrieve?chat_id=${chatData.id}&conversation_id=${chatData.conversation_id}`, {
                headers: {
                    'Authorization': `Bearer ${COZE_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            });
            const checkJson = await checkRes.json();
            status = checkJson.data.status;
            console.log('Status:', status);
        }

        if (status === 'completed') {
            // Get messages
            const msgRes = await fetch(`${COZE_API_URL}/message/list?chat_id=${chatData.id}&conversation_id=${chatData.conversation_id}`, {
                headers: {
                    'Authorization': `Bearer ${COZE_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            });
            const msgJson = await msgRes.json();
            console.log('Messages:', JSON.stringify(msgJson.data, null, 2));
        } else {
            console.error('Chat failed or cancelled:', status);
        }

    } catch (e) {
        console.error('Error:', e);
    }
}

testCoze();
