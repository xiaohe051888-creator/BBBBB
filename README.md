# BBBBB — 百家乐走势分析与预测系统

> 一套基于真实桌面数据采集、五路走势图分析、三AI大模型协作预测的智能辅助系统。

---

## 目录

- [项目简介](#项目简介)
- [系统架构](#系统架构)
- [功能特性](#功能特性)
- [快速启动](#快速启动)
- [环境变量配置](#环境变量配置)
- [API 文档](#api-文档)
- [项目结构](#项目结构)
- [技术栈](#技术栈)
- [开发规范](#开发规范)

---

## 项目简介

BBBBB 是一套**百家乐走势分析与预测系统**，核心流程：

```
采集真实牌局数据 → 清洗去重 → 生成五路走势图 → 三模型 AI 分析预测 → 记录入库 → 模拟跟注决策 → 开奖结算复盘
```

- 支持 lile333.com **26桌、27桌**实时数据采集
- 基于权威五路走势图算法（大路、珠盘路、大眼仔路、小路、蟑螂路）
- 三 AI 大模型协作预测：**OpenAI GPT-4o-mini**（庄模型）+ **Claude Sonnet 4**（闲模型）+ **Gemini 1.5 Flash**（综合模型）
- 完整的错题本、模型版本管理与 AI 学习机制

---

## 系统架构

```
┌─────────────────────────────────────────────────┐
│                前端 (React + Vite)               │
│  启动页 → 仪表盘 → 走势图 → 分析板块 → 管理员页  │
│                   端口: 5173                     │
└──────────────────┬──────────────────────────────┘
                   │  REST API + WebSocket
┌──────────────────▼──────────────────────────────┐
│             后端 (FastAPI + Python)              │
│                   端口: 8000                     │
│                                                 │
│  ┌──────────────┐   ┌──────────────────────────┐│
│  │  采集模块    │   │     工作流引擎            ││
│  │ Lile333      │   │  loop_engine.py          ││
│  │ Scraper      │   │  150s 超时保护           ││
│  └──────┬───────┘   └────────────┬─────────────┘│
│         │                        │              │
│  ┌──────▼───────┐   ┌────────────▼─────────────┐│
│  │  五路引擎    │   │     三模型服务            ││
│  │ road_engine  │   │  庄模型 / 闲模型 / 综合  ││
│  └──────────────┘   └──────────────────────────┘│
│                                                 │
│  ┌──────────────────────────────────────────────┤
│  │         SQLite 数据库 (8张数据表)             │
│  └──────────────────────────────────────────────┤
└─────────────────────────────────────────────────┘
```

---

## 功能特性

### 数据采集
- Playwright 无头浏览器驱动，10 秒轮询一次
- 自动检测新靴（洗牌），按靴号隔离历史数据
- 最多保存全库最近 1000 局记录

### 五路走势图
严格遵循 baccarat.net 等权威网站的国际标准算法：

| 路图 | 说明 | 颜色含义 |
|------|------|---------|
| 大路 | 每列 ≤6 个，超限右移一格 | 红=庄，蓝=闲，绿=和 |
| 珠盘路 | 14列×6行，含庄/闲/和文字 | 同大路 |
| 大眼仔路 | 基于大路规律性，实心圆 | 红=延续，蓝=转折 |
| 小路 | 基于大路规律性，空心圆 | 红=延续，蓝=转折 |
| 蟑螂路 | 基于大路规律性，斜杠 | 红=延续，蓝=转折 |

> ⚠️ 下三路颜色**不代表庄闲**，代表走势的延续/转折规律

### 三模型 AI 预测
- 庄模型（OpenAI）：负责庄向证据分析
- 闲模型（Anthropic）：负责闲向证据分析  
- 综合模型（Gemini）：汇总两侧证据，输出最终预测 + 置信度
- **永不降级**：分析预测必须满血三模型，全部通过 httpx 直接调用 REST API

### 管理员系统
- JWT 认证，默认密码 `8888`（首次登录必须改密）
- 功能：AI 学习触发、模型版本管理、数据库查看、系统启停
- 最多保留 5 个模型版本，智能切换

---

## 快速启动

### 前置要求
- Python 3.10+
- Node.js 18+
- Playwright 浏览器（`playwright install chromium`）

### 方式一：手动启动

**后端**
```bash
cd backend

# 安装依赖
pip install -r requirements.txt

# 安装 Playwright 浏览器
playwright install chromium

# 配置环境变量（复制并编辑）
cp .env.example .env

# 启动后端
python main.py
# 或：uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

**前端**
```bash
cd frontend
npm install
npm run dev
```

访问 http://localhost:5173

### 方式二：Docker 启动

```bash
# 在项目根目录
cp backend/.env.example backend/.env
# 编辑 .env 填入 API 密钥

docker-compose up -d
```

访问 http://localhost:5173

---

## 环境变量配置

复制 `backend/.env.example` 为 `backend/.env` 并填写以下配置：

```env
# ===== AI 三模型 API 密钥（必填，三个都要配置）=====
OPENAI_API_KEY=sk-xxx           # GPT-4o-mini，用于庄模型
ANTHROPIC_API_KEY=sk-ant-xxx    # Claude Sonnet 4，用于闲模型
GEMINI_API_KEY=AIzaxxx          # Gemini 1.5 Flash，用于综合模型

# ===== 可选：自定义 API Base（代理加速）=====
OPENAI_API_BASE=https://api.openai.com/v1
ANTHROPIC_API_BASE=https://api.anthropic.com
GEMINI_API_BASE=https://generativelanguage.googleapis.com/v1beta

# ===== 可选：ofox.ai 统一代理 =====
OFOX_API_BASE=https://api.ofox.ai/v1
OFOX_API_KEY=ofox-xxx

# ===== 安全配置 =====
JWT_SECRET_KEY=your-secret-key-change-in-production
ADMIN_DEFAULT_PASSWORD=8888

# ===== 采集配置 =====
TARGET_TABLE_26_URL=https://rd.lile333.com/?d=26
TARGET_TABLE_27_URL=https://rd.lile333.com/?d=27
LILE333_HEADLESS=true

# ===== 跨域配置 =====
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
```

---

## API 文档

后端启动后，访问 http://localhost:8000/docs 查看完整 Swagger 文档。

### 公开 API（无需认证）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/system/health` | 系统健康状态 |
| GET | `/api/system/state` | 系统运行状态 |
| GET | `/api/games` | 游戏记录列表（分页） |
| GET | `/api/stats` | 统计数据 |
| GET | `/api/roads` | 五路走势图数据 |
| GET | `/api/roads/raw` | 原始走势数据 |
| GET | `/api/analysis/latest` | 最新 AI 分析结果 |
| GET | `/api/crawler/status` | 爬虫运行状态 |
| GET | `/api/logs` | 系统日志 |
| GET | `/api/bets` | 下注记录 |
| WS  | `/ws/{table_id}` | WebSocket 实时推送 |

### 管理员 API（需 JWT 认证）

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/admin/login` | 管理员登录 |
| POST | `/api/admin/change-password` | 修改密码 |
| GET | `/api/admin/model-versions` | 模型版本列表 |
| GET | `/api/admin/database-records` | 数据库记录查看 |
| POST | `/api/admin/ai-learning/start` | 触发 AI 学习 |
| GET | `/api/admin/ai-learning/status` | AI 学习状态 |
| GET | `/api/admin/three-model-status` | 三模型健康状态 |
| POST | `/api/system/start` | 启动系统 |
| POST | `/api/system/stop` | 停止系统 |
| POST | `/api/system/select-model` | 切换模型版本 |

---

## 项目结构

```
BBBBB/
├── backend/                    # Python FastAPI 后端
│   ├── main.py                 # 应用入口
│   ├── requirements.txt        # Python 依赖
│   ├── .env.example            # 环境变量模板
│   └── app/
│       ├── api/                # API 路由
│       │   ├── system.py       # 系统状态接口
│       │   ├── games.py        # 游戏记录接口
│       │   ├── analysis.py     # 分析预测接口
│       │   ├── admin.py        # 管理员接口
│       │   └── websocket.py    # WebSocket 接口
│       ├── core/
│       │   ├── config.py       # 全局配置
│       │   └── database.py     # 数据库初始化
│       ├── models/             # SQLAlchemy ORM 模型
│       ├── services/
│       │   ├── lile333_scraper.py      # 核心爬虫（Playwright）
│       │   ├── road_engine.py          # 五路走势图引擎
│       │   ├── three_model_service.py  # 三模型 AI 服务
│       │   ├── workflow_engine.py      # 主工作流引擎
│       │   ├── ai_learning_service.py  # AI 学习服务
│       │   ├── betting_service.py      # 模拟跟注服务
│       │   ├── smart_model_selector.py # 智能模型选择器
│       │   └── deprecated/             # 已废弃文件（勿删，备用）
│       └── utils/
│           └── loop_engine.py          # 主循环引擎（100s 监控）
│
├── frontend/                   # React + TypeScript 前端
│   ├── package.json
│   ├── vite.config.ts
│   └── src/
│       ├── App.tsx
│       ├── pages/              # 7 个页面
│       │   ├── StartPage/      # 启动页（选桌号 / 管理员入口）
│       │   ├── Dashboard/      # 主仪表盘
│       │   ├── AdminPage/      # 管理员功能页
│       │   ├── MistakeBook/    # 错题本页
│       │   └── ...
│       ├── components/         # 共享组件
│       ├── services/           # API 调用层
│       ├── hooks/              # 自定义 Hooks
│       └── types/              # TypeScript 类型定义
│
├── docs/                       # 开发文档（21 份）
│   ├── 00-主文档-总索引.md
│   ├── 01-项目总览.md
│   ├── ...
│   └── 20-智能分析板块实施与文案模板.md
│
├── docker-compose.yml          # Docker 编排
└── README.md                   # 本文件
```

---

## 技术栈

| 层 | 技术 |
|----|------|
| 前端框架 | React 18 + TypeScript + Vite |
| UI 组件库 | Ant Design |
| 后端框架 | FastAPI + Python 3.10+ |
| 数据库 | SQLite + SQLAlchemy 2.0 (async) |
| 实时通信 | WebSocket (FastAPI) |
| 数据采集 | Playwright（无头 Chromium） |
| AI 接入 | httpx 直调 REST API（无 SDK 依赖） |
| 容器化 | Docker + docker-compose |
| 认证 | JWT (python-jose) |

---

## 开发规范

### 核心铁律（不可违反）
1. **禁止虚拟/Mock 数据** — 所有 API 失败时显示空数据，绝不 fallback 到模拟数据
2. **三模型永不降级** — AI 预测必须调用满血三模型（GPT-4o-mini + Claude Sonnet 4 + Gemini 1.5 Flash）
3. **五路走势图标准** — 严格遵循国际权威算法，下三路颜色代表延续/转折，不代表庄闲

### 文档体系
`docs/` 目录包含 21 份设计文档，覆盖所有模块规范，开发前必读对应文档。

### 管理员密码
- 默认密码：`8888`
- 首次登录后**必须修改**

---

*文档版本：v1.0.0 | 最后更新：2026-04-09*
