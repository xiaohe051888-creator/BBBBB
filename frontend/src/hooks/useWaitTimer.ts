/**
 * 等待计时器 Hook
 * 用于等待开奖状态的计时功能
 */
import { useState, useEffect, useRef, useCallback } from 'react';

interface UseWaitTimerOptions {
  /** 是否启用计时 */
  enabled: boolean;
  /** 计时器间隔（毫秒） */
  interval?: number;
}

interface UseWaitTimerReturn {
  /** 已等待秒数 */
  seconds: number;
  /** 格式化的时间字符串（MM:SS） */
  formattedTime: string;
  /** 重置计时器 */
  reset: () => void;
}

/**
 * 等待计时器 Hook
 * @param options 配置选项
 * @returns 计时状态和操作方法
 */
export const useWaitTimer = (options: UseWaitTimerOptions): UseWaitTimerReturn => {
  const { enabled, interval = 1000 } = options;
  const [seconds, setSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const reset = useCallback(() => {
    setSeconds(0);
  }, []);

  // 重置计时器
  useEffect(() => {
    if (enabled) {
      // 使用 requestAnimationFrame 避免在 effect 中直接 setState
      const rafId = requestAnimationFrame(() => {
        setSeconds(0);
      });
      timerRef.current = setInterval(() => {
        setSeconds((prev) => prev + 1);
      }, interval);

      return () => {
        cancelAnimationFrame(rafId);
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = undefined;
        }
      };
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = undefined;
      }
      // 使用 requestAnimationFrame 避免在 effect 中直接 setState
      const rafId = requestAnimationFrame(() => {
        setSeconds(0);
      });
      return () => cancelAnimationFrame(rafId);
    }
  }, [enabled, interval]);

  // 格式化时间 MM:SS
  const formattedTime = `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;

  return {
    seconds,
    formattedTime,
    reset,
  };
};

export default useWaitTimer;
