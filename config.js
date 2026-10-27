/**
 * 插件配置读写（无第三方依赖，纯 JSON）
 * 默认值即「不加配置文件时的行为」，所以不建配置文件也完全正常
 */
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const CONFIG_DIR = path.join(__dirname, 'config')
export const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json')

export const DEFAULTS = {
  quality: 92,            // 卡片画质（jpeg 60~100）
  randomBackground: true, // 生成卡片时是否随机套用已设置的背景图
  listLimit: 24,          // #名言照片列表 最多展示几张
  listPublic: true,       // #名言照片列表 是否允许所有人查看（false 则仅主人）
}

/** 读取配置（缺字段用默认值补齐，文件损坏也不抛错） */
export function readConfig () {
  try {
    const raw = fs.readFileSync(CONFIG_FILE, 'utf8')
    const data = JSON.parse(raw)
    return { ...DEFAULTS, ...(data && typeof data === 'object' ? data : {}) }
  } catch {
    return { ...DEFAULTS }
  }
}

/** 合并写入配置 */
export function writeConfig (patch) {
  const next = { ...readConfig(), ...(patch || {}) }
  fs.mkdirSync(CONFIG_DIR, { recursive: true })
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(next, null, 2) + '\n')
  return next
}
