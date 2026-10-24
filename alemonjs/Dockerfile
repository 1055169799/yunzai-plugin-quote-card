# 国内网络环境：基础镜像与 npm 均走加速源
FROM docker.1ms.run/node:22-alpine AS builder
WORKDIR /app
RUN corepack enable && corepack prepare yarn@1.22.22 --activate \
    && yarn config set registry https://registry.npmmirror.com

# 先装依赖，利用层缓存
COPY package.json yarn.lock ./
RUN yarn install

# 构建（lvy build -> lib/）
COPY . .
RUN npx lvy build

FROM docker.1ms.run/node:22-alpine
WORKDIR /app
ENV NODE_ENV=production \
    TZ=Asia/Shanghai \
    JSXP_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Chromium（jsxp 截图用）+ 中文字体（卡片文字渲染）
RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.aliyun.com/g' /etc/apk/repositories \
    && apk add --no-cache chromium font-noto-cjk ttf-dejavu \
    && rm -rf /var/cache/apk/*

# 仅安装 pm2 运行所需的 prod 依赖太复杂，直接复用完整依赖（node:22-alpine 体积可控）
RUN corepack enable && corepack prepare yarn@1.22.22 --activate
COPY --from=builder /app /app

# 非 root 运行
RUN chown -R node:node /app
USER node

# 默认平台：onebot（compose 中可按服务覆盖 command）
CMD ["node", "index.js", "--platform", "onebot"]
