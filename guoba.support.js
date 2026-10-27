/**
 * 锅巴（Guoba）适配
 * 只在插件根目录放这个文件，锅巴启动时会自动扫描并注册
 * 文档：guoba-yunzai/guoba-plugin
 */
import { readConfig, writeConfig, DEFAULTS } from './config.js'

export const supportGuoba = () => {
  return {
    pluginInfo: {
      name: 'yunzai-plugin-quote-card',
      title: '名言卡片',
      description: '引用一条消息生成名言卡片，支持两种样式、最多 100 个自定义背景槽位',
      author: 'Looking08',
      authorLink: 'https://github.com/Looking08',
      link: 'https://github.com/Looking08/yunzai-plugin-quote-card',
      isV3: true,
      isV2: false,
      showInMenu: 'auto',
      icon: 'mdi:card-text-outline',
      iconColor: '#FCC419',
    },
    configInfo: {
      schemas: [
        { component: 'SOFT_GROUP_BEGIN', label: '卡片渲染' },
        {
          field: 'quality',
          label: '卡片画质',
          component: 'InputNumber',
          bottomHelpMessage: 'jpeg 质量，数值越高越清晰、体积也越大（建议 85~95）',
          componentProps: {
            min: 60,
            max: 100,
            step: 1,
            placeholder: String(DEFAULTS.quality),
          },
        },
        {
          field: 'randomBackground',
          label: '随机套用背景图',
          component: 'Switch',
          bottomHelpMessage: '关闭后只出纯色玻璃卡片，已设置的背景图会被忽略',
        },
        { component: 'SOFT_GROUP_BEGIN', label: '指令行为' },
        {
          field: 'listPublic',
          label: '照片列表允许所有人查看',
          component: 'Switch',
          bottomHelpMessage: '开启后谁都能发「#名言照片列表」看图；关闭后只有主人能看',
          componentProps: {
            checkedValue: true,
            unCheckedValue: false,
          },
        },
        {
          field: 'listLimit',
          label: '#名言照片列表 最多展示',
          component: 'InputNumber',
          bottomHelpMessage: '一次最多画几张缩略图，超出的会在文字里提示（4~60）',
          componentProps: {
            min: 4,
            max: 60,
            step: 4,
            placeholder: String(DEFAULTS.listLimit),
          },
        },
      ],

      // 前端填充表单
      getConfigData () {
        const cfg = readConfig()
        return {
          quality: cfg.quality,
          randomBackground: cfg.randomBackground,
          listLimit: cfg.listLimit,
          listPublic: cfg.listPublic,
        }
      },

      // 前端点保存
      setConfigData (data, { Result }) {
        try {
          const patch = {}
          if (data.quality !== undefined) {
            const v = Number(data.quality)
            patch.quality = Number.isFinite(v) ? Math.min(100, Math.max(60, Math.round(v))) : DEFAULTS.quality
          }
          if (data.listLimit !== undefined) {
            const v = Number(data.listLimit)
            patch.listLimit = Number.isFinite(v) ? Math.min(60, Math.max(4, Math.round(v))) : DEFAULTS.listLimit
          }
          if (data.randomBackground !== undefined) {
            patch.randomBackground = Boolean(data.randomBackground)
          }
          if (data.listPublic !== undefined) {
            patch.listPublic = Boolean(data.listPublic)
          }
          writeConfig(patch)
          return Result.ok({}, '保存成功~')
        } catch (err) {
          return Result.error(`保存失败：${err.message}`)
        }
      },
    },
  }
}
