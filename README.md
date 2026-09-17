# TripSplit - 出行 AA 智能分账助手

TripSplit 是一款专为多人旅行、聚会、合租等场景打造的高效 AA 记账与债务精简分摊平台。支持自然语言 AI 记账、贪心债务网络精简最小化还款笔数、多币种实时汇率转换、多设备免登录实时同步协同。

---

## 🌟 核心特性

1. **🤖 自然语言 AI 记账**
   - 支持 DeepSeek / 规则双引擎智能语义提取。
   - 输入任意日常语句（如“小张付了晚餐 320 元，我和阿伟平摊”、“昨晚打车 45 块我付的”），自动提取金额、币种、类别、付款人及平摊成员，并弹出可交互确认卡片。

2. **⚡ 贪心债务网络精简算法 (Debt Simplification)**
   - 采用图算法将复杂的多人交叉欠款网络收敛为全局最优的净差额结算方案。
   - 大幅缩减转账笔数（如 5 个人产生 12 笔琐碎消费，一键结算只需 2~3 笔转账即可全部结清）。
   - 支持单笔消费“结清此单”快速结算与结算凭证撤销回滚。

3. **🔄 多端实时静默同步与动态身份认领**
   - **多端实时同步**：3.5 秒静默轮询 + 切回前台/亮屏即时唤醒同步，一人记账全员实时可见。
   - **防缓存设计**：服务端与客户端双重禁止 HTTP 缓存，彻底解决微信和移动端浏览器数据延迟问题。
   - **身份认领**：好友通过口令或链接进入房间，只需选择自己的真实名字即可绑定本设备视角，精准高亮展示 `(我)` 相关的收支统计与应还金额。

4. **🌐 多币种与实时结算**
   - 原生支持人民币 (CNY)、韩元 (KRW)、日元 (JPY)、美元 (USD)、欧元 (EUR)、泰铢 (THB) 等主流币种。
   - 支持按行程基准币种统一换算，支持自定义汇率微调。

5. **🔐 开发者隐藏入口**
   - 连续快速点击顶部左侧 Logo 5 次，输入管理员密钥进入配置面板，方便在线更新 DeepSeek API Key 与系统参数。

---

## 🛠 技术栈

- **前端**：React 19 + TypeScript + Vite + Tailwind CSS + Lucide Icons
- **后端**：Node.js + Express + TypeScript + esbuild
- **数据库**：SQLite 3 (WAL 模式，零依赖轻量可靠，采用 better-sqlite3 驱动)
- **大模型**：DeepSeek Chat API (兼容 OpenAI 规范)
- **单元测试**：Vitest

---

## 🚀 本地开发与运行

### 1. 安装依赖
```bash
npm install
```

### 2. 启动本地全栈开发环境
```bash
# 同时启动 Vite 前端开发服务器 (默认端口 5173) 与 Node.js 后端服务 (默认端口 81)
npm run dev
```

### 3. 运行自动化单元测试
```bash
npm test
```

### 4. 生产环境构建与启动
```bash
npm run build
npm start
```

---

## 📦 生产部署说明

本项目已支持自动化部署。云服务器部署结构建议如下：

- **部署目录**：`/opt/tripsplit`
- **监听端口**：`81`
- **Systemd 服务**：`tripsplit.service`

```bash
# 启动服务
systemctl start tripsplit.service

# 查看服务状态
systemctl status tripsplit.service

# 重启服务
systemctl restart tripsplit.service
```

---

## 📄 目录架构

```
tripsplit/
├── src/                      # 前端源代码
│   ├── components/           # UI 组件 (AI记账卡片、债务结算、时间轴、导航栏等)
│   ├── services/             # HTTP API 请求层 (带时间戳防缓存机制)
│   ├── utils/                # 债务精简图算法、货币转换计算、语音与剪贴板工具
│   ├── types/                # 全局 TypeScript 类型定义
│   ├── App.tsx               # 根组件与多端同步状态调度
│   └── main.tsx              # 应用渲染入口
├── server/                   # 后端源代码
│   ├── routes/               # API 路由 (trips, expenses, settlements, ai, settings)
│   ├── ai/                   # DeepSeek API 客户端与规则启发式解析器
│   ├── db.ts                 # SQLite 初始化与 WAL 事务配置
│   └── index.ts              # Express 服务入口
├── deploy/                   # 部署脚本与 systemd 服务配置文件
├── data/                     # SQLite 数据持久化目录 (*.db)
└── package.json              # 项目依赖与 npm scripts
```

