/**
 * 名言卡片模块（Yunzai 插件 yunzai-plugin-quote-card 的 ALemonJS 实现）
 *
 * 命令：
 *   #名言              引用一条消息后生成名言卡片
 *   #添加名言照片N     主人：附带图片保存为第 N 张背景（N 缺省 1，上限 100）
 *   #删除名言照片N     主人：删除第 N 张背景
 */
const EVENTS = ['message.create', 'private.message.create'] as const;

/** 前缀可选：# ＃ / ！ ! */
const PREFIX = '[#＃/!！]?';

export const registerQuoteCard = (router: any) => {
  // 使用 regular 路由直接匹配原文，避免依赖 keyPolicy 分词
  router.res({ events: [...EVENTS], regular: new RegExp(`^${PREFIX}名言$`) }, () => import('./run'));

  router.res({ events: [...EVENTS], regular: new RegExp(`^${PREFIX}添加名言照片(\\d*)$`) }, () => import('./add-bg'));

  router.res({ events: [...EVENTS], regular: new RegExp(`^${PREFIX}删除名言照片(\\d*)$`) }, () => import('./del-bg'));
};
