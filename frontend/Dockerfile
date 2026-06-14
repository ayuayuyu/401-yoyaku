FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

EXPOSE 3000

# 開発時は webpack 版の `next dev` で起動する。
# Turbopack は WATCHPACK_POLLING を参照しないため、macOS の Docker bind mount 上では
# ファイル変更が検知されず HMR が動かない。webpack なら compose の WATCHPACK_POLLING=true で
# ポーリング監視が有効になり、ホスト側の編集が即反映される。
CMD ["./node_modules/.bin/next", "dev", "--hostname", "0.0.0.0", "--port", "3000"]
