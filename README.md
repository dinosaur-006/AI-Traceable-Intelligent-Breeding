# AI 滋补养生 (AI Health Tonic)

这是一个基于 AI 的滋补养生推荐系统。

## 功能特性

- 用户注册与登录
- AI 个性化养生方案推荐
- 健康测评
- 知识库问答 (基于 Coze API)

## 快速开始

### 1. 克隆项目

```bash
git clone <your-repo-url>
cd AI滋补养生
```

### 2. 安装依赖

```bash
npm install
```

### 3. 配置环境变量

复制 `.env.example` 为 `.env`，并填入你的配置信息：

```bash
cp .env.example .env
# Windows 用户可以使用: copy .env.example .env
```

编辑 `.env` 文件：

```env
COZE_API_URL=https://api.coze.cn/v3/chat
COZE_API_TOKEN=你的Coze_API_Token
COZE_BOT_ID=你的Coze_Bot_ID
JWT_SECRET=你的JWT密钥
PORT=3001
```

### 4. 启动服务

```bash
npm start
```

服务将在 http://localhost:3001 启动。

### 5. 测试 Coze 接口

```bash
node test_coze.js
```

## 部署

本项目可以直接部署到支持 Node.js 的云平台。确保在环境变量中配置上述 Key。

## 贡献

欢迎提交 Issue 和 Pull Request。
