const CONFIG = {
    // Coze API Configuration
    // In production (Zeabur), we use the backend proxy to hide the API Key.
    // The backend will read COZE_API_TOKEN from environment variables.
    
    // API Endpoint
    // Use '/api/chat' to route through the local Node.js server (server.js)
    API_BASE_URL: '/api/chat',

    // Bot IDs
    ADVISOR_BOT_ID: '7578760034592161819',      // AI 顾问 (Chat)
    POSTER_BOT_ID: '7579839388016934958',       // 节气海报 (Image)
    RECIPE_BOT_ID: '7578549922430566450',       // 食谱生成 (Recipe Details)
    ANALYSIS_BOT_ID: '7576213925965299762',     // 体质分析 (Analysis)

    // Toggle Mock Mode
    // Set to false to try the real backend proxy. 
    // If backend is not running or fails, main.js will fallback to mock.
    USE_MOCK: false 
};
