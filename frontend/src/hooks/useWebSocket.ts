/**
 * WebSocket 连接管理 Hook
 * 统一管理 WebSocket 连接、重连和消息处理
 */
import { useEffect, useRef, useCallback } from 'react';
import * as api from '../services/api';

interface WebSocketMessage {
  type: string;
  data: Record<string, unknown>;
}

interface UseWebSocketOptions {
  tableId: string | undefined;
  onStateUpdate?: (data: Record<string, unknown>) => void;
  onLog?: () => void;
  onAnalysis?: (data: Record<string, unknown>) => void;
  onGameRevealed?: () => void;
  onBetPlaced?: () => void;
  reconnectInterval?: number;
}

interface UseWebSocketReturn {
  /** 发送消息 */
  sendMessage: (message: unknown) => void;
  /** 手动重连 */
  reconnect: () => void;
}

/**
 * WebSocket 连接管理 Hook
 * @param options 配置选项
 * @returns WebSocket 操作方法
 */
export const useWebSocket = (options: UseWebSocketOptions): UseWebSocketReturn => {
  const {
    tableId,
    onStateUpdate,
    onLog,
    onAnalysis,
    onGameRevealed,
    onBetPlaced,
    reconnectInterval = 3000,
  } = options;

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isUnmountedRef = useRef(false);
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  const connectRef = useRef<() => void>(() => {});

  const connect = useCallback(() => {
    if (!tableId || isUnmountedRef.current) return;

    try {
      const ws = api.createWebSocket(tableId);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);

          switch (message.type) {
            case 'state_update':
              onStateUpdate?.(message.data);
              break;
            case 'log':
              onLog?.();
              break;
            case 'analysis':
              onAnalysis?.(message.data);
              break;
            case 'game_revealed':
              onGameRevealed?.();
              break;
            case 'bet_placed':
              onBetPlaced?.();
              break;
            default:
              // 未知消息类型，静默处理
              break;
          }
        } catch {
          // WebSocket消息解析错误，静默处理
        }
      };

      ws.onerror = () => {
        // WebSocket错误，静默处理
      };

      ws.onclose = () => {
        if (!isUnmountedRef.current && connectRef.current) {
          reconnectTimerRef.current = setTimeout(connectRef.current, reconnectInterval);
        }
      };
    } catch {
      if (!isUnmountedRef.current && connectRef.current) {
        reconnectTimerRef.current = setTimeout(connectRef.current, reconnectInterval + 2000);
      }
    }
  }, [
    tableId,
    onStateUpdate,
    onLog,
    onAnalysis,
    onGameRevealed,
    onBetPlaced,
    reconnectInterval,
  ]);

  // 将 connect 赋值给 ref，以便在闭包中使用
  connectRef.current = connect;

  const sendMessage = useCallback((message: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  const reconnect = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close();
    }
    connect();
  }, [connect]);

  // 建立连接
  useEffect(() => {
    isUnmountedRef.current = false;
    connect();

    return () => {
      isUnmountedRef.current = true;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);

  return {
    sendMessage,
    reconnect,
  };
};

export default useWebSocket;
