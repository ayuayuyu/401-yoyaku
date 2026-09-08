# 本番用 backend イメージ (マルチステージ)。
# 開発用は build/go/Dockerfile (Air ホットリロード) を使う。こちらは静的バイナリ。
FROM golang:1.25-alpine AS build

WORKDIR /src

# 依存だけ先に取得してレイヤキャッシュを効かせる。
COPY src/go.mod src/go.sum ./
RUN go mod download

COPY src/ ./

# 静的リンクのバイナリを生成。アーキテクチャは BuildKit が渡す TARGETOS/TARGETARCH
# に従う (CI は --platform linux/amd64、手元の arm64 Mac では arm64)。
# ここを amd64 に固定すると、arm64 機でのローカル検証ビルドが
# ランタイムの alpine と食い違い "exec format error" で起動しない。
ARG TARGETOS=linux
ARG TARGETARCH=amd64
RUN CGO_ENABLED=0 GOOS=${TARGETOS} GOARCH=${TARGETARCH} \
    go build -trimpath -ldflags="-s -w" -o /out/yoyaku .

# ---- runtime ----
FROM alpine:3.20

# HTTPS 通信の CA と、time.LoadLocation("Asia/Tokyo") 用のタイムゾーンデータ。
RUN apk add --no-cache ca-certificates tzdata

COPY --from=build /out/yoyaku /app/yoyaku

ENV PORT=8080
EXPOSE 8080

CMD ["/app/yoyaku"]
