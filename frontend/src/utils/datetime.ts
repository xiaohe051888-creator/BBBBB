import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

const BJ_TZ = 'Asia/Shanghai';

const hasOffset = (v: string) => /Z$|[+-]\d\d:\d\d$/.test(v);

export const toBeijing = (v: string) => {
  if (!v) return dayjs('');
  return hasOffset(v) ? dayjs(v).tz(BJ_TZ) : dayjs.utc(v).tz(BJ_TZ);
};

export const formatBeijing = (v: string, fmt: string) => toBeijing(v).format(fmt);

export const beijingValueOf = (v: string) => toBeijing(v).valueOf();
