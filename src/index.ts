/**
 * alemonjs-quote-card —— 名言卡片插件（ALemonJS 版）
 *
 * 命令：
 *   #名言              引用一条消息后生成名言卡片
 *   #添加名言照片N     主人：附带图片保存为第 N 张背景
 *   #删除名言照片N     主人：删除第 N 张背景
 *
 * 管理台：/app/api/quote-card/admin
 */
import { Router } from 'alemonjs';
import koaRouter from 'koa-router';
import { registerQuoteCard } from './quote-card';
import { registerQuoteCardHttp } from './quote-card/http';

// 管理台 HTTP 接口
const r = new koaRouter({
  prefix: '/api'
});
registerQuoteCardHttp(r);

// 消息路由
const router = Router.create({
  events: ['message.create', 'private.message.create']
});

registerQuoteCard(router);

export default defineChildren({
  register() {
    return {
      responseRouter: router.define,
      koaRouter: r
    };
  }
});
