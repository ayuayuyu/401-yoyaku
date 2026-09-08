import type { NextConfig } from 'next';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// 環境変数はリポジトリ直下の .env に一本化している (frontend/.env は廃止)。
// Docker 経由 (compose の environment / Dockerfile.prod の ARG) では process.env に
// 既に入っているのでそれを使う。ホストで `pnpm dev` / `pnpm build` するときだけ、
// Next は自分のディレクトリの .env しか読まないためここでルートの .env から補う。
function apiUrlFromRootEnv(): string {
  try {
    const text = readFileSync(resolve(process.cwd(), '../.env'), 'utf8');
    const line = text
      .split('\n')
      .find((l) => /^\s*(export\s+)?NEXT_PUBLIC_API_URL\s*=/.test(l));
    if (!line) return '';
    return line
      .slice(line.indexOf('=') + 1)
      .trim()
      .replace(/^["']|["']$/g, '');
  } catch {
    // ルート .env が無い環境 (本番イメージのビルド等) は process.env 側で足りている。
    return '';
  }
}

// 本番の same-origin 配信は空文字を「意図した値」として渡すので、
// || ではなく ?? を使い undefined のときだけ .env を読む。
const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? apiUrlFromRootEnv();

const nextConfig: NextConfig = {
  output: 'export',
  devIndicators: false,
  env: {
    NEXT_PUBLIC_API_URL: apiUrl,
  },
  sassOptions: {
    additionalData: '@use "@/styles/modules" as *;',
  },
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
