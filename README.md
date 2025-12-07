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

## 部署到 Zeabur

本项目已优化适配 Zeabur 一键部署。

### 1. 部署步骤

1.  登录 [Zeabur Dashboard](https://dash.zeabur.com/)。
2.  创建一个新项目 (Project)。
3.  点击 "新建服务" (Create Service) -> "Git 仓库" (Git Repository)。
4.  选择本项目所在的 GitHub 仓库并导入。
5.  Zeabur 会自动识别 Node.js 项目并开始构建。

### 2. 环境变量配置

在服务部署成功后，进入服务的 "变量" (Variables) 页面，添加以下环境变量：

-   `COZE_API_TOKEN`: 你的 Coze API Token
-   `COZE_BOT_ID`: 你的 Coze Bot ID
-   `JWT_SECRET`: 生成 JWT 的密钥 (任意长字符串)
-   `COZE_API_URL`: (可选) 默认为 `https://api.coze.cn/v3/chat`
-   `COZE_BOT_ID_POSTER`: (可选) 用于生成海报的 Bot ID

### 3. 数据持久化 (重要)

本项目使用本地文件 `data/users.json` 存储用户数据。为了防止重新部署时数据丢失，**必须**配置持久化存储卷 (Volume)。

1.  在服务页面，点击 "挂载" (Volumes) 标签页。
2.  点击 "添加挂载" (Add Volume)。
3.  **挂载路径 (Mount Path)**: `/app/data`
    *   注意：Zeabur 默认将代码运行在 `/app` 目录下，所以数据目录是 `/app/data`。
    *   你可以查看服务日志中的 `Users file path` 输出，确认实际的绝对路径。
4.  保存配置。Zeabur 可能会重启服务以应用更改。

### 4. 域名绑定

1.  在 "域名" (Networking) 标签页。
2.  你可以生成一个 `*.zeabur.app` 的免费域名，或绑定自己的自定义域名。
3.  访问该域名即可使用服务。

## 贡献

欢迎提交 Issue 和 Pull Request。
