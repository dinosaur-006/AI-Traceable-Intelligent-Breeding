# AI 滋补养生 (AI Health Tonic)

这是一个基于 AI 的滋补养生推荐系统，结合传统中医智慧与现代 AI 技术，为您提供个性化的养生方案。

## 功能特性

- **AI 智能顾问**: 实时问答，解答您的健康困惑 (基于 Coze API)
- **体质测评**: 专业的体质辨识，生成详细的健康报告
- **个性化方案**: 定制专属的 7 天滋补调理计划
- **食谱生成**: 根据季节与体质推荐养生食谱
- **节气海报**: 一键生成精美的节气养生海报

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

**必须配置的环境变量 (Zeabur 部署时请在 Settings -> Variables 中添加):**

| 变量名 | 描述 | 示例值 (请替换为真实值) |
|--------|------|------------------------|
| `COZE_API_TOKEN` | Coze API 访问令牌 | `pat_xxxx...` |
| `JWT_SECRET` | JWT 签名密钥 | `mysecretkey123` |
| `COZE_BOT_ID` | AI 健康顾问 Bot ID | `7578760034592161819` |
| `COZE_BOT_ID_POSTER` | 海报生成专家 Bot ID | `7579839388016934958` |
| `COZE_BOT_ID_PLAN` | 滋补计划专家 Bot ID | `7579232800697188386` |
| `COZE_BOT_ID_RECIPE` | 食疗菜谱助手 Bot ID | `7578549922430566450` |
| `COZE_BOT_ID_REPORT` | 体质测评师 Bot ID | `7576213925965299762` |

*注：以上 Bot ID 为项目预设的智能体 ID，请确保您有权访问或替换为您自己的 Bot ID。*

### 4. 启动服务

```bash
npm start
```

服务将在 http://localhost:8080 启动。

## 部署指南 (Zeabur)

1. 将代码推送到 GitHub。
2. 在 Zeabur 中创建新项目，选择 GitHub 仓库。
3. Zeabur 会自动检测 Node.js 项目并构建。
4. **重要**: 在 Zeabur 项目设置中，添加上述所有的环境变量。
5. 等待部署完成，访问生成的域名即可。

## 目录结构

- `server.js`: 后端 API 服务 (Express)
- `*.html`: 前端页面
- `styles.css`: 全局样式
- `data/`: 数据存储 (本地 JSON 文件)

## 贡献

欢迎提交 Issue 和 Pull Request。
