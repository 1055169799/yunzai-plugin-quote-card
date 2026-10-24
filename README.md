# alemonjs-quote-card（名言卡片）· ALemonJS 版

[yunzai-plugin-quote-card](https://github.com/Looking08/yunzai-plugin-quote-card) 的 **ALemonJS 移植版**。
引用一条消息发送 `#名言`，生成玻璃质感的名言卡片。

本仓库的 `alemonjs` 分支**只有插件本体**（`package.json` + `tsconfig.json` + `lvy.config.ts` + `src/`），
不含 Docker、pm2、平台凭据、应用入口等部署脚手架 —— 放到任意一个 ALemonJS 2.x 项目的 `packages/` 下即可工作。
原 Yunzai 版保留在 `main` 分支。

## 与原版（Yunzai）的差异

| 能力 | Yunzai 原版 | 本版（ALemonJS） |
| --- | --- | --- |
| 运行框架 | Yunzai | ALemonJS 2.x |
| 渲染 | Yunzai 内置 puppeteer | jsxp（Playwright + Chromium），复用单个浏览器实例并串行渲染 |
| 卡片实现 | `resources/template.html` + CSS 伪元素 | React 组件（`card.tsx`），把 `:before/:after` 展开成绝对定位元素，避免截图偏移 |
| 分辨率 | 固定 1280×640 | Web 管理页可调（480×240 ~ 3840×2160）+ 画质，用 `transform: scale()` 等比缩放，改分辨率不破版 |
| 背景管理 | 发图 + 命令 | 命令 **或** Web 管理页（上传本地文件 / 填 URL / 预览 / 删除） |
| 平台 | QQ（OneBot 类） | OneBot（NapCat / Lagrange）+ QQ 官方机器人 |
| 引用消息读取 | `e.source` / `e.getReply()` | 统一解析层：OneBot 走 `ReplyId + get_msg`，QQ 官方走 `MessageContent.msg_elements` |

## 安装

插件需要宿主项目自带 Chromium（jsxp 截图用）。装好 Chrome/Chromium 后，用环境变量指过去：

```bash
export JSXP_EXECUTABLE_PATH=/usr/bin/chromium-browser   # 或 macOS: /Applications/Google Chrome.app/...
```

### 方式一：预构建产物（推荐，不用装 devDependencies）

`alemonjs-release` 分支已构建好 `lib/`，装完直接可用：

```bash
# 在 ALemonJS 项目根目录执行
git clone -b alemonjs-release --depth=1 https://github.com/Looking08/yunzai-plugin-quote-card.git ./packages/alemonjs-quote-card
```

### 方式二：从源码构建

```bash
git clone -b alemonjs --depth=1 https://github.com/Looking08/yunzai-plugin-quote-card.git ./packages/alemonjs-quote-card
cd ./packages/alemonjs-quote-card
npm install && npx lvy build      # 产物在 lib/
```

插件自身唯一的运行期依赖是 `jsxp`（自带 react / playwright-core），`alemonjs` 以 peerDependency 声明。

装好后照常启动宿主项目，路由会自动注册：

```bash
node index.js --platform @alemonjs/onebot --serverPort 17117
```

> `--platform` 必须写完整包名（内部用 `require.resolve`），写 `onebot` 会报模块找不到。

## 指令

前缀 `/ # ＃ ! ！` 均可省略。

| 命令 | 说明 |
| --- | --- |
| `名言` | 引用一条消息后发送，生成名言卡片 |
| `添加名言照片N` | 附带图片（或引用一张图）保存到槽位 N（1~100，仅主人） |
| `删除名言照片N` | 删除槽位 N 的背景（仅主人） |

背景图存在 `<宿主项目 cwd>/data/quote-card/backgrounds/custom-<N>.<ext>`；
生成卡片时从已有槽位随机挑一张，一张都没有就用随机纯色玻璃卡片。

## Web 管理页

`GET /app/api/quote-card/admin`（拼在宿主项目的 HTTP 端口下）：

- 分辨率预设（1280×640 / 1920×960 / 1080×540 / 2560×1280）或手填宽高 + 画质
- 实时预览
- 背景图上传（本地文件或 URL）、缩略图列表、删除
- 设置持久化在 `data/quote-card/settings.json`

> ⚠️ 管理页**没有鉴权**。宿主项目若对公网开放，请自行在反向代理上加 Basic Auth / token，
> 或把监听端口绑到 `127.0.0.1`。

HTTP API（统一返回 `{code, message, data}`）：

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/quote-card/settings` | 读取分辨率设置 |
| POST | `/api/quote-card/settings` | 写入 `{width, height, quality}` |
| GET | `/api/quote-card/backgrounds` | 已用槽位列表 |
| POST | `/api/quote-card/backgrounds` | 上传（`{slot, dataUrl}`） |
| POST | `/api/quote-card/backgrounds/url` | 按 URL 抓取保存 |
| GET | `/api/quote-card/backgrounds/:slot` | 取该槽位图片 |
| DELETE | `/api/quote-card/backgrounds/:slot` | 删除该槽位 |
| POST | `/api/quote-card/preview` | 用给定文本/背景生成预览图 |

## 平台差异与已知限制

**OneBot（NapCat / Lagrange）** —— 推荐用于署名准确的场景。
`get_msg` 能拿到被引用消息的 QQ 号、群名片、昵称、正文、图片；头像走 `q1.qlogo.cn` 的 QQ 号头像，全部真实。

**QQ 官方机器人** —— 能用，但受官方协议限制：

1. **拿不到被引用消息的作者**。平台只在 `msg_elements` 里下发正文和附件，不带 `author`。
   代码会回退到「发命令的人」的头像和昵称，再取不到就显示「匿名」。
2. **openid 不是 QQ 号**，头像是 `https://q.qlogo.cn/qqapp/{AppID}/{openid}/640` 拼出来的
   （代码按「是否纯数字」在两种头像接口间自动切换，AppID 优先取事件里的 `BotId`，
   取不到时读宿主配置里的 `qq-bot.app_id`）。
3. **主人要在宿主配置的 `qq-bot.master_id` 里写 openid**，写 QQ 号对官方机器人无效；
   而且群聊里每个群的 `member_openid` 各不相同，要按场景逐个追加。
4. 引用 id 常是 `TMP_xxx` 这类临时值，匹配不上时会退回到「最后一个带内容的元素」。

## 目录结构

```
.
├── package.json              # name/main/exports；运行期依赖仅 jsxp
├── tsconfig.json
├── lvy.config.ts             # 构建配置（无 CSS/Tailwind 处理，纯 TS/TSX）
├── LICENSE
└── src/
    ├── index.ts              # 注册消息路由 + koaRouter（HTTP 管理页）
    ├── env.d.ts              # 类型引用
    └── quote-card/
        ├── index.ts          # 正则路由（名言 / 添加名言照片N / 删除名言照片N）
        ├── run.ts            # 名言主流程
        ├── add-bg.ts         # 添加背景（仅主人）
        ├── del-bg.ts         # 删除背景（仅主人）
        ├── quoted.ts         # 跨平台引用消息解析（OneBot / QQ 官方）
        ├── card.tsx          # React 卡片组件
        ├── service.ts        # 渲染引擎、背景存取、头像地址
        ├── settings.ts       # 分辨率设置读写与钳制
        ├── admin.ts          # 管理页 HTML（零构建，原生 JS）
        └── http.ts           # /api/quote-card/* 接口
```

## License

与原仓库一致，见 [LICENSE](LICENSE)。
