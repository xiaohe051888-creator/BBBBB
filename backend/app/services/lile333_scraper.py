"""
Lile333 网站专用浏览器采集器（V3 - 已验证可用）

目标网站: rd.lile333.com/?d={desk_id}（26桌/27桌）
反爬机制: Cloudflare Turnstile 人机验证
数据获取: Playwright response 拦截 /api/deskRoad

已验证方案 (2026-04-05):
  ✅ 有头浏览器(headless=False) 可自动通过 Cloudflare
  ✅ page.on('response') 成功拦截 API 数据
  ✅ 页面内 JS fetch() 会被 403（不可用）
  ✅ 必须在页面导航时自动触发API调用 + 拦截响应
  ⚠️  无头模式(headless=True) 可能被CF拦截（需实测）

game_result 格式: "result[,...extras]|pair|points|flag"
  例: "banker|1|9|1" → 庄赢,有对子,点数9
      "player,b_pair|1|8|0" → 闲赢+庄对,点数8
      "banker,six|1|6|1" → 庄赢+幸运六,点数6
"""

import asyncio
import json
import logging
import time
import os
from typing import Optional, Dict, List
from dataclasses import dataclass

_playwright = None


async def _get_pw():
    global _playwright
    if _playwright is None:
        from playwright.async_api import async_playwright
        _playwright = async_playwright
    return _playwright()


from .scraper_service import BaseScraper, GameData, CrawlResult

logger = logging.getLogger(__name__)

RESULT_MAP = {"banker": "庄", "player": "闲", "tie": "和"}


@dataclass
class Lile333GameData(GameData):
    """Lile333扩展游戏数据"""
    has_banker_pair: bool = False
    has_player_pair: bool = False
    points: int = 0
    is_dragon7: bool = False
    is_six: bool = False
    is_bear8: bool = False


class Lile333Scraper(BaseScraper):
    """
    rd.lile333.com 浏览器采集器
    
    策略: 每次需要数据时启动新浏览器→导航→拦截响应→关闭浏览器
    优点: 最可靠，不受状态污染影响
    缺点: 每次约5-10秒（包含CF验证时间）
    
    对于生产环境可优化为: 长驻浏览器 + 定期刷新页面
    """
    
    def __init__(self, table_id: str, desk_id: int):
        super().__init__(table_id, f"https://rd.lile333.com/?d={desk_id}")
        self.desk_id = desk_id
        self.headless = os.getenv("LILE333_HEADLESS", "false").lower() == "true"
        self._cached_count: int = 0
        self._last_results: List[str] = []
    
    async def _fetch_via_browser(self) -> Optional[Dict]:
        """
        核心方法: 通过Playwright浏览器获取最新数据
        
        流程:
        1. 启动 Chromium
        2. 创建带反检测的 context
        3. 注册 response 监听器
        4. 导航到目标URL
        5. 等待 CF 验证 + API 响应
        6. 返回解析后的数据
        7. 关闭浏览器
        """
        pw = await _get_pw()
        browser = None
        
        try:
            pw_obj = await pw.start()
            
            # 启动浏览器
            browser = await pw_obj.chromium.launch(
                headless=self.headless,
                args=[
                    '--disable-blink-features=AutomationControlled',
                    '--no-sandbox',
                    '--window-size=1280,800',
                ]
            )
            
            # 创建上下文
            ctx = await browser.new_context(
                viewport={'width': 1280, 'height': 800},
                user_agent=(
                    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) '
                    'AppleWebKit/537.36 (KHTML, like Gecko) '
                    'Chrome/120.0.0.0 Safari/537.36'
                ),
                locale='zh-CN',
            )
            
            # 反检测注入
            await ctx.add_init_script("""
                Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
                window.chrome = { runtime: {} };
            """)
            
            page = await ctx.new_page()
            
            # === 关键: 导航前注册响应监听 ===
            captured = {}
            
            async def on_response(resp):
                if '/api/deskRoad' in resp.url and 'deskRoad' not in captured:
                    try:
                        body = await resp.text()
                        if resp.status == 200:
                            parsed = json.loads(body)
                            if parsed.get('code') == 20000:
                                captured['deskRoad'] = parsed.get('data', {})
                                logger.debug(f"[Lile333/{self.desk_id}] 拦截到 {len(captured['deskRoad'].get('game_result',[]))}局")
                    except Exception as e:
                        captured['deskRoad_error'] = str(e)
                
                elif '/api/deskInfo' in resp.url and 'deskInfo' not in captured:
                    try:
                        body = await resp.text()
                        if resp.status == 200:
                            parsed = json.loads(body)
                            if parsed.get('code') == 20000:
                                captured['deskInfo'] = parsed.get('data', {})
                    except:
                        pass
            
            page.on('response', on_response)
            
            # 导航到目标页面
            url = f"https://rd.lile333.com/?d={self.desk_id}"
            logger.debug(f"[Lile333/{self.desk_id}] 正在打开: {url}")
            
            await page.goto(url, wait_until='domcontentloaded', timeout=30000)
            
            # 等待 Cloudflare 验证 + API 数据到达
            deadline = time.time() + 45  # 最多等45秒
            
            while time.time() < deadline:
                await asyncio.sleep(1.5)
                
                # 检查是否还在CF验证页
                try:
                    is_cf = await page.evaluate('''() => {
                        const t = document.body?.innerText || '';
                        return t.includes('Just a moment') || 
                               t.includes('Verify you are human') ||
                               t.includes('Performing security verification');
                    }''')
                    
                    if not is_cf and captured.get('deskRoad'):
                        # CF过了且数据也拿到了
                        break
                    
                    elif not is_cf and not captured.get('deskRoad'):
                        # CF过了但数据还没到（继续等待）
                        continue
                        
                except Exception:
                    pass
            
            # 清理资源
            try:
                await ctx.close()
            except:
                pass
            try:
                await browser.close()
            except:
                pass
            try:
                await pw_obj.stop()
            except:
                pass
            
            # 返回结果
            return captured.get('deskRoad')
            
        except Exception as e:
            logger.error(f"[Lile333/{self.desk_id}] 浏览器获取失败: {e}")
            # 尝试清理
            try:
                if browser: await browser.close()
            except:
                pass
            return None
    
    async def detect_new_game(self) -> CrawlResult:
        """探测是否有新局"""
        start = time.time()
        
        try:
            raw_data = await self._fetch_via_browser()
            
            if not raw_data or not raw_data.get('game_result'):
                return CrawlResult(
                    success=False,
                    error="未获取到有效数据",
                    source="lile333",
                    crawl_time=time.time() - start,
                )
            
            results = raw_data['game_result']
            current_count = len(results)
            
            # 检测新局
            if current_count > self._cached_count:
                latest_raw = results[-1]
                game_data = self._parse(latest_raw, current_count)
                
                result = CrawlResult(
                    success=True, data=game_data, source="lile333",
                    crawl_time=time.time() - start,
                )
                self.record_crawl_result(result)
                
                self._last_results = list(results)
                self._cached_count = current_count
                return result
            
            elif self._cached_count == 0:
                # 首次运行
                latest_raw = results[-1]
                game_data = self._parse(latest_raw, current_count)
                
                result = CrawlResult(
                    success=True, data=game_data, source="lile333",
                    crawl_time=time.time() - start,
                )
                self.record_crawl_result(result)
                
                self._last_results = list(results)
                self._cached_count = current_count
                return result
            
            else:
                # 无变化
                return CrawlResult(
                    success=True, data=None, source="lile333",
                    crawl_time=time.time() - start,
                )
                
        except Exception as e:
            result = CrawlResult(
                success=False, error=f"探测异常: {e}",
                source="lile333", crawl_time=time.time()-start,
            )
            self.record_crawl_result(result)
            return result
    
    async def fetch_full_data(self) -> CrawlResult:
        """完整抓取"""
        start = time.time()
        
        try:
            raw_data = await self._fetch_via_browser()
            
            if not raw_data or not raw_data.get('game_result'):
                return CrawlResult(success=False, error="无数据", source="lile333", crawl_time=time.time()-start)
            
            results = raw_data['game_result']
            latest_raw = results[-1]
            game_data = self._parse(latest_raw, len(results))
            game_data.raw_data['total_games'] = len(results)
            
            self._last_results = list(results)
            self._cached_count = len(results)
            
            result = CrawlResult(success=True, data=game_data, source="lile333", crawl_time=time.time()-start)
            self.record_crawl_result(result)
            return result
            
        except Exception as e:
            result = CrawlResult(success=False, error=f"完整抓取异常: {e}", source="lile333", crawl_time=time.time()-start)
            self.record_crawl_result(result)
            return result
    
    async def fetch_all_history(self) -> List[Dict]:
        """获取全部历史记录"""
        try:
            raw_data = await self._fetch_via_browser()
            if not raw_data or not raw_data.get('game_result'):
                return []
            
            history = []
            for idx, raw in enumerate(raw_data['game_result']):
                d = self._parse_to_dict(raw)
                d['game_number'] = idx + 1
                history.append(d)
            
            self._last_results = [r for r in raw_data['game_result']]
            self._cached_count = len(history)
            return history
        except Exception as e:
            logger.error(f"[Lile333/{self.table_id}] 获取历史失败: {e}")
            return []
    
    def _parse(self, raw_str: str, gn: int) -> Lile333GameData:
        """解析原始字符串为结构化数据"""
        parts = raw_str.split("|")
        if len(parts) < 3:
            return Lile333GameData(game_number=gn, result="", raw_data={"raw": raw_str})
        
        types = [t.strip() for t in parts[0].split(",")]
        main = types[0]
        
        return Lile333GameData(
            game_number=gn,
            result=RESULT_MAP.get(main, main),
            raw_data={
                "raw": raw_str, "types": types, "main_type": main,
                "pair_flag": parts[1], "points": int(parts[2]) if len(parts)>2 else 0,
                "flag": parts[3] if len(parts)>3 else "0",
            },
            has_banker_pair="b_pair" in types,
            has_player_pair="p_pair" in types,
            points=int(parts[2]) if len(parts)>2 and parts[2].isdigit() else 0,
            is_dragon7="dragon7" in types,
            is_six="six" in types,
            is_bear8="bear8" in types,
        )
    
    def _parse_to_dict(self, raw_str: str) -> Dict:
        """解析为字典格式"""
        parts = raw_str.split("|")
        if len(parts) < 3:
            return {"raw": raw_str}
        types = [t.strip() for t in parts[0].split(",")]
        main = types[0]
        return {
            "raw": raw_str, "result_en": main, "result": RESULT_MAP.get(main, ""),
            "extra_types": [t for t in types[1:]],
            "pair_flag": parts[1],
            "points": int(parts[2]) if len(parts)>2 and parts[2].isdigit() else 0,
        }
    
    async def close(self):
        pass
