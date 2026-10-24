# quote-card（名言卡片）· ALemonJS 版

[yunzai-plugin-quote-card](https://github.com/Looking08/yunzai-plugin-quote-card) 的 **ALemonJS 移植版**。
引用一条消息发送 `#名言`，生成玻璃质感的名言卡片。

> 当前 `alemonjs` 分支**整条仓库就是 ALemonJS 版**，克隆下来即可直接用。
> 原 Yunzai 版保留在 `main` 分支。

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

## 快速开始（Docker，推荐）

```bash
git clone -b alemonjs --depth=1 https://github.com/Looking08/yunzai-plugin-quote-card.git alemonjs-quote-card
cd alemonjs-quote-card
cp alemon.config.example.yaml alemon.config.yaml
# 编辑 alemon.config.yaml：填 master_id，选一个平台填凭据
docker compose up -d
```

镜像内置 Chromium 与中文字体。启动后：

| 入口 | 地址 |
| --- | --- |
| 名言卡片管理页 | `http://localhost:17117/app/api/quote-card/admin` |
| OneBot 平台控制台 | `http://localhost:17117` |
| QQ 官方机器人控制台 | `http://localhost:17118` |
| NapCat WebUI（可选） | `http://localhost:6099` |

`docker-compose.yml` 里三个服务：

- `onebot` — `--platform @alemonjs/onebot`，反向 WS 监听 **17158**（协议端连这里）
- `qqbot` — `--platform @alemonjs/qq-bot`，走 WebSocket 网关，无需公网回调
- `napcat` — QQ 协议端（可选，也可换成已装好的 Lagrange / NapCat）

协议端（NapCat）需要建一个**反向 WebSocket 客户端**指向 `ws://onebot:17158`（同一 compose 网络）或 `ws://<宿主机IP>:17158`。

## 安装到已有的 ALemonJS 项目（packages 模式）

不想单独跑容器，也可以把这套代码当成一个模块放进现有机器人。

产物分支 `alemonjs-release` 已经预构建好 `lib/`，装完即用，不需要安装 devDependencies：

```bash
# 在 alemonjs 项目根目录执行
git clone -b alemonjs-release --depth=1 https://github.com/Looking08/yunzai-plugin-quote-card.git ./packages/alemonjs-quote-card
```

想从源码改，就用源码分支并自行构建：

```bash
git clone -b alemonjs --depth=1 https://github.com/Looking08/yunzai-plugin-quote-card.git ./packages/alemonjs-quote-card
cd ./packages/alemonjs-quote-card && yarn install && npx lvy build
```

启动时照常指定平台即可，路由会自动注册：

```bash
node index.js --platform @alemonjs/onebot --serverPort 17117
```

> 需要容器外的 Chromium 供 jsxp 截图：装好 Chrome/Chromium 后用 `JSXP_EXECUTABLE_PATH` 指过去，
> 或干脆用上面的 Docker 方式（镜像里已内置 chromium + 中文字体）。

## 本地开发

```bash
yarn install
npx lvy build                       # 产物在 lib/
node index.js --platform @alemonjs/onebot --serverPort 17117
```

> `--platform` 必须写完整包名（内部用 `require.resolve`），写 `onebot` 会报模块找不到。

不想每次 `lvy build` 可以用 `yarn dev --port 17117` 跑开发模式。

## 指令

前缀 `/ # ＃ ! ！` 均可省略。

| 命令 | 说明 |
| --- | --- |
| `名言` | 引用一条消息后发送，生成名言卡片 |
| `添加名言照片N` | 附带图片（或引用一张图）保存到槽位 N（1~100，仅主人） |
| `删除名言照片N` | 删除槽位 N 的背景（仅主人） |
| `hello` / `help` | 模板自带示例 |

背景图存在 `data/quote-card/backgrounds/custom-<N>.<ext>`，bind mount 到宿主机，容器重建不丢。
生成卡片时从已有槽位随机挑一张；一张都没有就用随机纯色玻璃卡片。

## Web 管理页

`GET /app/api/quote-card/admin`（挂在 onebot 服务的 17117 端口下）：

- 分辨率预设（1280×640 / 1920×960 / 1080×540 / 2560×1280）或手填宽高 + 画质
- 实时预览
- 背景图上传（本地文件或 URL）、缩略图列表、删除
- 设置持久化在 `data/quote-card/settings.json`

> ⚠️ 管理页**没有鉴权**，端口默认绑 `0.0.0.0`。公网部署请自己在反代上加 Basic Auth / token，
> 或把 compose 端口映射改成 `127.0.0.1:17117:17117`。

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
   （代码按「是否纯数字」在两种头像接口间自动切换）。
3. **主人要在 `qq-bot.master_id` 里写 openid**，写 QQ 号对官方机器人无效；
   而且群聊里每个群的 `member_openid` 各不相同，要按场景逐个追加。
4. 引用 id 常是 `TMP_xxx` 这类临时值，匹配不上时会退回到「最后一个带内容的元素」。

## 配置说明

```yaml
master_id:              # 全局主人
  - '123456789'

onebot:                 # OneBot 平台
  reverse_enable: true
  reverse_port: 17158   # 协议端反向连这里
  master_id:
    - '123456789'

qq-bot:                 # QQ 官方机器人
  app_id: '1905588190'  # 凭据顺序：机器人QQ号 : AppID : Token : AppSecret
  secret: 'xxx'         # Token 只在 Webhook 模式校验签名用，WS 模式不需要
  sandbox: false
```

## 目录结构

```
.
├── src/
│   ├── index.ts              # 注册路由 + koaRouter（HTTP 管理页）
│   └── quote-card/
│       ├── index.ts          # 正则路由（名言 / 添加名言照片N / 删除名言照片N）
│       ├── run.ts            # 名言主流程
│       ├── add-bg.ts         # 添加背景（仅主人）
│       ├── del-bg.ts         # 删除背景（仅主人）
│       ├── quoted.ts         # 跨平台引用消息解析（OneBot / QQ 官方）
│       ├── card.tsx          # React 卡片组件
│       ├── service.ts        # 渲染引擎、背景存取、头像地址
│       ├── settings.ts       # 分辨率设置读写与钳制
│       ├── admin.ts          # 管理页 HTML（零构建，原生 JS）
│       └── http.ts           # /api/quote-card/* 接口
├── index.js                  # 应用入口（start()）
├── Dockerfile                # 多阶段构建：lvy build + chromium + 中文字体
├── docker-compose.yml
└── alemon.config.example.yaml
```

## License

与原仓库一致，见 [LICENSE](LICENSE)。
