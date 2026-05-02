import { createWebSocket, getToken } from './api';

export type WsConnectionState = 'connecting' | 'open' | 'closing' | 'closed';

export type WsEnvelope = {
  type: string;
  data?: unknown;
  timestamp?: string;
};

export type WsMeta = {
  connectionState: WsConnectionState;
  reconnecting: boolean;
  reconnectCount: number;
  latencyMs: number | null;
  lastMessageAt: Date | null;
};

type Listener<T> = (value: T) => void;
type Unsubscribe = () => void;

class WsBus {
  private ws: WebSocket | null = null;
  private connectionState: WsConnectionState = 'closed';
  private reconnecting = false;
  private reconnectCount = 0;
  private latencyMs: number | null = null;
  private lastMessageAt: Date | null = null;
  private pingTime: number | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private subscriberCount = 0;

  private readonly typeListeners = new Map<string, Set<Listener<unknown>>>();
  private readonly anyListeners = new Set<Listener<WsEnvelope>>();
  private readonly metaListeners = new Set<Listener<WsMeta>>();

  constructor() {
    window.addEventListener('auth_token_changed', this.onAuthTokenChanged);
  }

  private onAuthTokenChanged = () => {
    if (!this.shouldStayConnected()) {
      this.shutdownSocket();
      this.updateMeta({ reconnecting: false });
      return;
    }
    this.reconnectNow();
  };

  private shouldStayConnected(): boolean {
    return this.subscriberCount > 0 && !!getToken();
  }

  private getMetaSnapshot(): WsMeta {
    return {
      connectionState: this.connectionState,
      reconnecting: this.reconnecting,
      reconnectCount: this.reconnectCount,
      latencyMs: this.latencyMs,
      lastMessageAt: this.lastMessageAt,
    };
  }

  private emitMeta() {
    const meta = this.getMetaSnapshot();
    this.metaListeners.forEach((cb) => cb(meta));
  }

  private updateMeta(partial: Partial<WsMeta>) {
    if (partial.connectionState) this.connectionState = partial.connectionState;
    if (typeof partial.reconnecting === 'boolean') this.reconnecting = partial.reconnecting;
    if (typeof partial.reconnectCount === 'number') this.reconnectCount = partial.reconnectCount;
    if (partial.latencyMs !== undefined) this.latencyMs = partial.latencyMs;
    if (partial.lastMessageAt !== undefined) this.lastMessageAt = partial.lastMessageAt;
    this.emitMeta();
  }

  private startPing() {
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.pingTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.pingTime = Date.now();
        try {
          this.ws.send('ping');
        } catch {
          this.pingTime = null;
        }
      }
    }, 10000);
  }

  private stopPing() {
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.pingTimer = null;
    this.pingTime = null;
  }

  private clearReconnectTimer() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }

  private shutdownSocket() {
    this.clearReconnectTimer();
    this.stopPing();

    if (this.ws) {
      const ws = this.ws;
      ws.onopen = null;
      ws.onclose = null;
      ws.onerror = null;
      ws.onmessage = null;
      try {
        ws.close();
      } catch {
        // ignore
      }
      this.ws = null;
    }

    this.updateMeta({ connectionState: 'closed' });
  }

  private ensureConnected() {
    if (!this.shouldStayConnected()) {
      this.shutdownSocket();
      this.updateMeta({ reconnecting: false });
      return;
    }
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return;
    this.connect(true);
  }

  private connect(isInitial: boolean) {
    if (!this.shouldStayConnected()) return;

    this.shutdownSocket();
    this.updateMeta({
      connectionState: 'connecting',
      reconnecting: !isInitial,
    });

    try {
      const ws = createWebSocket();
      this.ws = ws;

      ws.onopen = () => {
        this.reconnectCount = 0;
        this.updateMeta({
          connectionState: 'open',
          reconnecting: false,
        });
        this.startPing();
      };

      ws.onmessage = (event) => {
        this.lastMessageAt = new Date();
        const raw = String(event.data ?? '');
        let envelope: WsEnvelope | null = null;
        try {
          const parsed = JSON.parse(raw) as WsEnvelope;
          if (parsed && typeof parsed === 'object' && typeof parsed.type === 'string') {
            envelope = parsed;
          }
        } catch {
          envelope = null;
        }

        if (envelope?.type === 'pong') {
          if (this.pingTime !== null) {
            this.updateMeta({ latencyMs: Date.now() - this.pingTime, lastMessageAt: this.lastMessageAt });
            this.pingTime = null;
          } else {
            this.updateMeta({ lastMessageAt: this.lastMessageAt });
          }
          this.anyListeners.forEach((cb) => cb(envelope));
          return;
        }

        this.updateMeta({ lastMessageAt: this.lastMessageAt });
        if (!envelope) return;

        this.anyListeners.forEach((cb) => cb(envelope));
        const listeners = this.typeListeners.get(envelope.type);
        if (listeners) listeners.forEach((cb) => cb(envelope.data));
      };

      ws.onerror = () => {
        this.stopPing();
      };

      ws.onclose = () => {
        this.stopPing();
        this.ws = null;
        this.updateMeta({ connectionState: 'closed' });

        if (!this.shouldStayConnected()) {
          this.updateMeta({ reconnecting: false });
          return;
        }

        const base = 3000;
        const delay = Math.min(base * Math.pow(2, this.reconnectCount), 30000);
        this.reconnectCount += 1;
        this.updateMeta({ reconnecting: true, reconnectCount: this.reconnectCount });

        this.clearReconnectTimer();
        this.reconnectTimer = setTimeout(() => {
          if (!this.shouldStayConnected()) return;
          this.connect(false);
        }, delay);
      };
    } catch {
      this.updateMeta({ connectionState: 'closed' });
      if (!this.shouldStayConnected()) {
        this.updateMeta({ reconnecting: false });
        return;
      }
      this.reconnectCount += 1;
      this.updateMeta({ reconnecting: true, reconnectCount: this.reconnectCount });
      this.clearReconnectTimer();
      this.reconnectTimer = setTimeout(() => {
        if (!this.shouldStayConnected()) return;
        this.connect(false);
      }, 5000);
    }
  }

  subscribe(type: string, cb: Listener<unknown>): Unsubscribe {
    const listeners = this.typeListeners.get(type) ?? new Set<Listener<unknown>>();
    listeners.add(cb);
    this.typeListeners.set(type, listeners);

    this.subscriberCount += 1;
    this.ensureConnected();

    return () => {
      const cur = this.typeListeners.get(type);
      if (cur) {
        cur.delete(cb);
        if (cur.size === 0) this.typeListeners.delete(type);
      }
      this.subscriberCount = Math.max(0, this.subscriberCount - 1);
      if (this.subscriberCount === 0) this.shutdownSocket();
    };
  }

  subscribeAny(cb: Listener<WsEnvelope>): Unsubscribe {
    this.anyListeners.add(cb);
    this.subscriberCount += 1;
    this.ensureConnected();

    return () => {
      this.anyListeners.delete(cb);
      this.subscriberCount = Math.max(0, this.subscriberCount - 1);
      if (this.subscriberCount === 0) this.shutdownSocket();
    };
  }

  subscribeMeta(cb: Listener<WsMeta>): Unsubscribe {
    this.metaListeners.add(cb);
    cb(this.getMetaSnapshot());
    this.subscriberCount += 1;
    this.ensureConnected();
    return () => {
      this.metaListeners.delete(cb);
      this.subscriberCount = Math.max(0, this.subscriberCount - 1);
      if (this.subscriberCount === 0) this.shutdownSocket();
    };
  }

  getMeta(): WsMeta {
    return this.getMetaSnapshot();
  }

  send(payload: unknown) {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    try {
      this.ws.send(JSON.stringify(payload));
    } catch {
      // ignore
    }
  }

  reconnectNow() {
    if (this.subscriberCount === 0) return;
    this.reconnectCount = 0;
    this.updateMeta({ reconnecting: false, reconnectCount: 0 });
    this.connect(true);
  }
}

export const wsBus = new WsBus();
