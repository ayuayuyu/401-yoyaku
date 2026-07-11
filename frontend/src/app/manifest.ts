import type { MetadataRoute } from 'next';

// output: 'export' でも静的な manifest.webmanifest として書き出すため force-static。
export const dynamic = 'force-static';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '401予約管理システム',
    short_name: '401予約',
    description: '401という部屋の予約の管理システム',
    start_url: '/',
    id: '/',
    display: 'standalone',
    orientation: 'portrait',
    lang: 'ja',
    background_color: '#eef3f9',
    theme_color: '#4285f4',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
