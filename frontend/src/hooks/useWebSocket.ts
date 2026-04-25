/**
 * WebSocket 连接管理 Hook
 * 统一管理 WebSocket 连接、重连和消息处理
 */
import { useEffect, useRef, useCallback, useState } from 'react';
import * as api from '../services/api';

interface WebSocketMessage {
  type: string;
  
  data: Record<string, unknown>;
  timestamp?: string;
}

interface UseWebSocketOptions {
  onStateUpdate?: (data: any) => void;
  onLog?: (data: any) => void;
  onAnalysis?: (data: any) => void;
  onGameRevealed?: (data: any) => void;
  onBetPlaced?: (data: any) => void;
  reconnectInterval?: number;
}

interface UseWebSocketReturn {
  /** 发送消息 */
  sendMessage: (message: unknown) => void;
  /** 手动重连 */
  reconnect: () => void;
  /** 连接状态 */
  connectionState: 'connecting' | 'open' | 'closing' | 'closed';
}

/**
 * WebSocket 连接管理 Hook
 * @param options 配置选项
 * @returns WebSocket 操作方法
 */
export const useWebSocket = (options: UseWebSocketOptions): UseWebSocketReturn => {
  const { onStateUpdate,
    onLog,
    onAnalysis,
    onGameRevealed,
    onBetPlaced,
    reconnectInterval = 3000,
  } = options;

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectCountRef = useRef(0); // 记录重连次数，用于指数退避
  const isUnmountedRef = useRef(false);
  // 使用 state 触发重连
  const [reconnectTrigger, setReconnectTrigger] = useState(0);
  const [connectionState, setConnectionState] = useState<'connecting' | 'open' | 'closing' | 'closed'>('closed');
  // 使用 ref 存储回调函数，避免闭包问题
  const callbacksRef = useRef({
    onStateUpdate,
    onLog,
    onAnalysis,
    onGameRevealed,
    onBetPlaced,
  });

  // 更新回调函数 ref
  useEffect(() => {
    callbacksRef.current = {
      onStateUpdate,
      onLog,
      onAnalysis,
      onGameRevealed,
      onBetPlaced,
    };
  }, [onStateUpdate, onLog, onAnalysis, onGameRevealed, onBetPlaced]);

  const sendMessage = useCallback((message: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  // 建立连接 - 在 useEffect 中定义 connect 避免渲染时访问 ref
  useEffect(() => {
    isUnmountedRef.current = false;
    // 使用setTimeout避免同步setState
    const stateTimer = setTimeout(() => {
      setConnectionState('connecting');
    }, 0);

    const connect = () => {
      if (isUnmountedRef.current) return;

      try {
        const ws = api.createWebSocket();
        wsRef.current = ws;

        ws.onopen = () => {
          setConnectionState('open');
          reconnectCountRef.current = 0; // 连接成功，重置重连次数

          // 发送心跳包保活
          if (pingTimerRef.current) clearInterval(pingTimerRef.current);
          pingTimerRef.current = window.setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'ping' }));
            }
          }, 30000);
        };

        ws.onmessage = (event) => {
          // 处理服务端的 pong 响应（可能为文本或 JSON）
          if (event.data === "pong" || event.data === '{"type":"pong"}') {
            return;
          }
          
          try {
            const message: WebSocketMessage = JSON.parse(event.data);
            const callbacks = callbacksRef.current;

            switch (message.type) {
              case 'state_update':
                callbacks.onStateUpdate?.(message.data);
                break;
              case 'log':
                callbacks.onLog?.(message.data);
                break;
              case 'ai_analysis':
                callbacks.onAnalysis?.(message.data);
                break;
              case 'game_revealed':
                callbacks.onGameRevealed?.(message.data);
                break;
              case 'bet_placed':
                callbacks.onBetPlaced?.(message.data);
                break;
              default:
                // 未知消息类型，静默处理
                break;
            }
          } catch (err) {
            console.error('[WebSocket] 消息解析错误:', err);
          }
        };

        ws.onerror = (err) => {
          console.error('[WebSocket] 连接错误:', err);
        };

        ws.onclose = () => {
          setConnectionState('closed');
          if (!isUnmountedRef.current) {
            // 指数退避策略：3s, 6s, 12s, 24s... 最大 30 秒
            const backoffDelay = Math.min(reconnectInterval * Math.pow(2, reconnectCountRef.current), 30000);
            reconnectCountRef.current += 1;
            
            reconnectTimerRef.current = setTimeout(() => {
              setReconnectTrigger(prev => prev + 1);
            }, backoffDelay);
          }
        };
      } catch {
        setConnectionState('closed');
        if (!isUnmountedRef.current) {
          const backoffDelay = Math.min(reconnectInterval * Math.pow(2, reconnectCountRef.current), 30000);
          reconnectCountRef.current += 1;
          
          reconnectTimerRef.current = setTimeout(() => {
            setReconnectTrigger(prev => prev + 1);
          }, backoffDelay);
        }
      }
    };

    connect();

    return () => {
          clearTimeout(stateTimer);
          if (pingTimerRef.current) {
            clearInterval(pingTimerRef.current);
            pingTimerRef.current = null;
          }
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
  }, [reconnectInterval, reconnectTrigger]);

  const reconnect = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close();
    }
    // 触发 useEffect 重新执行
    setReconnectTrigger(prev => prev + 1);
  }, []);

  return {
    sendMessage,
    reconnect,
    connectionState,
  };
};

export default useWebSocket;
