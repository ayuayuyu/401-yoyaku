# Goの公式イメージを使用
FROM golang:1.25-alpine

# 作業ディレクトリを作成
WORKDIR /go/src/app/

# パッケージをインストール
RUN apk update && apk add git

# ホットリロード用のairをインストール
ENV PATH="/go/bin:${PATH}"
RUN go install github.com/air-verse/air@v1.61.5

# デフォルトでポート 8080 を使用
ENV PORT=8080

# コンテナがリッスンするポートを指定
EXPOSE 8080

# 開発時はvolume mountでソースを共有し、airでホットリロード
CMD ["air", "-c", ".air.toml"]
