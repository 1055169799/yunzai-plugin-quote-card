import { MAX_SLOT, downloadImage, saveBg } from "./service.js";
import { parseSlot, resolveQuoted } from "./quoted.js";
import { Format, useEvent, useMessage } from "alemonjs";

//#region src/quote-card/add-bg.ts
const EVENTS = ["message.create", "private.message.create"];
/**
* #添加名言照片N —— 主人发送图片（或引用图片）保存到指定槽位
* 对应原插件 QuoteCard.addBg
*/
var add_bg_default = async () => {
	const [ref] = useEvent({ selects: [...EVENTS] });
	const event = ref.current;
	const [message] = useMessage();
	const reply = async (text) => {
		const format = Format.create();
		format.addText(text);
		await message.send({ format });
	};
	if (!event.IsMaster) {
		await reply("⚠️ 只有主人可以添加名言背景");
		return;
	}
	const n = parseSlot(event.MessageText ?? "");
	if (n > 100) {
		await reply(`⚠️ 槽位仅支持 1~${100}，例如 #添加名言照片1`);
		return;
	}
	let urls = (Array.isArray(event.MessageMedia) ? event.MessageMedia : []).filter((item) => item?.Type === "image").map((item) => String(item.Url ?? "")).filter(Boolean);
	if (!urls.length) urls = (await resolveQuoted(event, (messageId) => message.get({ messageId })))?.imageUrls ?? [];
	if (!urls.length) {
		await reply("⚠️ 请附带一张图片（直接发图 + 命令，或引用一张图片）");
		return;
	}
	await reply("⏳ 正在下载并保存背景...");
	try {
		const buf = await downloadImage(urls[0]);
		await reply(`✅ 名言照片 ${n} 已更新（${(await saveBg(n, buf)).ext}，${Math.round(buf.length / 1024)}KB）`);
	} catch (err) {
		logger.error(`[名言卡片] 保存背景失败: ${err.message}`);
		await reply(`❌ 保存背景失败: ${err.message.slice(0, 50)}`);
	}
};

//#endregion
export { add_bg_default as default };