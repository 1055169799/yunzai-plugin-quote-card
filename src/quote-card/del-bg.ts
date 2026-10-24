import { Format, useEvent, useMessage } from 'alemonjs';
import { MAX_SLOT, clearBgFile, findBgFile } from './service';
import { parseSlot } from './quoted';

const EVENTS = ['message.create', 'private.message.create'] as const;

/**
 * #删除名言照片N —— 主人删除指定槽位的背景
 * 对应原插件 QuoteCard.delBg
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
    await reply('⚠️ 只有主人可以删除名言背景');
    return;
  }

  const n = parseSlot(event.MessageText ?? '');
  if (n > MAX_SLOT) {
    await reply(`⚠️ 槽位仅支持 1~${MAX_SLOT}，例如 #删除名言照片1`);
    return;
  }

  const file = await findBgFile(n);
  if (!file) {
    await reply(`⚠️ 名言照片 ${n} 尚未设置`);
    return;
  }

  await clearBgFile(n);
  await reply(`🗑️ 名言照片 ${n} 已删除`);
};
