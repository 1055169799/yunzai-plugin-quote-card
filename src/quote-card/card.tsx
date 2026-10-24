import React from 'react';

export type QuoteCardProps = {
  /** 背景色（无自定义背景图时使用） */
  bgColor: string;
  /** 自定义背景图（data URL），可选 */
  bgImage?: string;
  /** 头像（data URL），可选 */
  avatar?: string;
  /** 名言正文 */
  text: string;
  /** 正文字号（按文本长度自适应） */
  fontSize: number;
  /** 作者昵称 */
  senderName: string;
  /** 输出宽度（像素），默认 1280 */
  width?: number;
  /** 输出高度（像素），默认 640 */
  height?: number;
};

/** 设计稿基准尺寸：排版按此比例绘制后整体缩放，任意分辨率都不变形 */
export const BASE_WIDTH = 1280;
export const BASE_HEIGHT = 640;

/**
 * 名言卡片
 * 由 Yunzai 插件 yunzai-plugin-quote-card 的 resources/template.html 迁移而来。
 * 原模板使用伪元素做装饰光晕，这里改为独立的绝对定位层，便于 React 内联渲染。
 */
export default function QuoteCard({
  bgColor,
  bgImage,
  avatar,
  text,
  fontSize,
  senderName,
  width = BASE_WIDTH,
  height = BASE_HEIGHT
}: QuoteCardProps) {
  const scale = Math.min(width / BASE_WIDTH, height / BASE_HEIGHT);
  const offsetX = (width - BASE_WIDTH * scale) / 2;
  const offsetY = (height - BASE_HEIGHT * scale) / 2;

  return (
    <html>
      <head>
        <meta charSet='utf-8' />
      </head>
      <body
        style={{
          margin: 0,
          padding: 0,
          width,
          height,
          overflow: 'hidden',
          background: 'transparent'
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: offsetX,
            top: offsetY,
            width: BASE_WIDTH,
            height: BASE_HEIGHT,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: '"Noto Sans CJK SC", "Source Han Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif'
          }}
        >
          <div
            style={{
              position: 'relative',
              width: 1280,
              height: 640,
              borderRadius: 64,
              overflow: 'hidden',
              background: bgColor,
              border: '1px solid rgba(255,255,255,.45)',
              boxShadow: 'inset 0 0 80px rgba(255,255,255,.18), 0 30px 80px rgba(0,0,0,.18)'
            }}
          >
            {/* 背景图 */}
            {bgImage ? (
              <img
                src={bgImage}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  zIndex: 0
                }}
              />
            ) : null}

            {/* 背景遮罩 */}
            {bgImage ? (
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  zIndex: 1,
                  background: 'linear-gradient(135deg, rgba(255,255,255,.22), rgba(0,0,0,.18))'
                }}
              />
            ) : null}

            {/* 柔光（替代 .glass-shell:before） */}
            <div
              style={{
                position: 'absolute',
                left: '-20%',
                top: '-20%',
                width: '140%',
                height: '140%',
                zIndex: 1,
                background:
                  'radial-gradient(circle at 15% 40%, rgba(255,255,255,.28), transparent 28%), radial-gradient(circle at 85% 60%, rgba(255,255,255,.18), transparent 25%)',
                filter: 'blur(30px)'
              }}
            />

            {/* 底部渐亮（替代 .glass-shell:after） */}
            <div
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 0,
                height: 120,
                zIndex: 1,
                background: 'linear-gradient(180deg, transparent, rgba(255,255,255,.12))'
              }}
            />

            {/* 左右描边光 */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 8,
                width: 10,
                height: '100%',
                background: 'linear-gradient(180deg, transparent, rgba(255,255,255,.6), transparent)',
                filter: 'blur(8px)',
                zIndex: 3
              }}
            />
            <div
              style={{
                position: 'absolute',
                top: 0,
                right: 8,
                width: 10,
                height: '100%',
                background: 'linear-gradient(180deg, transparent, rgba(255,255,255,.6), transparent)',
                filter: 'blur(8px)',
                zIndex: 3
              }}
            />

            {/* 内描边 */}
            <div
              style={{
                position: 'absolute',
                top: 14,
                left: 14,
                right: 14,
                bottom: 14,
                border: '1.5px solid rgba(255,255,255,.6)',
                borderRadius: 50,
                zIndex: 5
              }}
            />
            <div
              style={{
                position: 'absolute',
                top: 22,
                left: 22,
                right: 22,
                bottom: 22,
                border: '1px solid rgba(255,255,255,.28)',
                borderRadius: 42,
                zIndex: 5
              }}
            />

            {/* 主体：左头像 / 右文字 */}
            <div style={{ position: 'relative', zIndex: 2, width: '100%', height: '100%', display: 'flex' }}>
              <div
                style={{
                  width: '50%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative'
                }}
              >
                {/* 头像光晕（替代 .left-avatar:before） */}
                <div
                  style={{
                    position: 'absolute',
                    width: 500,
                    height: 500,
                    borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(255,255,255,.3), transparent 65%)',
                    filter: 'blur(25px)'
                  }}
                />
                {avatar ? (
                  <img
                    src={avatar}
                    style={{
                      position: 'relative',
                      width: 430,
                      height: 430,
                      borderRadius: '50%',
                      objectFit: 'cover',
                      border: '6px solid rgba(255,255,255,.42)',
                      boxShadow: '0 0 0 18px rgba(255,255,255,.08), 0 30px 70px rgba(0,0,0,.22)'
                    }}
                  />
                ) : (
                  <div
                    style={{
                      position: 'relative',
                      width: 430,
                      height: 430,
                      borderRadius: '50%',
                      background: 'rgba(255,255,255,.35)',
                      border: '6px solid rgba(255,255,255,.42)',
                      boxShadow: '0 0 0 18px rgba(255,255,255,.08), 0 30px 70px rgba(0,0,0,.22)'
                    }}
                  />
                )}
              </div>

              <div
                style={{
                  width: '50%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 55px',
                  boxSizing: 'border-box'
                }}
              >
                <div
                  style={{
                    width: '100%',
                    padding: '48px 42px',
                    borderRadius: 42,
                    position: 'relative',
                    overflow: 'hidden',
                    background: 'rgba(255,255,255,.18)',
                    backdropFilter: 'blur(30px) saturate(160%)',
                    WebkitBackdropFilter: 'blur(30px) saturate(160%)',
                    border: '1px solid rgba(255,255,255,.45)',
                    boxShadow: 'inset 0 0 70px rgba(255,255,255,.18), 0 25px 60px rgba(0,0,0,.16)'
                  }}
                >
                  {/* 玻璃高光（替代 .text-card:before） */}
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      background: 'linear-gradient(135deg, rgba(255,255,255,.3), transparent 45%)'
                    }}
                  />
                  <div
                    style={{
                      position: 'relative',
                      fontSize: 110,
                      lineHeight: 0.8,
                      fontFamily: 'serif',
                      color: 'rgba(0,0,0,.08)'
                    }}
                  >
                    “
                  </div>
                  <div
                    style={{
                      position: 'relative',
                      fontSize,
                      fontWeight: 800,
                      color: '#111',
                      lineHeight: 1.9,
                      letterSpacing: 1,
                      wordBreak: 'break-word',
                      maxHeight: 300,
                      overflow: 'hidden'
                    }}
                  >
                    {text}
                  </div>
                  <div
                    style={{
                      position: 'relative',
                      marginTop: 35,
                      fontSize: 27,
                      fontWeight: 700,
                      color: 'rgba(0,0,0,.35)',
                      letterSpacing: 1
                    }}
                  >
                    —— {senderName}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
