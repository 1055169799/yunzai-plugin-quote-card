# quote-card（名言卡片）

Yunzai 名言卡片生成插件：引用一条消息回复 `#名言`，生成精美(其实并不精美)的玻璃质感卡片。

<img width="1280" height="640" alt="7910EC2BE9F87BCEA6120E05E322BC2B" src="https://github.com/user-attachments/assets/fb3b68bc-5d7e-403c-a936-25b04b1da1cc" />


## 安装

进入 Yunzai 的 `plugins` 目录，克隆本仓库：

```bash
cd plugins/
git clone https://github.com/Looking08/yunzai-plugin-quote-card.git
```

> 依赖 Yunzai 自带的 puppeteer 渲染（`lib/puppeteer/puppeteer.js`），无需额外安装。

仓库带有 `package.json`（`name: yunzai-plugin-quote-card`，`version: 1.0.0`），方便插件管理器 / 插件市场识别名称与版本。
插件入口 `index.js` 用到 Yunzai 运行时的相对路径（`../../lib/plugins/plugin.js`），所以**安装位置仍然必须是
`plugins/<插件目录>/`**，不能只作为一个普通 npm 依赖平铺在 `node_modules` 里。

## 用法

| 命令 | 说明 |
|------|------|
| `#名言` | 引用一条消息后发送，生成名言卡片 |
| `#添加名言照片1~100` | 附带一张图片，添加自定义背景（仅主人） |
| `#删除名言照片1~100` | 删除指定槽位的背景（仅主人） |

## 自定义背景（可选）

背景图为可选功能，未设置时使用随机纯色玻璃卡片。如需自定义：

1. 直接发一张图 + `#添加名言照片1`（槽位号 1~100）
2. 生成卡片时会从已设置的背景里随机挑一张

背景图保存在 `resources/backgrounds/` 目录下，该目录运行时会自动创建。

## 说明

- 引用消息的文字/图片提取基于 Yunzai 的事件模型（`e.source` / `e.getReply()`）。
- 卡片文字过长会自动缩小字号。
