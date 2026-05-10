import { describe, expect, it } from 'vitest';

import { pwaManifest, pwaWorkbox } from './config';

describe('pwa config', () => {
  it('uses standalone install metadata and expected icon set', () => {
    expect(pwaManifest.name).toBe('百家乐智能分析');
    expect(pwaManifest.short_name).toBe('智能百家乐');
    expect(pwaManifest.display).toBe('standalone');
    expect(pwaManifest.start_url).toBe('/');
    expect(pwaManifest.icons).toEqual([
      { src: '/pwa/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/pwa/icon-512.png', sizes: '512x512', type: 'image/png' },
      {
        src: '/pwa/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ]);
  });

  it('keeps api and websocket traffic out of offline caches', () => {
    const runtimeCaching = pwaWorkbox.runtimeCaching ?? [];

    expect(pwaWorkbox.navigateFallbackDenylist).toEqual([/^\/api\//, /^\/ws/]);
    expect(runtimeCaching).toHaveLength(3);
    expect(runtimeCaching[0]?.handler).toBe('NetworkOnly');
    expect(String(runtimeCaching[0]?.urlPattern)).toContain('/api/');
    expect(runtimeCaching[1]?.handler).toBe('NetworkOnly');
    expect(String(runtimeCaching[1]?.urlPattern)).toContain('/ws');
  });
});
