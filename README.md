# Baccarat AI Prediction & Auto-Trading System

基于 React Web + FastAPI 打造的高级量化自动托管分析系统。本系统结合了 **三路AI大模型**（OpenAI, Claude, Gemini）与 **量化强规则引擎**，实现对博弈趋势的毫秒级解析、自动下注与资金风控。

## 🎯 核心架构：双脑引擎驱动

系统通过管理员后台支持无缝切换“双脑”预测模式：

### 1. 🧠 AI 三模型深度交叉分析（AI Mode）
- **庄模型 (OpenAI)**：偏向保守防守与长期趋势识别。
- **闲模型 (Claude)**：擅长短线反转与震荡区间嗅探。
- **综合模型 (Gemini)**：统筹决策，结合系统特有的**等待期微学习（Micro-Learning）**与**错题本记忆（MistakeBook）**进行复盘进化。
- **机制**：通过高度结构化的 Prompt 分析“大路”与“下三路”的红蓝特征，输出高维度的博弈预测。

### 2. 📈 强规则量化引擎（Rule Engine Mode）
- **纯粹的数学量化**：摒弃 AI 幻觉，完全基于算法矩阵扫描。
- **动态权重进化 (Adaptive Weights)**：根据本靴最近 20 局的“长龙”与“单跳”出现频率，自动微调得分权重。
- **防爆瞬断检测 (Pattern Break)**：一旦识别到坚固的长龙规律被随机性瞬间打断（例如 5连庄后突开闲），引擎瞬间触发防守，暴扣追龙权重，拒绝无脑死磕。

---

## ⚙️ 核心机制与全托管哲学

系统已从早期的“人工辅助工具”彻底进化为**“全自动托管交易机器”**。

### 全自动下注与零逃课 (Enforced Auto-Betting)
- **每局必下**：系统不允许用户“手动下注”或“跳过下注”。无论 AI 是给出明确方向，还是退缩给出“观望/非法结果”，系统后端都会执行**强制兜底下注**。
- **隔离污染**：如果是“强规则引擎”在运行，系统会从物理层面切断大模型的 Token 消耗，绝不触发微学习和错题本，做到双脑 100% 物理隔离。

### 资金风控与熔断预警 (Margin Call & Circuit Breaker)
- **风险具象化**：风险不再体现在“是否下注”，而是体现在“下注金额”的收缩（降级为“保守”层级）。
- **2000元软预警**：当系统余额 $\le 2000$ 时，前端弹出橙色低水位预警，且具备防频繁刷屏锁。
- **0元硬熔断**：当系统余额不足以下注时，触发**系统级熔断**（Status = "余额不足"）。前端立刻封锁开奖按钮，禁止录入新数据，直到管理员前往后台执行“余额充值”。

---

## 🛠️ 技术栈与启动说明

### 后端 (Backend)
- **框架**: FastAPI (Python 3.10+) + SQLAlchemy + SQLite (异步)
- **特性**: 严格的 `with_for_update` 悲观锁、多模型异步并发请求与容错（指数退避重试）。
- **启动**: 
  ```bash
  cd backend
  python -m venv venv
  source venv/bin/activate
  pip install -r requirements.txt
  uvicorn app.main:app --host 0.0.0.0 --port 8000
  ```

### 前端 (Frontend)
- **框架**: React 18 + Vite + TypeScript + TailwindCSS / Ant Design
- **特性**: WebSocket 长链接 30秒心跳防假死保活、断线指数重连、React Query 乐观 UI 渲染、组件级内存泄漏严格控制。
- **启动**: 
  ```bash
  cd frontend
  npm install
  npm run dev
  ```

---

## 📁 目录结构摘要
* `backend/app/services/game/`
  * `analysis.py` (分析分发与降级拦截中心)
  * `rule_engine.py` (强规则量化算法核心)
  * `betting.py` (强制自动下注与破产拦截)
  * `reveal.py` (开奖结算与连错错题本隔离逻辑)
* `frontend/src/components/dashboard/`
  * `DashboardPage.tsx` (全自动托管主界面)
  * `AdminPage.tsx` (双脑切换与资金调账控制台)
