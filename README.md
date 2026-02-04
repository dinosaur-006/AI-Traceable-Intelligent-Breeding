# AI 滋补养生 (AI Health Tonic)

[![Deploy on Zeabur](https://zeabur.com/button.svg)](https://zeabur.com/deploy?template=https://github.com/dinosaur-006/AI-Traceable-Intelligent-Breeding)

这是一个基于 AI 的滋补养生推荐系统，集成了多个 Coze 智能体，提供全方位的健康管理服务。

## 🚀 功能特性

- **AI 顾问**：基于 Coze 智能体 (ID: 7578760034592161819) 的实时健康问答。
- **体质测评与分析**：专业的体质测评问卷，完成后自动调用 AI (ID: 7576213925965299762) 生成深度分析报告。
- **智能食谱定制**：根据食材或需求，AI (ID: 7578549922430566450) 生成详细的烹饪步骤和营养分析。
- **节气养生海报**：输入城市与季节，AI (ID: 7579839388016934958) 实时生成精美的养生海报。
- **用户中心**：完整的注册/登录流程，支持个人数据管理和历史记录查看。

## 🛠️ 快速开始

### 1. 克隆项目

```bash
git clone <your-repo-url>
cd AI滋补养生
```

### 2. 安装依赖

```bash
npm install
```

### 3. 本地开发

复制 `.env.example` 为 `.env`，并填入你的配置信息。

```bash
# 启动本地服务器 (默认端口 8080)
npm start
```

访问 http://localhost:8080 即可体验。

## ☁️ 部署指南 (Zeabur / Render)

本项目已适配 Zeabur 等容器化部署平台。

### 1. 部署步骤

1.  登录 [Zeabur Dashboard](https://dash.zeabur.com/)。
2.  创建一个新项目 (Project)。
3.  点击 "新建服务" (Create Service) -> "Git 仓库" (Git Repository)。
4.  选择本项目所在的 GitHub 仓库并导入。
5.  Zeabur 会自动识别 Node.js 项目并开始构建。

### 2. 环境变量配置 (必填)

在服务部署成功后，进入服务的 "变量" (Variables) 页面，必须添加以下环境变量，否则 AI 功能将无法正常使用：

| 变量名 | 描述 | 示例值 |
|--------|------|--------|
| `COZE_API_TOKEN` | **[必需]** Coze 平台的 Personal Access Token | `pat_xxxx...` |
| `COZE_BOT_ID_POSTER` | **[必需]** 海报生成智能体 ID | `7579839388016934958` |
| `JWT_SECRET` | **[必需]** 用于用户登录鉴权的密钥 | `any_secure_string` |
| `COZE_BOT_ID` | [可选] 默认对话智能体 ID | `7578760034592161819` |
| `COZE_API_URL` | [可选] Coze API 地址 | 默认为 `https://api.coze.cn/v3/chat` |

> 注意：食谱、顾问和分析智能体的 ID 目前已在前端 `config.js` 中配置，并通过 API 请求传递给后端，因此后端无需强制配置这些 ID 的环境变量，但必须配置 `COZE_API_TOKEN` 以通过鉴权。

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

## 📂 项目结构

- `config.js` - 前端 AI 配置文件 (Bot IDs)
- `main.js` - 前端通用 AI 调用逻辑
- `server.js` - 后端 API 代理服务器 (Express)
- `*.html` - 各功能模块页面
