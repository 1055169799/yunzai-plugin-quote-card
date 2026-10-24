import QuoteCard from "./card.js";
import { readSettings } from "./settings.js";
import { getConfigValue } from "alemonjs";
import path from "node:path";
import fs from "node:fs/promises";
import React from "react";
import { Component, Playwright } from "jsxp";

//#region src/quote-card/service.ts
const MAX_SLOT = 100;
/** 背景槽位持久化目录（bind mount 到宿主机 ./data，容器重建不丢失） */
const BG_DIR = path.join(process.cwd(), "data", "quote-card", "backgrounds");
const COLORS = [
	"#FF6B6B",
	"#FF8E72",
	"#FFA94D",
	"#FFD43B",
	"#FF922B",
	"#F06595",
	"#DA77F2",
	"#9775FA",
	"#748FFC",
	"#4DABF7",
	"#3BC9DB",
	"#38D9A9",
	"#69DB7C",
	"#A9E34B",
	"#94D82D",
	"#FCC419",
	"#F76707",
	"#E8590C",
	"#FF8787",
	"#E599F7",
	"#20C997",
	"#22B8CF",
	"#339AF0",
	"#5C7CFA",
	"#7950F2"
];
const IMG_TYPES = [
	{
		ext: "jpg",
		mime: "image/jpeg",
		test: (b) => b[0] === 255 && b[1] === 216
	},
	{
		ext: "png",
		mime: "image/png",
		test: (b) => b[0] === 137 && b[1] === 80 && b[2] === 78 && b[3] === 71
	},
	{
		ext: "webp",
		mime: "image/webp",
		test: (b) => b[0] === 82 && b[1] === 73 && b[2] === 70 && b[3] === 70 && b[8] === 87 && b[9] === 69 && b[10] === 66 && b[11] === 80
	},
	{
		ext: "gif",
		mime: "image/gif",
		test: (b) => b[0] === 71 && b[1] === 73 && b[2] === 70 && b[3] === 56
	}
];
const EXT_MIME = {
	jpg: "image/jpeg",
	jpeg: "image/jpeg",
	png: "image/png",
	webp: "image/webp",
	gif: "image/gif"
};
const UA = "Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36";
const randColor = () => COLORS[Math.floor(Math.random() * COLORS.length)];
/** 按文本长度自适应字号（与原插件一致） */
const fontSize = (text) => {
	const n = text.length;
	if (n <= 8) return 64;
	if (n <= 16) return 52;
	if (n <= 32) return 42;
	if (n <= 60) return 36;
	if (n <= 100) return 28;
	return 22;
};
const detectType = (buf) => IMG_TYPES.find((t) => t.test(buf)) ?? {
	ext: "jpg",
	mime: "image/jpeg"
};
/** 下载远程图片 */
const downloadImage = async (url) => {
	const res = await fetch(url, {
		headers: { "User-Agent": UA },
		redirect: "follow"
	});
	if (!res.ok) throw new Error(`HTTP ${res.status}`);
	const buf = Buffer.from(await res.arrayBuffer());
	if (!buf.length) throw new Error("图片为空");
	return buf;
};
/** 下载并转为 data URL，失败时返回空串（不阻断出图） */
const toDataUrl = async (url) => {
	if (!url) return "";
	try {
		const buf = await downloadImage(url);
		return `data:${detectType(buf).mime};base64,${buf.toString("base64")}`;
	} catch (err) {
		logger.warn(`[名言卡片] 图片获取失败: ${url} ${err.message}`);
		return "";
	}
};
/** QQ 号头像地址；只接受纯数字 QQ 号 */
const qqAvatarUrl = (qq) => /^\d{4,}$/.test(qq ?? "") ? `https://q1.qlogo.cn/g?b=qq&s=640&nk=${qq}` : "";
/** QQ 官方机器人：openid 头像（qqapp 接口需要 AppID，优先用事件里的 BotId） */
const qqBotAvatarUrl = (openid, botId) => {
	if (!openid) return "";
	let appId = botId ?? "";
	if (!appId) try {
		const cfg = getConfigValue() ?? {};
		appId = cfg?.["qq-bot"]?.app_id ?? cfg?.["@alemonjs/qq-bot"]?.app_id ?? "";
	} catch {
		appId = "";
	}
	return appId ? `https://q.qlogo.cn/qqapp/${appId}/${openid}/640` : "";
};
/** 按账号形态挑头像：纯数字走 QQ 号头像，否则按官方机器人 openid 处理 */
const resolveAvatarUrl = (id, botId) => qqAvatarUrl(id) || qqBotAvatarUrl(id, botId);
const ensureBgDir = async () => {
	await fs.mkdir(BG_DIR, { recursive: true });
};
const findBgFile = async (n) => {
	try {
		const hit = (await fs.readdir(BG_DIR)).find((f) => f.startsWith(`custom-${n}.`));
		return hit ? path.join(BG_DIR, hit) : null;
	} catch {
		return null;
	}
};
const clearBgFile = async (n) => {
	try {
		const files = await fs.readdir(BG_DIR);
		for (const f of files) if (f.startsWith(`custom-${n}.`)) await fs.unlink(path.join(BG_DIR, f));
	} catch {}
};
const listBgSlots = async () => {
	try {
		const files = await fs.readdir(BG_DIR);
		const set = /* @__PURE__ */ new Set();
		for (const f of files) {
			const m = f.match(/^custom-(\d+)\./);
			if (m) set.add(parseInt(m[1], 10));
		}
		return [...set].sort((a, b) => a - b);
	} catch {
		return [];
	}
};
/** 保存背景到指定槽位 */
const saveBg = async (n, buf) => {
	const type = detectType(buf);
	await ensureBgDir();
	await clearBgFile(n);
	await fs.writeFile(path.join(BG_DIR, `custom-${n}.${type.ext}`), buf);
	return type;
};
/** 随机挑一张已设置的背景，返回 data URL */
const pickBackground = async () => {
	try {
		const slots = await listBgSlots();
		if (!slots.length) return "";
		const pick = slots[Math.floor(Math.random() * slots.length)];
		const file = await findBgFile(pick);
		if (!file) return "";
		const buf = await fs.readFile(file);
		const ext = path.extname(file).slice(1).toLowerCase();
		return `data:${EXT_MIME[ext] ?? "image/jpeg"};base64,${buf.toString("base64")}`;
	} catch (err) {
		logger.error(`[名言卡片] 加载背景失败: ${err.message}`);
		return "";
	}
};
/** 浏览器可执行文件（容器内为 apk 安装的 chromium） */
const CHROMIUM_PATH = process.env.JSXP_EXECUTABLE_PATH || process.env.PUPPETEER_EXECUTABLE_PATH || "/usr/bin/chromium-browser";
let engine = null;
/** 复用同一个无头浏览器实例，显式关闭沙箱以适配容器环境 */
const getEngine = () => {
	if (!engine) engine = new Playwright({
		headless: true,
		executablePath: CHROMIUM_PATH,
		args: [
			"--no-sandbox",
			"--disable-setuid-sandbox",
			"--disable-dev-shm-usage",
			"--font-render-hinting=none"
		]
	});
	return engine;
};
/** 串行化渲染，避免并发开过多页面 */
let renderQueue = Promise.resolve();
/**
* 渲染名言卡片为图片 Buffer
* 使用 jsxp（Playwright + Chromium）替代原插件的 puppeteer.screenshots
*/
const renderQuoteCard = async (options) => {
	const avatar = await toDataUrl(options.avatarUrl || resolveAvatarUrl(options.qq ?? "", options.botId));
	const settings = await readSettings();
	const task = async () => {
		const element = React.createElement(QuoteCard, {
			bgColor: options.bgColor ?? randColor(),
			bgImage: options.bgImage ?? "",
			avatar,
			text: options.text,
			fontSize: fontSize(options.text),
			senderName: options.senderName,
			width: settings.width,
			height: settings.height
		});
		const html = await new Component().compile({ component: element }, "local");
		const buf = await getEngine().render(html, {
			selector: "body",
			screenshot: {
				type: "jpeg",
				quality: settings.quality
			}
		});
		return buf && buf.length ? Buffer.from(buf) : null;
	};
	const run = renderQueue.then(task, task);
	renderQueue = run.catch(() => void 0);
	return run;
};

//#endregion
export { BG_DIR, COLORS, MAX_SLOT, clearBgFile, detectType, downloadImage, findBgFile, fontSize, listBgSlots, pickBackground, qqAvatarUrl, qqBotAvatarUrl, randColor, renderQuoteCard, resolveAvatarUrl, saveBg, toDataUrl };