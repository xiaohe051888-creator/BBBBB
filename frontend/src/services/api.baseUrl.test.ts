import { describe, expect, it } from 'vitest';

import { normalizeApiBaseUrl, normalizeWsBaseUrl } from './api';

describe('api deployment url normalization', () => {
  it('defaults api base to /api when env var is empty', () => {
    expect(normalizeApiBaseUrl()).toBe('/api');
  });

  it('appends /api for bare external backend urls', () => {
    expect(normalizeApiBaseUrl('https://backend.example.com')).toBe('https://backend.example.com/api');
    expect(normalizeApiBaseUrl('https://backend.example.com/')).toBe('https://backend.example.com/api');
  });

  it('keeps explicit api path unchanged', () => {
    expect(normalizeApiBaseUrl('https://backend.example.com/api')).toBe('https://backend.example.com/api');
  });

  it('converts render external urls into websocket endpoints', () => {
    expect(normalizeWsBaseUrl('https://backend.example.com')).toBe('wss://backend.example.com/ws');
    expect(normalizeWsBaseUrl('http://backend.example.com')).toBe('ws://backend.example.com/ws');
  });

  it('keeps explicit websocket urls and appends /ws when missing', () => {
    expect(normalizeWsBaseUrl('wss://backend.example.com')).toBe('wss://backend.example.com/ws');
    expect(normalizeWsBaseUrl('wss://backend.example.com/ws')).toBe('wss://backend.example.com/ws');
  });
});
