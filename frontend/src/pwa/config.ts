import type { ManifestOptions, VitePWAOptions } from 'vite-plugin-pwa';

export const pwaManifest: Partial<ManifestOptions> = {
  name: '百家乐智能分析',
  short_name: '智能百家乐',
  description: '百家乐实时智能分析与决策面板',
  start_url: '/',
  scope: '/',
  display: 'standalone',
  theme_color: '#08101f',
  background_color: '#08101f',
  icons: [
    { src: '/pwa/icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: '/pwa/icon-512.png', sizes: '512x512', type: 'image/png' },
    {
      src: '/pwa/icon-maskable-512.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'maskable',
    },
  ],
};

export const pwaWorkbox: NonNullable<VitePWAOptions['workbox']> = {
  globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}'],
  navigateFallback: '/index.html',
  navigateFallbackDenylist: [/^\/api\//, /^\/ws/],
  runtimeCaching: [
    {
      urlPattern: ({ url }) => url.pathname.includes('/api/'),
      handler: 'NetworkOnly',
    },
    {
      urlPattern: ({ url }) => url.pathname.includes('/ws'),
      handler: 'NetworkOnly',
    },
    {
      urlPattern: ({ request }) =>
        ['style', 'script', 'worker', 'image', 'font'].includes(request.destination),
      handler: 'StaleWhileRevalidate',
      options: { cacheName: 'static-assets' },
    },
  ],
};

export const pwaOptions: Partial<VitePWAOptions> = {
  registerType: 'prompt',
  injectRegister: false,
  includeAssets: ['favicon.svg', 'pwa/apple-touch-icon.png'],
  manifest: pwaManifest,
  workbox: pwaWorkbox,
  devOptions: { enabled: false },
};
