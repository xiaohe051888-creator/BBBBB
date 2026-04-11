/**
 * 数据刷新视觉反馈 Hook
 * 在数据更新时提供微妙的视觉反馈
 */
import { useState, useEffect, useRef, useCallback } from 'react';

interface UseDataRefreshIndicatorOptions {
  /** 数据依赖项 */
  data: unknown;
  /** 刷新完成后的闪烁持续时间(ms) */
  flashDuration?: number;
}

interface UseDataRefreshIndicatorReturn {
  /** 是否正在闪烁（数据刚更新） */
  isFlashing: boolean;
  /** 上次更新时间 */
  lastUpdateTime: Date | null;
  /** 格式化后的更新时间 */
  formattedUpdateTime: string;
  /** 手动触发闪烁 */
  triggerFlash: () => void;
}

/**
 * 数据刷新视觉反馈 Hook
 * @param options 配置选项
 * @returns 刷新状态
 */
export const useDataRefreshIndicator = (
  options: UseDataRefreshIndicatorOptions
): UseDataRefreshIndicatorReturn => {
  const { data, flashDuration = 800 } = options;
  
  const [isFlashing, setIsFlashing] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);
  const [formattedUpdateTime, setFormattedUpdateTime] = useState<string>('');
  const prevDataRef = useRef<unknown>(undefined);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 格式化时间
  const formatTime = useCallback((date: Date): string => {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  }, []);

  // 触发闪烁
  const triggerFlash = useCallback(() => {
    if (flashTimerRef.current) {
      clearTimeout(flashTimerRef.current);
    }
    setIsFlashing(true);
    flashTimerRef.current = setTimeout(() => {
      setIsFlashing(false);
    }, flashDuration);
  }, [flashDuration]);

  // 监听数据变化
  useEffect(() => {
    // 首次加载不触发闪烁
    if (prevDataRef.current === undefined) {
      prevDataRef.current = data;
      return;
    }

    // 深度比较数据是否变化
    const hasChanged = JSON.stringify(prevDataRef.current) !== JSON.stringify(data);

    if (hasChanged) {
      const now = new Date();
      // 使用setTimeout避免同步setState
      const timer = setTimeout(() => {
        setLastUpdateTime(now);
        setFormattedUpdateTime(formatTime(now));
        triggerFlash();
      }, 0);
      prevDataRef.current = data;
      return () => clearTimeout(timer);
    }
  }, [data, formatTime, triggerFlash]);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (flashTimerRef.current) {
        clearTimeout(flashTimerRef.current);
      }
    };
  }, []);

  return {
    isFlashing,
    lastUpdateTime,
    formattedUpdateTime,
    triggerFlash,
  };
};

export default useDataRefreshIndicator;
