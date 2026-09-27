/**
 * 名言卡片生成插件
 * 引用一条消息，回复 #名言 即可生成精美卡片
 * 自定义背景：#添加名言照片1~100 + 图片；#删除名言照片1~100 删除
 */

import plugin from '../../lib/plugins/plugin.js'
import puppeteer from '../../lib/puppeteer/puppeteer.js'
import path from 'node:path'
import fs from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const TPL = path.join(__dirname, 'resources', 'template.html')
const BG_DIR = path.join(__dirname, 'resources', 'backgrounds')
const MAX_SLOT = 100

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

// 从消息事件中提取图片 URL 数组
function getImageUrls (msg) {
  const urls = []
  if (!msg) return urls
  if (Array.isArray(msg.img)) urls.push(...msg.img)
  if (Array.isArray(msg.message)) {
    for (const m of msg.message) {
      if (m && m.type === 'image' && m.url) urls.push(m.url)
    }
  }
  return [...new Set(urls.filter(Boolean))]
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
        { reg: '^#名言$', fnc: 'run' },
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

  // 添加背景
  async addBg (e) {
    if (!e.isMaster) {
      await e.reply('⚠️ 只有主人可以添加名言背景')
      return true
    }
    const n = this.parseSlot(e)
    if (n > MAX_SLOT) {
      await e.reply(`⚠️ 槽位仅支持 1~${MAX_SLOT}，例如 #添加名言照片1`)
      return true
    }

    let urls = getImageUrls(e)
    if (!urls.length && (e.reply_id || e.source)) {
      let reply = null
      try { reply = e.getReply ? await e.getReply() : e.source } catch {}
      if (reply) urls = getImageUrls(reply)
    }
    if (!urls.length) {
      await e.reply('⚠️ 请附带一张图片（直接发图 + 命令，或引用一张图片）')
      return true
    }

    await e.reply('⏳ 正在下载并保存背景...')
    try {
      const buf = await downloadImage(urls[0])
      const type = detectType(buf)
      await ensureBgDir()
      await clearBgFile(n)
      await fs.writeFile(path.join(BG_DIR, `custom-${n}.${type.ext}`), buf)
      await e.reply(`✅ 名言照片 ${n} 已更新（${type.ext}，${Math.round(buf.length / 1024)}KB）`)
    } catch (err) {
      logger.error(`[名言卡片] 保存背景失败: ${err.message}`)
      await e.reply(`❌ 保存背景失败: ${err.message.slice(0, 50)}`)
    }
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

  async run (e) {
    if (!e.reply_id && !e.source) {
      await e.reply('⚠️ 请引用一条消息后发送 #名言')
      return true
    }

    await e.reply('🎨 正在生成卡片...')

    let srcMsg
    try {
      if (e.source) {
        srcMsg = e.source
      } else if (e.getReply) {
        srcMsg = await e.getReply()
      }
    } catch (err) {
      logger.error(`[名言卡片] 获取引用消息失败: ${err.message}`)
    }

    if (!srcMsg) {
      await e.reply('⚠️ 无法获取引用的消息')
      return true
    }

    let qq = srcMsg.user_id || srcMsg.sender?.user_id || srcMsg.from_id || ''
    if (Array.isArray(qq)) qq = qq[0]
    qq = String(qq).trim()

    const text = getText(srcMsg.message || srcMsg.raw_message || '')
    if (!text.trim()) {
      await e.reply('⚠️ 引用的消息没有文字内容')
      return true
    }

    let name = ''
    try {
      if (e.isGroup && qq) {
        const m = e.bot.pickMember(e.group_id, qq)
        name = m.card || m.nickname || ''
      } else if (qq && e.bot?.pickFriend) {
        const f = e.bot.pickFriend(qq)
        name = f.nickname || ''
      }
    } catch (_) {}
    if (!name && srcMsg.sender) {
      name = srcMsg.sender.card || srcMsg.sender.nickname || ''
    }
    if (!name) name = qq || '发送者'

    const avatar = qq
      ? `https://q1.qlogo.cn/g?b=qq&s=640&nk=${qq}`
      : ''

    const bg = randColor()
    const fsz = fontSize(text)
    const safeText = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

    // 加载自定义背景（随机挑一个已设置的槽位）
    let bgImage = ''
    try {
      const slots = await listBgSlots()
      if (slots.length) {
        const pick = slots[Math.floor(Math.random() * slots.length)]
        const file = await findBgFile(pick)
        if (file) {
          const buf = await fs.readFile(file)
          const ext = path.extname(file).slice(1).toLowerCase()
          const mime = EXT_MIME[ext] || 'image/jpeg'
          bgImage = `data:${mime};base64,${buf.toString('base64')}`
        }
      }
    } catch (err) {
      logger.error(`[名言卡片] 加载背景失败: ${err.message}`)
    }

    try {
      const img = await puppeteer.screenshots('quote-card', {
        tplFile: TPL,
        saveId: `card_${Date.now()}`,
        imgType: 'jpeg',
        quality: 92,
        bgColor: bg,
        bgImage,
        avatar,
        text: safeText,
        fontSize: fsz,
        senderName: name || '',
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
