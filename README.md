# AI 角色参考与合成工作台 · 中文版（3合1）

> **姿势库（1,439 张） + 服装库（1,440 套） + 人像库（1,466 位） = 4,345 条中文参考数据 / 10,097 张本地高清图**，集成多协议 AI 角色合成台。

![画廊预览](docs/preview.jpg)

<details><summary>手机端预览</summary>

![手机端预览](docs/mobile.jpg)

</details>

**在线演示：** <https://ai-pose-gallery.anhao.app/>
**原始站点：**
- 姿势库：<https://ai-pose-gallery.pages.dev/>
- 服装库：<https://ai-costume-gallery.pages.dev/>
- 人像库：<https://ai-portrait-gallery.pages.dev/>

**原作者：** ギア（@giaaibusi）
**中文版维护：** Anhao · [X @anhao_ai](https://x.com/anhao_ai)
**GitHub：** <https://github.com/anhao/ai-pose-gallery-zh>

---

## 这是什么

原站是ギア（@giaaibusi）发布的三大 AI 绘画参考图库（姿势、服装、人像），元数据全部为日文，且分散在三个独立站点。本仓库（v2.0）完成了**三站合一与工作台升级**：

1. **三库全量镜像（10,097 张图）** —— 完整拉取姿势库（2,878 张）、服装库（2,880 张）、人像库（4,339 张，含全身图）的全部缩略图与高清原图，支持纯离线/静态托管。
2. **100% 完整汉化（1,280 条词条）** —— 日文体系、分类、姿势名称、服装款式、色系、人像主题、发型、发色、表情、饰品等全部逐条译为地道中文，零日文残留。
3. **三合一 AI 角色合成工作台** —— 基于 **React 19 + Tailwind CSS 4 + TypeScript 7 + shadcn/ui + TanStack Router** 构建的响应式多页面应用（兼容 PC / 平板 / 手机）：
   - 从三大图库任意挑选 **人像 + 服装 + 姿势** 组合配方，或一键随机捏人；
   - 支持拖拽 / 剪贴板粘贴（`Cmd+V` / `Ctrl+V`） / URL 添加多张自定义附加参考图；
   - 内置 **5 大主流 AI 图像协议直连**（Gemini、OpenAI GPT、阿里千问 Qwen、字节豆包 Seedream、MiniMax 海螺），支持直接传递公网图片 URL 或 Base64，生成记录通过 **IndexedDB** 本地持久化保存。

---

## 核心功能

### 1. 三大参考图库（姿势 / 服装 / 人像）
- **姿势参考库（`/poses`）**：4 大体系、26 个动作分类、288 组姿势、5 种视角（正面 / 斜侧 / 侧面 / 俯视 / 仰视），支持**按姿势分组 / 逐张浏览**双模式及卡片内多角度切换。
- **服装参考库（`/costumes`）**：4 大体系（标准 / 性感 / 绅士 / 梦幻）、40 种款式分类、12 种色系筛选。
- **人像参考库（`/portraits`）**：3 大体系、12 种主题、发型 / 发色 / 眼睛颜色 / 表情多维筛选，灯箱支持**半身肖像 / 全身立绘**一键切换。
- **统一交互体验**：关键词实时检索、灯箱高清原图预览与 PNG 下载、一键「加入合成配方」。

### 2. AI 角色合成台（`/studio`）
- **3+N 参考图组合**：3 个核心槽位（人像 / 服装 / 姿势）+ 任意张自定义附加参考图（点击上传、拖拽文件、剪贴板粘贴、填写图片 URL）。
- **参考拼图预览与导出**：弹窗查看三合一高清参考拼图（`1800×1200` Canvas 合成），支持一键下载拼图 PNG。
- **12 种画风预设 & 自动提示词**：内置「无预设（跟随参考图）」、日系赛璐璐、厚涂插画、写实摄影、水彩、国风、3D 渲染等 12 种画风，根据已选素材自动组装中英双语结构化 Prompt。
- **多协议 AI 生图与高级参数**：
  - **Google Gemini**：`gemini-3.1-flash-image-preview`、`gemini-3-pro-image-preview`、`gemini-2.5-flash-image`（支持宽高比 `aspectRatio`、分辨率 `1K/2K/4K`）
  - **OpenAI GPT Image**：`gpt-image-1.5`、`gpt-image-1`、`gpt-image-1-mini`（支持 `/v1/images/edits` JSON URL 直传 / Multipart 上传、尺寸、质量、背景透明度）
  - **阿里千问 Qwen-Image**：`qwen-image-2.0-pro`、`qwen-image-2.0`、`qwen-image-edit-max`（支持 `multimodal-generation` 多图参考输入、智能改写 `prompt_extend`、水印开关）
  - **字节豆包 Seedream**：`doubao-seedream-5-0-260128`、`doubao-seedream-4-5-251128`、`doubao-seedream-4-0-250828`（支持多图融合 `image: [...]`、2K/4K 分辨率）
  - **MiniMax 海螺**：`image-01`、`image-01-live`（`/v1/image_generation`，支持 `subject_reference` 单张角色参考、`aspect_ratio`、`prompt_optimizer`、`seed`、`n`、`url/base64` 返回；注意官方每次仅接受 1 张参考图，服装 / 姿势需靠提示词描述）
- **自订第三方供应商（v2.2 新增）**：设定页可分「内置 / 自订」两个分页。自订供应商可自由填 Base URL、模型 ID、用途（生图 / 文字）与认证方式，协议支持 `openai_images`、`openai_chat`（含 Ollama Cloud 等 OpenAI 兼容服务）、`gemini_native`、`dashscope`、`ark`、`minimax`，以及完全自订的 `custom_json`。文字用途的供应商可作为「提示词扩写」后端，合成台会出现「AI 扩写」按钮。
- **OAuth 登入（v2.2 新增）**：自订供应商支持 OAuth 授权码 + PKCE（弹窗回调 `/oauth/callback`）与 Device Code 两种流程；token 存在浏览器 IndexedDB，临近过期自动用 refresh_token 续期。
- **跨页面后台生图 & IndexedDB 历史记录**：切换页面不会中断正在进行的生图请求；生成结果自动存入浏览器 IndexedDB（避免 `localStorage` 容量限制），支持复用提示词与原图下载。

---

## 数据规模

| 图库 | 体系划分 | 记录数 | 本地图片文件数 |
| --- | --- | ---: | ---: |
| **姿势库（Pose）** | 全身标准 (365) · 全身性感 (399) · 上半身 (400) · 双人缠绵 (275) | 1,439 | 2,878 张（缩略图 + 原图） |
| **服装库（Costume）** | 标准系 (400) · 性感系 (400) · 绅士系 (400) · 梦幻系 (240) | 1,440 | 2,880 张（缩略图 + 原图） |
| **人像库（Portrait）** | 标准系 (810) · 梦幻系 (416) · 绅士系 (240) | 1,466 | 4,339 张（缩略图 + 肖像原图 + 全身原图） |
| **合计** | **11 个体系** | **4,345** | **10,097 张** |

---

## 技术栈与目录结构

- **前端框架**：React 19.3 + TypeScript 7.0 + Vite 8 (Rolldown)
- **路由与状态**：TanStack Router + TanStack Query + IndexedDB 本地存储
- **样式与组件**：Tailwind CSS 4.3 + shadcn/ui (Radix UI) + Lucide Icons
- **代码质量**：Oxlint + Oxfmt

```text
.
├── src/
│   ├── components/         # 通用组件、AppLayout 响应式导航、GalleryLightbox 灯箱、RecipeDock
│   ├── routes/             # 页面路由：概览(index)、姿势(poses)、服装(costumes)、人像(portraits)、合成台(studio)、配置(settings)、指南(guide)
│   ├── services/           # AI 多协议图像生成客户端 (aiGenerator.ts) 与 Canvas 拼图合成 (canvasComposer.ts)
│   ├── store/              # 全局配方、生图状态与 IndexedDB 历史管理 (studioStore.tsx)
│   ├── lib/                # 数据加载器 (dataLoader.ts) 与 IndexedDB 工具 (idbStorage.ts)
│   └── types/              # 三库数据结构与 4 大 AI 协议类型定义 (gallery.ts)
├── data/
│   ├── pose.json / pose-zh.json                 # 姿势库日文原始数据 & 中文数据（1,439 条）
│   ├── costume.json / costume-zh.json           # 服装库日文原始数据 & 中文数据（1,440 条）
│   ├── portrait.json / portrait-zh.json         # 人像库日文原始数据 & 中文数据（1,466 条）
│   ├── *-meta-zh.json                           # 三库中文体系分类元数据
│   └── translations.csv                         # 日⇄中对照表（1,280 条）
├── thumbs/                 # 缩略图目录（姿势根目录 + costume/ + portrait/）
├── img/                    # 高清原图目录（姿势根目录 + costume/ + portrait/ + portrait/fullbody/）
├── scripts/
│   ├── download.py         # 三站并发下载器（断点续传 / 自动重试）
│   ├── i18n.py             # 日译中词典（1,280 条唯一译文）
│   ├── apply_translation.py# 生成三库 *-zh.json 中文数据与检索索引
│   ├── verify.py           # 校验 10,097 张图片完整性（存在性 / 大小 / 文件头）
│   └── build.sh            # 构建 Cloudflare Pages 发布目录 dist/
├── skills/                 # Claude Code / Agent 姿势检索技能包
└── README.md
```

---

## 自架部署（本機 + Tailscale）

不想用 Cloudflare 也可以整個跑在自己機器上。`scripts/serve.mjs` 是一個零依賴的 Node 伺服器：靜態檔案 + `/api/proxy` + `/api/oauth/token`，行為與線上 Worker 版一致。

```bash
pnpm build                 # 只有前端程式碼需要 build；素材不複製
node scripts/serve.mjs     # → http://127.0.0.1:8789
```

- 素材（`img/` `thumbs/` `data/`）直接從 repo 根目錄出，不做 1.1GB 拷貝。
- 未知路徑回 `dist/index.html`（前端路由 fallback）。

### 三個位址別搞混

| 位址 | 是什麼 |
|---|---|
| `https://ai-pose-gallery-zh.tutumomo.workers.dev/` | 網站本體，跑在 Cloudflare |
| `http://100.84.216.26:8789/`（或 `http://127.0.0.1:8789/`） | 網站本體，跑在本機（同一份程式碼） |
| `http://127.0.0.1:8788/v1`、`/agy/v1` | **API 端點**，不是網站；是本機 gateway 給 app 呼叫的介面 |

呼叫鏈：**網站 → gateway(8788) → magpie / agy → 你的訂閱額度**

實測限制：`https://…workers.dev` **無法**呼叫 `http://…:8788`（Mixed Content + Private Network Access 兩重封鎖）。要用 magpie / agy 只能開自架版 `http://…:8789`。

另外 `workers.dev` 與 `8789` 是不同 origin，API Key / 自訂供應商 / 生成歷史**各自存在各的瀏覽器儲存**，不會同步。

### systemd 常駐（本機已設定）

```bash
systemctl --user status pose-gallery.service pose-gallery-gateway.service
systemctl --user restart pose-gallery.service
```

| 服務 | 監聽 | 用途 |
|---|---|---|
| `pose-gallery.service` | `127.0.0.1:8789` + `100.84.216.26:8789` | 網站本體 + API 端點 |
| `pose-gallery-gateway.service` | `127.0.0.1:8788` + `100.84.216.26:8788` | 本機上游 CORS 轉接（magpie / agy） |

綁 Tailscale IP 而不是 `0.0.0.0`，避免曝露在區網。手機裝 Tailscale 後直接開 **http://100.84.216.26:8789** 就能用。

### 從手機用本機供應商（magpie / agy）

瀏覽器跑在手機時，provider 的 Base URL 要填**桌面機的 Tailscale 位址**，不是 `127.0.0.1`：

| 用途 | Base URL |
|---|---|
| magpie 生圖 | `http://100.84.216.26:8788/v1` |
| agy Antigravity | `http://100.84.216.26:8788/agy/v1` |

同時把「參考圖傳參方式」改成 **轉 Base64 編碼傳輸** —— 雲端模型抓不到 `100.84.216.26` 上的圖片。

### 想公開給別人用

```bash
cloudflared tunnel --url http://127.0.0.1:8789   # 免帳號，網址每次重啟會變
```

要固定網域就用具名隧道（需 `cloudflared tunnel login` + 你自己的網域）。

## 本機 Gateway（magpie / 本機模型）

> app 內建的「快速范本」只保留 **MiniMax** 與 **Ollama Cloud**（線上版連不到本機 gateway，所以不再提供 magpie / agy 范本）。
> 要用本機上游時請手動新增供應商：Base URL 填 `http://127.0.0.1:8788/v1`（生圖）或 `http://127.0.0.1:8788/agy/v1`（文字），認證方式選「不驗證（本機 gateway / agy）」。


瀏覽器不能直接呼叫 `127.0.0.1` 的上游（沒有 CORS），而線上版是 https、fetch 到 http 又會被 mixed content 擋。所以本機上游要走一個小 gateway：

```bash
cd ~/ai-pose-gallery-zh
node scripts/local-gateway.mjs      # → http://127.0.0.1:8788，轉發 /v1/* 到 http://127.0.0.1:3425
```

API key 只留在 gateway process 內（優先讀 `MAGPIE_API_KEY` 環境變數，其次 `~/.gemini/.env` 的 `GEMINI_API_KEY`），不會送進瀏覽器。

接著在 app 裡（**用本機 `pnpm dev` 開 `http://localhost:5173`**）：

1. 設定頁 →「自訂供應商」→「新增供應商」→「快速範本」選 **magpie 本機閘道 · 生圖**（Base URL `http://127.0.0.1:8788/v1`，模型 `workbuddy-ai/hy-image-3.5`）。
2. 全域請求選項把「參考圖傳參方式」改成 **轉 Base64 編碼傳輸**（magpie 上游只吃 base64，不吃公網 URL）。
3. 合成台選這個供應商 → 生成角色圖。

要把 Google Pro 訂閱額度（Antigravity）也用上：範本選 **magpie · Antigravity（Google Pro 額度）**，模型如 `antigravity/gemini-4-argon`、`antigravity/claude-opus-5-5`；它是文字模型，到設定頁「提示詞擴寫」把它設為提示詞供應商，合成台的「AI 擴寫」就會走你的 Pro 額度。

> 線上部署版（`*.workers.dev`）無法連到 `127.0.0.1`，要用 magpie 就跑本機版；若要線上也能用，需要另外把 gateway  exposes 出去（tunnel / VPS）。

### Antigravity CLI（Google Pro 额度）走本机 bridge

`scripts/local-gateway.mjs` 除了轉發 `/v1/*`，還會把 `/agy/v1/*` 交給本機的 **Antigravity CLI（`agy`）**：

```
瀏覽器 → http://127.0.0.1:8788/agy/v1/chat/completions → agy -p "…" → 你的 Google 帳號額度
```

- `agy` 自己處理 Google 帳號 OAuth，token 不經過 gateway、也不進瀏覽器。
- app 端設定：自訂供應商 → 快速範本選 **agy Antigravity（Google Pro 额度）**（Base URL `http://127.0.0.1:8788/agy/v1`），再到「提示詞擴寫」把它設為提示詞供應商。
- 可用模型：`gemini-4-argon-high`、`magpie/antigravity/gemini-4-argon`、`magpie/antigravity/claude-sonnet-5-5`、`magpie/group/gemini`（用 `agy models` 可看完整清單；`AGY_MODELS` 環境變數可覆寫）。
- 額度錯誤長這樣（代表 **Google 帳號的 Antigravity 額度用完**，不是設定錯）：
  ```
  Antigravity: Individual quota reached. … Resets in 11m36s.
  ```
- 想讓 `agy` 完全走自己的 Google 帳號（不經 magpie）：把 `~/.gemini/antigravity-cli/settings.json` 的 `modelProvider` 移除後重新登入。

## 部署（一定要用 scripts/deploy.sh）

```bash
bash scripts/deploy.sh
```

**不要**直接 `pnpm build && npx wrangler deploy`：`pnpm build` 會清空 `dist/`，素材（`data/` `thumbs/` `img/`）要靠 `scripts/build.sh` 的 `cp` 補進去。漏掉那一步會把「只有程式碼」的資產集推上線，所有圖片路徑被 SPA fallback 回 `index.html`（HTTP 200 + `text/html`），前端解碼失敗報「加载图片失败」。

`scripts/deploy.sh` 會：build（含素材）→ 檢查 `dist` 素材數量（img/thumbs > 1000、data > 3）→ deploy → 上線後抽驗 `content-type`。任何一步失敗就中止。

> 另外：部署指令不要接管道（`| tail`），管道會蓋掉 wrangler 的退出碼，失敗會看起來像成功。

---

## 自订供应商与 OAuth

### 1. 新增自订供应商

设定页 →「自订供应商」→「新增供应商」，填：

| 字段 | 说明 |
| --- | --- |
| 名称 / 用途 | 用途选「生图」或「文字模型（提示词扩写）」 |
| 请求协议 | 见下表，决定请求怎么发 |
| Base URL | 例如 `https://ollama.com/v1`、`https://api.minimax.io` |
| 模型 ID | 逗号分隔，第一项为默认 |
| 认证方式 | API Key / OAuth PKCE / OAuth Device Code |

协议对照：

| 协议 | 打哪个端点 |
| --- | --- |
| `openai_images` | `/v1/images/edits`、`/v1/images/generations`、`/v1/responses` |
| `openai_chat` | `/v1/chat/completions`（Ollama Cloud、各类中转站） |
| `gemini_native` | `:generateContent` |
| `dashscope` | `/api/v1/services/aigc/multimodal-generation/generation` |
| `ark` | `/api/v3/images/generations` |
| `minimax` | `/v1/image_generation` |
| `custom_json` | 你自己填的 URL + body 模板 |

### 2. `custom_json` 模板语法

`请求 Body` 里可用占位符：

| 占位符 | 替换成 |
| --- | --- |
| `"{{prompt}}"` | 提示词（JSON 编码，含引号） |
| `"{{model}}"` | 模型 ID |
| `"{{image_urls}}"` | 参考图数组（输出真正的 JSON 数组） |
| `"{{image_url}}"` | 第一张参考图 |
| `{{n}}` | 出图数量（数字，不带引号） |
| `"{{aspect_ratio}}"` | 宽高比 |

取图路径用点 + 方括号，例如 `data[0].url`、`data.image_urls[0]`；取到的值以 `http` 开头视为 URL，否则按 base64 组成 data URL。额外 Header 每行一个 `Key: Value`。

### 3. OAuth 服务端换 token（可选但推荐）

纯前端换 token 常被 CORS 挡，此时把「Token 兑换位置」设为 **服务端**，并在 Cloudflare 侧配置：

```bash
# 1) 存入 client_secret（名称与供应商表单里的「Client Secret 環境變數名」一致）
npx wrangler secret put GITHUB_OAUTH_SECRET --name ai-pose-gallery-zh

# 2) 设定 token 主机白名单（逗号分隔），否则 /api/oauth/token 直接回 403
npx wrangler secret put OAUTH_TOKEN_HOSTS --name ai-pose-gallery-zh
# 例：github.com,oauth2.googleapis.com
```

本地开发时把这些变量写进 `.env`（`OAUTH_TOKEN_HOSTS`、`GITHUB_OAUTH_SECRET`），`vite.config.ts` 里的 `/api/oauth/token` 中间件会读取同一份配置。

> ⚠️ `OAUTH_TOKEN_HOSTS` 是安全边界：它决定后端允许带 secret 去请求哪些主机。**留空等于完全拒绝**，请只填你信任的 token 端点域名。

### 4. 已知限制

- OAuth 只对「有开放第三方 OAuth」的服务有效；MiniMax、豆包、百炼、Ollama Cloud 都只发 API Key。
- 多数厂商需要你自己注册 OAuth App 拿 `client_id`（可配 `client_secret`）。
- OAuth token 与 API Key 一样，只存在本机浏览器 IndexedDB，不会上传。

---

## 本地开发与构建

需要 **Node.js 20+** 与 **pnpm**：

```bash
# 1. 安装依赖
pnpm install

# 2. 启动本地开发服务器（默认 http://localhost:5173）
pnpm dev

# 3. 类型检查 + 生产构建 + 代码规范检查
pnpm build && pnpm lint
```

### 数据与图片维护脚本（Python 3）

```bash
# 拉取/补全三站全部 10,097 张图片（已存在的文件自动跳过，支持断点续传）
python3 scripts/download.py
WORKERS=64 python3 scripts/download.py   # 调整并发线程数

# 修改 scripts/i18n.py 词典后，重新生成三库中文 JSON
python3 scripts/apply_translation.py

# 校验全部图片文件是否完整
python3 scripts/verify.py
```

---

## 部署到 Cloudflare Pages

本项目构建后为纯静态 SPA（所有 AI 接口请求均由浏览器端直连或通过您配置的 CORS 代理发出，无需后端服务器）。

### 方式一：GitHub 自动部署（推荐）

1. 登录 Cloudflare Dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**
2. 选择本仓库 → 生产分支 `main`
3. 构建设置：

   | 字段 | 值 |
   | --- | --- |
   | Framework preset | `None`（或 `Vite`） |
   | Build command | `bash scripts/build.sh` |
   | Build output directory | `dist` |

4. `scripts/build.sh` 会自动执行 `pnpm build`，并将 `data/`、`thumbs/`、`img/`、`_headers` 及 SPA 路由回退规则 `_redirects`（`/* /index.html 200`）打包至 `dist/`。

> **注意**：Cloudflare Pages 免费版单次部署文件上限为 20,000 个文件，单文件上限 25 MiB。本仓库共约 10,120 个文件、单文件最大 < 2 MB，完全符合限制。

### 方式二：Wrangler 命令行直传

```bash
bash scripts/build.sh
npx wrangler pages deploy dist --project-name ai-pose-gallery-zh
```

---

## Agent 技能（Skills）

`skills/` 下提供 5 个 `SKILL.md` 格式的 Agent 技能，让 AI Agent 按姿势名 + 视角检索本仓库的白模图，作为生图 / 生视频的姿势参考：

| 技能 | 图片数 | 范围 |
| --- | ---: | --- |
| `pose-reference-standard` | 365 | 全身单人・标准系 |
| `pose-reference-upper` | 400 | 上半身单人 |
| `pose-reference-sexy` | 399 | 全身单人・性感系（18+） |
| `pose-reference-couple` | 275 | 双人缠绵（18+） |
| `pose-reference-all` | 1,439 | 全部姿势 |

```bash
git clone --depth 1 https://github.com/anhao/ai-pose-gallery-zh.git ~/ai-pose-gallery-zh
mkdir -p ~/.claude/skills
for d in ~/ai-pose-gallery-zh/skills/pose-reference-*; do ln -s "$d" ~/.claude/skills/; done
```

---

## 内容提示与版权致谢

- **内容提示**：图库包含部分成人向姿势与性感服装参考，仅供艺术创作、动作设计参考与前端技术学习使用，未成年人请勿访问。
- **版权归属**：所有姿势、服装、人像图片与原始数据的著作权归原作者 **ギア（@giaaibusi）** 所有。本仓库仅为汉化学习与前端工程实践存档，不对图片主张任何权利。
- **开源协议**：前端应用代码（`src/`）与数据处理脚本（`scripts/`）以 [MIT 协议](LICENSE) 开源；该协议**不覆盖** `img/`、`thumbs/` 与 `data/` 中的图片及原始数据。
