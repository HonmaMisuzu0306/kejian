import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: 'auto',
      includeAssets: ['icon.svg', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: '课间 · 我的课表',
        short_name: '课间',
        description: '校园时间管理终端：课表截图导入、校对与周计划。',
        lang: 'zh-CN',
        theme_color: '#151817',
        background_color: '#e7e8e4',
        display: 'standalone',
        start_url: '/',
        scope: '/',
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
            src: '/icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,traineddata}'],
        maximumFileSizeToCacheInBytes: 45 * 1024 * 1024,
        navigateFallback: '/index.html',
      },
    }),
  ],
  test: { include: ['src/**/*.test.ts'], environment: 'node' },
})
