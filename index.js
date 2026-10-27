/**
 * 名言卡片生成插件
 * 引用一条消息，回复 #名言 / #名言2 即可生成卡片
 * 自定义背景：#添加名言照片1~100 + 图片；#删除名言照片1~100 删除；#名言照片列表 查看（含合并转发）
 * 帮助：#名言帮助
 */

import plugin from '../../lib/plugins/plugin.js'
import puppeteer from '../../lib/puppeteer/puppeteer.js'
import path from 'node:path'
import fs from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { readConfig } from './config.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const TPL = path.join(__dirname, 'resources', 'template.html')
const LIST_TPL = path.join(__dirname, 'resources', 'list.html')
const HELP_TPL = path.join(__dirname, 'resources', 'help.html')
const HELP_BG = path.join(__dirname, 'resources', 'help-bg.jpg')
const BG_DIR = path.join(__dirname, 'resources', 'backgrounds')
const PKG_FILE = path.join(__dirname, 'package.json')
const MAX_SLOT = 100

// —— 更新自检 ——
// Yunzai 的 #全部更新（plugins/other/update.js）只认带 .git 的目录，
// 没有就静默 continue —— 用户会以为"已经是最新"，其实从来没更新过。
// 这里主动提示一次，避免这种情况无声发生。
try {
  await fs.access(path.join(__dirname, '.git'))
} catch (_) {
  logger.warn?.(
    '[名言卡片] 未检测到 .git，当前不是 git 安装，Yunzai 的 #全部更新 会静默跳过本插件。\n'
    + '  修复：在该插件目录执行 git init + 关联 origin/main（见 README「更新」一节）'
  )
}

const COLORS = [
  '#FF6B6B', '#FF8E72', '#FFA94D', '#FFD43B', '#FF922B',
  '#F06595', '#DA77F2', '#9775FA', '#748FFC', '#4DABF7',
  '#3BC9DB', '#38D9A9', '#69DB7C', '#A9E34B', '#94D82D',
  '#FCC419', '#F76707', '#E8590C', '#FF8787', '#E599F7',
  '#20C997', '#22B8CF', '#339AF0', '#5C7CFA', '#7950F2',
]

const IMG_TYPES = [
  { ext: 'jpg', mime: 'image/jpeg', test: b => b[0] === 0xFF && b[1] === 0xD8 },
  { ext: 'png', mime: 'image/png', test: b => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47 },
  { ext: 'webp', mime: 'image/webp', test: b => b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50 },
  { ext: 'gif', mime: 'image/gif', test: b => b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38 },
]

const EXT_MIME = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' }

function randColor () {
  return COLORS[Math.floor(Math.random() * COLORS.length)]
}

function fontSize (text) {
  const n = text.length
  if (n <= 8) return 64
  if (n <= 16) return 52
  if (n <= 32) return 42
  if (n <= 60) return 36
  if (n <= 100) return 28
  return 22
}

function getText (msg) {
  if (!msg) return ''
  if (typeof msg === 'string') return msg
  if (Array.isArray(msg)) {
    return msg.filter(m => m.type === 'text').map(m => m.text).join('')
  }
  return String(msg)
}

// 从消息对象中提取图片 URL 数组（兼容 OneBot / icqq / QQBot 官方机器人多种段格式）
function getImageUrls (msg) {
  const urls = []
  if (!msg) return urls
  if (Array.isArray(msg.img)) urls.push(...msg.img)
  if (Array.isArray(msg.message)) {
    for (const m of msg.message) {
      if (!m || m.type !== 'image') continue
      if (m.url) urls.push(m.url)
      else if (typeof m.file === 'string' && /^https?:\/\//.test(m.file)) urls.push(m.file)
    }
  }
  // QQBot 官方机器人：原始元素里图片在 attachments[].url
  if (Array.isArray(msg.msg_elements)) {
    for (const el of msg.msg_elements) {
      for (const att of el?.attachments || []) {
        if (att?.url && String(att.content_type || '').startsWith('image')) urls.push(att.url)
      }
    }
  }
  return [...new Set(urls.filter(Boolean))]
}

// QQBot 官方机器人的原始事件里直接带着被引用消息的内容摘要，
// 完全不依赖本地消息缓存：
//   msg_elements[] 中 message_type === 103 的元素 = 被引用消息，可能带 content / attachments / author
//   parallel_message.msg_nodes[] = 被引用消息的节点摘要，content 是正文
// 作者优先级：被引用元素自带的 author（QQ 下发时最准）→ 发起引用的人 → 发消息的人。
// 私聊里这三者是同一个人；群里引用别人的话，只有第一条准。
function quoteFromRawEvent (e) {
  const d = e.raw_event?.d
  if (!d) return null
  const els = Array.isArray(d.msg_elements) ? d.msg_elements : []
  const nodes = Array.isArray(d.parallel_message?.msg_nodes) ? d.parallel_message.msg_nodes : []

  // 被引用元素：优先 message_type === 103；退而取最后一个带内容的元素
  // （与 ALemonJS 版 quoted.ts 的 fromNormalizedContent 保持一致的兜底思路）
  const refEl = els.find(x => x && x.message_type === 103) ||
    [...els].reverse().find(x => x && (String(x.content ?? '').trim() || (x.attachments?.length ?? 0) > 0)) ||
    null

  let text = typeof refEl?.content === 'string' ? refEl.content : ''
  if (!text.trim()) {
    text = nodes.map(n => (typeof n?.content === 'string' ? n.content : '')).filter(t => t.trim()).join('\n')
  }

  const imgs = []
  for (const a of refEl?.attachments || []) if (a?.url) imgs.push(a.url)
  for (const n of nodes) for (const a of n?.attachments || []) if (a?.url) imgs.push(a.url)

  if (!text.trim() && !imgs.length) return null

  // 作者：被引用元素自带的 author 最准（QQ 下发时才有），否则用发引用的人兜底
  const a = refEl?.author || d.author || {}
  const openid = a.member_openid || a.user_openid || a.id || ''
  // 头像走 qqapp 接口，需要「机器人 appid」而不是 self_id（两者不同），
  // 依次取 bot.info.appid → 从 sender.avatar 里抠 → self_id
  const appid = String(
    e.bot?.info?.appid ||
    (String(e.sender?.avatar || '').match(/\/qqapp\/(\d+)\//) || [])[1] ||
    e.self_id || ''
  ).split(':')[0]
  const senderAvatar = String(e.sender?.avatar || '')
  const avatar = /^https?:\/\//.test(senderAvatar) && openid && openid === String(e.sender?.openid || '')
    ? senderAvatar // 与发消息人同一人时直接用现成头像，省一次拼接风险
    : (openid && /^\d+$/.test(appid) ? `https://q.qlogo.cn/qqapp/${appid}/${openid}/0` : '')
  // 昵称：私聊 author.username 常为空，退回被引用元素 / 发消息的人
  const nick = a.username || a.nickname || refEl?.userName || e.sender?.nickname || e.sender?.card || ''

  return {
    message: text.trim() ? [{ type: 'text', text }] : [],
    raw_message: text,
    img: [...new Set(imgs)],
    user_id: '',
    nickname: nick,
    sender: { nickname: nick, card: nick, openid, avatar },
    quotedFromRaw: true, // 标记：内容来自引用摘要，作者是兜底值
  }
}

// QQBot 官方机器人拿不到 e.reply_id / e.source，且本部署 Bot.storageBackend 未定义，
// 适配器的 getReply() 只能返回空壳 —— 只能按 ref_msg_idx 去 redis 的消息缓存里反查。
// 缓存键与 QQBot-Plugin/lib/message.js 的写入保持一致：
//   群聊 wind-msg:group:<self_id:group_openid>
//   私聊 wind-msg:private:<self_id:user_openid>
async function redisFindByMsgIdx (e, refIdx) {
  if (!refIdx) return null
  const r = globalThis.redis || globalThis.Bot?.redis
  if (!r || typeof r.zrange !== 'function') return null
  const keys = []
  if (e.group_id) keys.push(`wind-msg:group:${e.group_id}`)
  if (e.user_id) keys.push(`wind-msg:private:${e.user_id}`)
  for (const key of keys) {
    try {
      const list = await r.zrange(key, 0, -1)
      for (const raw of list || []) {
        try {
          const m = JSON.parse(raw)
          if (m && m.msg_idx && m.msg_idx === refIdx) return m
        } catch (_) {}
      }
    } catch (_) {}
  }
  return null
}

// 排查用：把取引用的每一步落盘。
// 开关：环境变量 QC_QUOTE_DEBUG=1，或容器里存在 /tmp/qc-quote-debug 标记文件。
let _qcDebugCache = null
async function quoteTrace (e, stage, extra) {
  try {
    if (_qcDebugCache === null) {
      _qcDebugCache = process.env.QC_QUOTE_DEBUG === '1' ||
        await fs.access('/tmp/qc-quote-debug').then(() => true, () => false)
    }
    if (!_qcDebugCache) return
    const who = e.group_id ? `g:${e.group_id}` : `u:${e.user_id}`
    await fs.appendFile('/tmp/qc-quote.log',
      `${new Date().toISOString()} [${stage}] ${who} ${JSON.stringify(extra)}\n`)
  } catch (_) {}
}

// 统一取「被引用的那条消息」，按可靠性依次尝试四种来源
async function resolveQuote (e) {
  const trace = { source: !!e.source, reply_id: e.reply_id, ref: (e.ref_msg_idx || '').slice(0, 20) }

  // 1) OneBot / icqq：e.source 就是完整消息对象
  if (e.source && (Array.isArray(e.source.message) ? e.source.message.length : e.source.raw_message)) {
    await quoteTrace(e, 'source', trace)
    return e.source
  }

  // 2) 适配器自带 getReply（sqlite 后端的 QQBot 走这条；OneBot 也走这条）
  let got = null
  try {
    if (e.getReply) got = await e.getReply()
  } catch (err) {
    logger.debug?.(`[名言卡片] getReply 失败: ${err.message}`)
  }
  const usable = m => !!m && (Array.isArray(m.message) ? m.message.length > 0 : !!m.raw_message)
  if (usable(got)) {
    await quoteTrace(e, 'getReply', { ...trace, ok: true })
    return got
  }
  trace.getReply = got ? 'empty' : 'none'

  // 3) QQBot：从 redis 缓存按 msg_idx 反查（这条能拿到作者信息）
  const replySeg = Array.isArray(e.message) && e.message.find(i => i && i.type === 'reply')
  const refIdx = e.ref_msg_idx || replySeg?.id || ''
  const hit = await redisFindByMsgIdx(e, refIdx)
  if (hit) {
    await quoteTrace(e, 'redis', { ...trace, ok: true, nick: hit.nickname })
    return hit
  }

  // 4) QQBot：原始事件里的引用摘要（拿不到作者，但内容一定有）
  const raw = quoteFromRawEvent(e)
  await quoteTrace(e, raw ? 'raw_event' : 'fail', { ...trace, text: raw ? raw.raw_message.slice(0, 30) : '' })
  return raw
}

async function downloadImage (url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36',
    },
    redirect: 'follow',
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  if (!buf.length) throw new Error('图片为空')
  return buf
}

function detectType (buf) {
  return IMG_TYPES.find(t => t.test(buf)) || { ext: 'jpg', mime: 'image/jpeg' }
}

async function ensureBgDir () {
  await fs.mkdir(BG_DIR, { recursive: true })
}

async function findBgFile (n) {
  try {
    const files = await fs.readdir(BG_DIR)
    const hit = files.find(f => f.startsWith(`custom-${n}.`))
    return hit ? path.join(BG_DIR, hit) : null
  } catch {
    return null
  }
}

async function clearBgFile (n) {
  try {
    const files = await fs.readdir(BG_DIR)
    for (const f of files) {
      if (f.startsWith(`custom-${n}.`)) await fs.unlink(path.join(BG_DIR, f))
    }
  } catch {}
}

async function listBgSlots () {
  try {
    const files = await fs.readdir(BG_DIR)
    const set = new Set()
    for (const f of files) {
      const m = f.match(/^custom-(\d+)\./)
      if (m) set.add(parseInt(m[1], 10))
    }
    return [...set].sort((a, b) => a - b)
  } catch {
    return []
  }
}

// 规范化 backgrounds 目录：仅处理图片文件（jpg/jpeg/png/webp/gif）。
// 已符合 custom-N.ext 且 1<=N<=MAX_SLOT 的文件保持不变；
// 其余图片文件（超范围 custom-N、旧 bg-N、任意命名）全部重命名为
// custom-N.ext，N 取当前最小空闲槽位，保留原扩展名，避免覆盖已有规范文件。
// 返回被重命名的文件清单 [{ from, to }]；单文件失败不影响其余文件与列表渲染。
async function normalizeBgFiles () {
  try {
    const files = await fs.readdir(BG_DIR)
    const images = []
    const used = new Set()
    for (const f of files) {
      const ext = path.extname(f).slice(1).toLowerCase()
      if (!EXT_MIME[ext]) continue
      images.push({ name: f, ext })
      const m = f.match(/^custom-(\d+)\./)
      if (m) {
        const n = parseInt(m[1], 10)
        if (n >= 1 && n <= MAX_SLOT) used.add(n)
      }
    }
    const renamed = []
    for (const img of images) {
      const m = img.name.match(/^custom-(\d+)\./)
      if (m) {
        const n = parseInt(m[1], 10)
        if (n >= 1 && n <= MAX_SLOT) continue
      }
      let target = null
      for (let i = 1; i <= MAX_SLOT; i++) {
        if (!used.has(i)) {
          target = i
          break
        }
      }
      if (target === null) break
      const newName = `custom-${target}.${img.ext}`
      try {
        await fs.rename(path.join(BG_DIR, img.name), path.join(BG_DIR, newName))
        used.add(target)
        renamed.push({ from: img.name, to: newName })
      } catch (err) {
        logger.error(`[名言卡片] 重命名背景失败 ${img.name}: ${err.message}`)
      }
    }
    return renamed
  } catch {
    return []
  }
}

// 本地图片转 data URL（截图时直接内嵌，避免 file:// 加载被拦）
async function fileToDataUrl (file) {
  try {
    const buf = await fs.readFile(file)
    const ext = path.extname(file).slice(1).toLowerCase()
    const mime = EXT_MIME[ext] || 'image/jpeg'
    return `data:${mime};base64,${buf.toString('base64')}`
  } catch {
    return ''
  }
}

async function readVersion () {
  try {
    const pkg = JSON.parse(await fs.readFile(PKG_FILE, 'utf8'))
    return pkg.version || '1.0.0'
  } catch {
    return '1.0.0'
  }
}

export class QuoteCard extends plugin {
  constructor () {
    super({
      name: '名言卡片',
      dsc: '引用消息回复 #名言 生成卡片',
      event: 'message',
      priority: 200,
      rule: [
        { reg: '^#添加名言照片(\\d*)$', fnc: 'addBg' },
        { reg: '^#删除名言照片(\\d*)$', fnc: 'delBg' },
        { reg: '^#名言照片列表$', fnc: 'listBg' },
        { reg: '^#名言帮助$', fnc: 'help' },
        { reg: '^#名言$', fnc: 'run' },
        { reg: '^#名言2$', fnc: 'run2' },
      ],
    })
  }

  // 解析槽位号（末尾数字，缺省为 1）
  parseSlot (e) {
    const m = (e.msg || e.raw_message || '').match(/(\d*)$/)
    let n = m && m[1] ? parseInt(m[1], 10) : 1
    if (!n) n = 1
    return n
  }

  // 解析指令末尾显式指定的槽位号；没写数字返回 0（表示自动排号）
  parseExplicitSlot (e) {
    const m = (e.msg || e.raw_message || '').trim().match(/(\d+)$/)
    return m ? parseInt(m[1], 10) : 0
  }

  // 批量添加背景：不带数字则接在已有槽位后面依次排；带数字则从该槽位起依次占用
  async addBg (e) {
    if (!e.isMaster) {
      await e.reply('⚠️ 只有主人可以添加名言背景')
      return true
    }
    const startSlot = this.parseExplicitSlot(e)
    if (startSlot > MAX_SLOT) {
      await e.reply(`⚠️ 槽位仅支持 1~${MAX_SLOT}，例如 #添加名言照片1`)
      return true
    }

    let urls = getImageUrls(e)
    if (!urls.length) {
      const reply = await resolveQuote(e)
      if (reply) urls = getImageUrls(reply)
    }
    if (!urls.length) {
      await e.reply('⚠️ 请附带图片（可一次发多张 + 命令，或引用一条带图消息）')
      return true
    }

    // 排号：显式指定就从它开始；否则从最小空闲槽位开始连续占用
    const exist = await listBgSlots()
    let base
    if (startSlot) {
      base = startSlot
    } else {
      const used = new Set(exist)
      base = 1
      while (base <= MAX_SLOT && used.has(base)) base++
    }
    const targets = []
    for (let i = 0; i < urls.length; i++) {
      const slot = base + i
      if (slot > MAX_SLOT) break
      targets.push(slot)
    }
    if (!targets.length) {
      await e.reply(`⚠️ 槽位已满（最多 ${MAX_SLOT} 个），请先删除一些再添加`)
      return true
    }

    const dropped = urls.length - targets.length
    await e.reply(`⏳ 正在保存 ${targets.length} 张背景...`)

    const saved = []
    const failed = []
    for (let i = 0; i < targets.length; i++) {
      const slot = targets[i]
      try {
        const buf = await downloadImage(urls[i])
        const type = detectType(buf)
        await ensureBgDir()
        await clearBgFile(slot)
        await fs.writeFile(path.join(BG_DIR, `custom-${slot}.${type.ext}`), buf)
        saved.push({ slot, ext: type.ext, kb: Math.round(buf.length / 1024) })
      } catch (err) {
        logger.error(`[名言卡片] 保存背景 ${slot} 失败: ${err.message}`)
        failed.push(slot)
      }
    }

    if (!saved.length) {
      await e.reply('❌ 保存背景失败，请检查图片链接是否可访问')
      return true
    }

    const range = saved.length === 1
      ? `#${saved[0].slot}`
      : `#${saved[0].slot} ~ #${saved[saved.length - 1].slot}`
    let msg = `✅ 已保存 ${saved.length} 张：${range}`
    if (saved.length === 1) msg += `（${saved[0].ext}，${saved[0].kb}KB）`
    if (failed.length) msg += `\n⚠️ 失败：${failed.map(n => `#${n}`).join(' ')}`
    if (dropped > 0) msg += `\n⚠️ 槽位上限 ${MAX_SLOT}，有 ${dropped} 张未保存`
    msg += '\n发送 #名言照片列表 可查看'
    await e.reply(msg)
    return true
  }

  // 删除背景
  async delBg (e) {
    if (!e.isMaster) {
      await e.reply('⚠️ 只有主人可以删除名言背景')
      return true
    }
    const n = this.parseSlot(e)
    if (n > MAX_SLOT) {
      await e.reply(`⚠️ 槽位仅支持 1~${MAX_SLOT}，例如 #删除名言照片1`)
      return true
    }
    const file = await findBgFile(n)
    if (!file) {
      await e.reply(`⚠️ 名言照片 ${n} 尚未设置`)
      return true
    }
    await clearBgFile(n)
    await e.reply(`🗑️ 名言照片 ${n} 已删除`)
    return true
  }

  // 查看已有背景：合并转发，图片在前、清单在后
  // 默认所有人可看，锅巴里关掉「照片列表允许所有人查看」后仅主人可用
  async listBg (e) {
    const cfg = readConfig()
    if (cfg.listPublic === false && !e.isMaster) return true

    // 列表前先规范化命名：将不符合 custom-N.ext（1<=N<=MAX_SLOT）的图片文件
    // 重命名到最小空闲槽位，确保列表只展示规范文件；有重命名先提示
    const renamed = await normalizeBgFiles()
    if (renamed.length) {
      await e.reply(`🔄 已自动重命名 ${renamed.length} 个图片文件`)
    }

    const slots = await listBgSlots()
    if (!slots.length) {
      await e.reply('⚠️ 还没有设置过背景图，发一张图片并带上「#添加名言照片1」即可添加')
      return true
    }

    const limit = Math.min(60, Math.max(4, Number(cfg.listLimit) || 24))
    const shownSlots = slots.slice(0, limit)

    const items = []
    for (const slot of shownSlots) {
      const file = await findBgFile(slot)
      if (!file) continue
      const src = await fileToDataUrl(file)
      if (!src) continue
      let size = ''
      try {
        const st = await fs.stat(file)
        size = st.size >= 1024 * 1024
          ? `${(st.size / 1024 / 1024).toFixed(1)}MB`
          : `${Math.round(st.size / 1024)}KB`
      } catch {}
      items.push({ slot, src, size })
    }

    if (!items.length) {
      await e.reply('⚠️ 背景图读取失败，可能文件已损坏')
      return true
    }

    let img = null
    try {
      img = await puppeteer.screenshots('quote-card', {
        tplFile: LIST_TPL,
        saveId: `list_${Date.now()}`,
        imgType: 'jpeg',
        quality: 90,
        items,
        total: slots.length,
        shown: items.length,
        listPublic: cfg.listPublic !== false,
        canEdit: Boolean(e.isMaster),
      })
    } catch (err) {
      logger.error(`[名言卡片] 列表渲染失败: ${err.message}`)
    }

    // 列表本身就是一张完整的图（含总数、槽位号、删除提示），直接发图，不再包合并转发
    if (img) {
      await e.reply(img)
    } else {
      const lines = [`🗂 名言背景 共 ${slots.length} 张`]
      lines.push(items.map(i => `#${i.slot}`).join('  '))
      if (slots.length > items.length) lines.push(`（还有 ${slots.length - items.length} 张未展示）`)
      if (e.isMaster) lines.push(`删除某一套： #删除名言照片N（N 为图上的序号）`)
      await e.reply(lines.join('\n'))
    }
    return true
  }

  // 帮助图
  async help (e) {
    const bgImage = await fileToDataUrl(HELP_BG)
    const version = await readVersion()
    const listPublic = readConfig().listPublic !== false
    try {
      const img = await puppeteer.screenshots('quote-card', {
        tplFile: HELP_TPL,
        saveId: `help_${Date.now()}`,
        imgType: 'jpeg',
        quality: 92,
        bgImage,
        version,
        listPublic,
      })
      if (img) {
        await e.reply(img)
      } else {
        await e.reply('❌ 帮助图生成失败，请检查 puppeteer/chromium 是否正常')
      }
    } catch (err) {
      logger.error(`[名言卡片] 帮助图渲染失败: ${err.message}`)
      await e.reply(`❌ 帮助图生成失败: ${err.message.slice(0, 50)}`)
    }
    return true
  }

  async run (e) {
    return this.renderCard(e, 1)
  }

  async run2 (e) {
    return this.renderCard(e, 2)
  }

  async renderCard (e, style) {
    let srcMsg = null
    try {
      srcMsg = await resolveQuote(e)
    } catch (err) {
      logger.error(`[名言卡片] 获取引用消息失败: ${err.message}`)
    }

    if (!srcMsg) {
      await e.reply('⚠️ 请引用一条消息后发送 #名言')
      return true
    }

    const text = getText(srcMsg.message || srcMsg.raw_message || '')
    if (!text.trim()) {
      await e.reply('⚠️ 引用的消息没有文字内容')
      return true
    }

    await e.reply('🎨 正在生成卡片...')

    let qq = srcMsg.user_id || srcMsg.sender?.user_id || srcMsg.from_id || ''
    if (Array.isArray(qq)) qq = qq[0]
    qq = String(qq).trim()

    // QQBot 官方机器人的 user_id 是 "appid:openid" 这种复合 id，不是 QQ 号
    const isQqNum = /^\d{4,12}$/.test(qq)

    let name = ''
    try {
      if (isQqNum) {
        if (e.isGroup) {
          const m = e.bot.pickMember(e.group_id, qq)
          name = m.card || m.nickname || ''
        } else if (e.bot?.pickFriend) {
          const f = e.bot.pickFriend(qq)
          name = f.nickname || ''
        }
      }
    } catch (_) {}
    if (!name) name = srcMsg.sender?.card || srcMsg.sender?.nickname || srcMsg.nickname || ''
    if (!name) name = isQqNum ? qq : '匿名'

    // 头像：QQBot 用适配器给的 openid 头像（q.qlogo.cn/qqapp/...），其余按 QQ 号取
    const senderAvatar = srcMsg.sender?.avatar || srcMsg.avatar || ''
    const avatar = /^https?:\/\//.test(senderAvatar)
      ? senderAvatar
      : (isQqNum ? `https://q1.qlogo.cn/g?b=qq&s=640&nk=${qq}` : '')

    const bg = randColor()
    // 样式2 文字放大 1.25 倍
    const fsz = style === 2 ? Math.round(fontSize(text) * 1.25) : fontSize(text)
    const safeText = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

    // 加载自定义背景（随机挑一个已设置的槽位）；锅巴里可关闭
    const cfg = readConfig()
    let bgImage = ''
    try {
      if (cfg.randomBackground !== false) {
        const slots = await listBgSlots()
        if (slots.length) {
          const pick = slots[Math.floor(Math.random() * slots.length)]
          const file = await findBgFile(pick)
          if (file) bgImage = await fileToDataUrl(file)
        }
      }
    } catch (err) {
      logger.error(`[名言卡片] 加载背景失败: ${err.message}`)
    }

    try {
      const quality = Math.min(100, Math.max(60, Number(cfg.quality) || 92))
      const img = await puppeteer.screenshots('quote-card', {
        tplFile: TPL,
        saveId: `card_${Date.now()}`,
        imgType: 'jpeg',
        quality,
        bgColor: bg,
        bgImage,
        avatar,
        text: safeText,
        fontSize: fsz,
        senderName: name || '',
        style2: style === 2,
      })

      if (img) {
        await e.reply(img)
      } else {
        await e.reply('❌ 卡片生成失败，请稍后重试')
      }
    } catch (err) {
      logger.error(`[名言卡片] 渲染失败: ${err.message}`)
      await e.reply(`❌ 卡片生成失败: ${err.message.slice(0, 50)}`)
    }

    return true
  }
}
