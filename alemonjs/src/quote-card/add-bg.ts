import { Format, useEvent, useMessage } from 'alemonjs';
import { MAX_SLOT, downloadImage, saveBg } from './service';
import { parseSlot, resolveQuoted } from './quoted';

const EVENTS = ['message.create', 'private.message.create'] as const;

/**
 * #添加名言照片N —— 主人发送图片（或引用图片）保存到指定槽位
 * 对应原插件 QuoteCard.addBg
 */
export default async () => {
  const [ref] = useEvent({ selects: [...EVENTS] });
  const event = ref.current as Record<string, any>;
  const [message] = useMessage();

  const reply = async (text: string) => {
    const format = Format.create();
    format.addText(text);
    await message.send({ format });
  };

  if (!event.IsMaster) {
    await reply('⚠️ 只有主人可以添加名言背景');
    return;
  }

  const n = parseSlot(event.MessageText ?? '');
  if (n > MAX_SLOT) {
    await reply(`⚠️ 槽位仅支持 1~${MAX_SLOT}，例如 #添加名言照片1`);
    return;
  }

  // 当前消息自带的图片
  const media = Array.isArray(event.MessageMedia) ? event.MessageMedia : [];
  let urls = media
    .filter((item: any) => item?.Type === 'image')
    .map((item: any) => String(item.Url ?? ''))
    .filter(Boolean);

  // 没有则尝试从引用消息中取
  if (!urls.length) {
    const quoted = await resolveQuoted(event, messageId => message.get({ messageId }));
    urls = quoted?.imageUrls ?? [];
  }

  if (!urls.length) {
    await reply('⚠️ 请附带一张图片（直接发图 + 命令，或引用一张图片）');
    return;
  }

  await reply('⏳ 正在下载并保存背景...');

  try {
    const buf = await downloadImage(urls[0]);
    const type = await saveBg(n, buf);
    await reply(`✅ 名言照片 ${n} 已更新（${type.ext}，${Math.round(buf.length / 1024)}KB）`);
  } catch (err) {
    logger.error(`[名言卡片] 保存背景失败: ${(err as Error).message}`);
    await reply(`❌ 保存背景失败: ${(err as Error).message.slice(0, 50)}`);
  }
};
