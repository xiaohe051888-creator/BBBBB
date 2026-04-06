"""
数据采集服务 - 百家乐分析预测系统

支持多种数据源接入：
1. HTTP API 数据源（目标网站提供JSON/API接口）
2. HTML 页面解析（目标网站需提供HTML页面）
3. Lile333 浏览器采集器（Playwright路由拦截，生产模式）

核心功能：
- 轻量局号探测（每10秒一次）
- 完整数据抓取（局号变化时触发）
- 去重机制（相同局号不重复处理）
- 新靴检测（局号递减 + 双次确认）
- 网络异常重试（指数退避）
- 采集稳定性评分
"""

import asyncio
import os
import re
import json
import logging
from abc import ABC, abstractmethod
from datetime import datetime
from typing import Optional, Dict, List, Any
from dataclasses import dataclass, field

import httpx
from bs4 import BeautifulSoup

from app.core.config import settings

logger = logging.getLogger(__name__)


@dataclass
class GameData:
    """单局开奖数据"""
    game_number: int          # 局号
    result: str               # 开奖结果：庄/闲/和
    raw_data: Dict = field(default_factory=dict)  # 原始数据


@dataclass
class CrawlResult:
    """采集结果"""
    success: bool
    data: Optional[GameData] = None
    error: Optional[str] = None
    source: str = ""              # 数据来源标识
    crawl_time: float = 0.0       # 采集耗时(秒)
    is_new_boot_candidate: bool = False  # 是否为新靴候选（局号递减）


class BaseScraper(ABC):
    """采集器抽象基类"""
    
    def __init__(self, table_id: str, url: str = ""):
        self.table_id = table_id
        self.url = url
        self.client: Optional[httpx.AsyncClient] = None
        self.last_game_number: int = 0
        self.consecutive_decrease_count: int = 0   # 连续递减计数（用于新靴双确认）
        self.crawl_history: List[Dict] = []         # 采集历史（最近100条，用于稳定性评分）
        self.total_success: int = 0
        self.total_failure: int = 0
        
    async def init_client(self):
        """初始化HTTP客户端"""
        if not self.client:
            self.client = httpx.AsyncClient(
                timeout=httpx.Timeout(15.0, connect=5.0),
                headers={
                    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                    "Accept": "text/html,application/json,*/*",
                    "Accept-Language": "zh-CN,zh;q=0.9",
                },
                follow_redirects=True,
            )
    
    async def close(self):
        """关闭HTTP客户端"""
        if self.client:
            await self.client.aclose()
            self.client = None
    
    @abstractmethod
    async def detect_new_game(self) -> CrawlResult:
        """
        轻量探测新局
        返回CrawlResult，有新局时data不为None
        """
        pass
    
    @abstractmethod
    async def fetch_full_data(self) -> CrawlResult:
        """
        抓取完整数据
        当detect_new_game检测到局号变化时调用此方法获取完整信息
        """
        pass
    
    def record_crawl_result(self, result: CrawlResult):
        """记录采集结果用于稳定性评分"""
        entry = {
            "time": datetime.now().isoformat(),
            "success": result.success,
            "error": result.error,
            "duration": result.crawl_time,
        }
        self.crawl_history.append(entry)
        
        # 保持最近100条
        if len(self.crawl_history) > 100:
            self.crawl_history.pop(0)
        
        if result.success:
            self.total_success += 1
        else:
            self.total_failure += 1
    
    def get_stability_score(self) -> float:
        """
        计算采集稳定性评分 (0-100)
        
        算法：
        - 最近50次的成功率占70%权重
        - 最近10次的成功率占30%权重
        - 失败次数过多会大幅降低分数
        """
        if not self.crawl_history:
            return 100.0
        
        recent_50 = self.crawl_history[-50:] if len(self.crawl_history) >= 50 else self.crawl_history
        recent_10 = self.crawl_history[-10:] if len(self.crawl_history) >= 10 else self.crawl_history
        
        rate_50 = sum(1 for r in recent_50 if r["success"]) / len(recent_50) * 100
        rate_10 = sum(1 for r in recent_10 if r["success"]) / len(recent_10) * 100
        
        # 综合评分
        score = rate_50 * 0.7 + rate_10 * 0.3
        
        # 如果最近3次连续失败，额外扣分
        if len(recent_10) >= 3 and all(not r["success"] for r in recent_10[-3:]):
            score -= 20
        
        return max(0.0, min(100.0, score))
    
    def check_new_boot_candidate(self, new_number: int) -> bool:
        """
        检查是否为新靴候选（双确认逻辑）
        
        规则：
        - 局号递减 → 标记为候选
        - 连续两次递减 → 正式判定为新靴
        - 仅一次递减后恢复 → 采集抖动处理
        """
        if self.last_game_number > 0 and new_number < self.last_game_number:
            self.consecutive_decrease_count += 1
            
            if self.consecutive_decrease_count >= settings.NEW_BOOT_CONFIRM:
                # 双确认通过，正式判定新靴
                logger.info(f"[{self.table_id}] 新靴确认！连续{self.consecutive_decrease_count}次检测到局号递减")
                self.consecutive_decrease_count = 0
                self.last_game_number = new_number
                return True
            else:
                logger.warning(f"[{self.table_id}] 新靴候选({self.consecutive_decrease_count}/{settings.NEW_BOOT_CONFIRM}): 局号从{self.last_game_number}降到{new_number}")
                self.last_game_number = new_number
                return False
        elif new_number > self.last_game_number or (new_number == 1 and self.last_game_number > 1):
            # 局号恢复递增或重置到1，清除候选状态
            if self.consecutive_decrease_count > 0:
                if self.consecutive_decrease_count < settings.NEW_BOOT_CONFIRM:
                    logger.info(f"[{self.table_id}] 采集抖动回滚：局号恢复递增，取消新靴候选")
                self.consecutive_decrease_count = 0
            self.last_game_number = new_number
        else:
            self.last_game_number = new_number
        
        return False


class HttpApiScraper(BaseScraper):
    """
    HTTP API 数据源采集器
    
    适用于目标网站提供 REST API 或 JSON 接口的场景。
    
    配置方式：设置环境变量 TARGET_TABLE_26_URL 为API端点URL
    支持的返回格式：
    - JSON数组: [{"game_number": 1, "result": "庄"}, ...]
    - JSON对象: {"latest": {"game_number": 5, "result": "闲"}, "history": [...]}
    - 纯文本: 每行一条记录，格式 "game_number,result"
    """
    
    async def detect_new_game(self) -> CrawlResult:
        start = asyncio.get_event_loop().time()
        
        try:
            await self.init_client()
            
            if not self.url:
                return CrawlResult(
                    success=False,
                    error="未配置目标URL（请设置环境变量TARGET_TABLE_{self.table_id}_URL）",
                    source="http_api",
                    crawl_time=asyncio.get_event_loop().time() - start,
                )
            
            response = await self.client.get(self.url)
            response.raise_for_status()
            
            # 尝试解析响应
            data = self._parse_response(response.text)
            
            if data:
                duration = asyncio.get_event_loop().time() - start
                result = CrawlResult(
                    success=True,
                    data=data,
                    source="http_api",
                    crawl_time=duration,
                )
                self.record_crawl_result(result)
                
                # 检查去重：局号与上次相同时跳过
                if data.game_number == self.last_game_number and self.last_game_number > 0:
                    return CrawlResult(success=True, data=None, source="http_api", crawl_time=duration)
                
                return result
            else:
                result = CrawlResult(
                    success=False,
                    error="无法从响应中提取有效数据",
                    source="http_api",
                    crawl_time=asyncio.get_event_loop().time() - start,
                )
                self.record_crawl_result(result)
                return result
                
        except httpx.HTTPError as e:
            result = CrawlResult(
                success=False,
                error=f"HTTP请求失败: {str(e)}",
                source="http_api",
                crawl_time=asyncio.get_event_loop().time() - start,
            )
            self.record_crawl_result(result)
            return result
        except Exception as e:
            result = CrawlResult(
                success=False,
                error=f"采集异常: {str(e)}",
                source="http_api",
                crawl_time=asyncio.get_event_loop().time() - start,
            )
            self.record_crawl_result(result)
            return result
    
    async def fetch_full_data(self) -> CrawlResult:
        # HTTP API模式下，detect_new_game已经获取完整数据
        return await self.detect_new_game()
    
    def _parse_response(self, text: str) -> Optional[GameData]:
        """解析API响应，提取最新一局数据"""
        text = text.strip()
        
        # 尝试JSON解析
        try:
            parsed = json.loads(text)
            
            if isinstance(parsed, list) and len(parsed) > 0:
                latest = parsed[-1]
                return self._extract_from_dict(latest)
            elif isinstance(parsed, dict):
                # 检查是否有latest字段
                if "latest" in parsed:
                    return self._extract_from_dict(parsed["latest"])
                elif "data" in parsed and isinstance(parsed["data"], list):
                    return self._extract_from_dict(parsed["data"][-1])
                else:
                    return self._extract_from_dict(parsed)
        except (json.JSONDecodeError, TypeError):
            pass
        
        # 尝试纯文本格式（每行 game_number,result）
        lines = text.strip().split("\n")
        for line in reversed(lines):
            line = line.strip()
            if "," in line:
                parts = line.split(",")
                if len(parts) >= 2:
                    try:
                        gn = int(parts[0].strip())
                        res = parts[1].strip()
                        if res in ("庄", "闲", "和"):
                            return GameData(game_number=gn, result=res, raw_data={"raw_line": line})
                    except ValueError:
                        continue
        
        # 尝试HTML解析（作为fallback）
        return self._try_parse_html(text)
    
    def _extract_from_dict(self, d: dict) -> Optional[GameData]:
        """从字典中提取游戏数据"""
        # 支持多种字段名映射
        number_keys = ["game_number", "game_no", "round", "round_number", "no", "id"]
        result_keys = ["result", "outcome", "winner", "banker_player", "bp", "res"]
        
        gn = None
        for key in number_keys:
            if key in d:
                try:
                    gn = int(d[key])
                    break
                except (ValueError, TypeError):
                    continue
        
        res = None
        for key in result_keys:
            if key in d:
                val = str(d[key]).strip()
                if val in ("庄", "闲", "和") or val.lower() in ("banker", "player", "tie", "b", "p", "t"):
                    # 映射英文值
                    mapping = {"banker": "庄", "player": "闲", "tie": "和", "b": "庄", "p": "闲", "t": "和"}
                    res = mapping.get(val.lower(), val)
                    break
        
        if gn and res:
            return GameData(game_number=gn, result=res, raw_data=d)
        
        return None
    
    def _try_parse_html(self, text: str) -> Optional[GameData]:
        """尝试从HTML中提取数据"""
        try:
            soup = BeautifulSoup(text, "html.parser")
            
            # 查找表格
            tables = soup.find_all("table")
            for table in tables:
                rows = table.find_all("tr")
                if len(rows) > 1:
                    # 取最后一行（最新的）
                    last_row = rows[-1]
                    cells = last_row.find_all(["td", "th"])
                    if len(cells) >= 2:
                        try:
                            gn = int(cells[0].get_text(strip=True))
                            res = cells[1].get_text(strip=True)
                            if res in ("庄", "闲", "和"):
                                return GameData(game_number=gn, result=res, raw_data={"source": "html_table"})
                        except ValueError:
                            continue
        except Exception as e:
            logger.debug(f"HTML解析失败: {e}")
        
        return None


class HtmlScraper(BaseScraper):
    """
    HTML 页面解析采集器
    
    适用于需要从网页HTML中抓取数据的场景。
    通过 CSS 选择器 或正则表达式 定位数据。
    
    使用前需要在 config 中配置选择器规则。
    """
    
    def __init__(self, table_id: str, url: str, selector_config: Dict = None):
        super().__init__(table_id, url)
        self.selector_config = selector_config or {
            # 默认选择器配置（需要根据实际网站调整）
            "game_number_selector": ".game-number, .round-no, tr:last-child td:first-child",
            "result_selector": ".game-result, .outcome, tr:last-child td:nth-child(2)",
            "history_container": ".history-table, table#results",
        }
    
    async def detect_new_game(self) -> CrawlResult:
        start = asyncio.get_event_loop().time()
        
        try:
            await self.init_client()
            
            if not self.url:
                return CrawlResult(
                    success=False, error="未配置目标URL",
                    source="html_scraper",
                    crawl_time=asyncio.get_event_loop().time() - start,
                )
            
            response = await self.client.get(self.url)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.text, "html.parser")
            data = self._extract_from_soup(soup)
            
            if data:
                duration = asyncio.get_event_loop().time() - start
                result = CrawlResult(success=True, data=data, source="html_scraper", crawl_time=duration)
                self.record_crawl_result(result)
                return result
            else:
                result = CrawlResult(
                    success=False, error="无法从HTML中提取有效数据",
                    source="html_scraper",
                    crawl_time=asyncio.get_event_loop().time() - start,
                )
                self.record_crawl_result(result)
                return result
                
        except Exception as e:
            result = CrawlResult(
                success=False, error=f"HTML采集失败: {str(e)}",
                source="html_scraper",
                crawl_time=asyncio.get_event_loop().time() - start,
            )
            self.record_crawl_result(result)
            return result
    
    async def fetch_full_data(self) -> CrawlResult:
        return await self.detect_new_game()
    
    def _extract_from_soup(self, soup) -> Optional[GameData]:
        """使用CSS选择器从BeautifulSoup对象中提取数据"""
        config = self.selector_config
        
        # 尝试多种选择器
        gn_selectors = str(config.get("game_number_selector", "")).split(", ")
        res_selectors = str(config.get("result_selector", "")).split(", ")
        
        for gn_sel in gn_selectors:
            el = soup.select_one(gn_sel.strip())
            if el:
                try:
                    gn = int(el.get_text(strip=True))
                    
                    for res_sel in res_selectors:
                        res_el = soup.select_one(res_sel.strip())
                        if res_el:
                            res = res_el.get_text(strip=True)
                            if res in ("庄", "闲", "和"):
                                return GameData(game_number=gn, result=res, raw_data={"selector": f"{gn_sel}+{res_sel}"})
                except ValueError:
                    continue
        
        return None


# ============ 采集管理器 ============

class ScraperManager:
    """
    采集管理器 - 统一管理所有桌子的采集器
    
    职责：
    - 根据桌号创建合适的采集器
    - 管理采集器生命周期
    - 提供统一的采集接口给工作流引擎使用
    """
    
    _scrapers: Dict[str, BaseScraper] = {}
    
    @classmethod
    def get_scraper(cls, table_id: str) -> BaseScraper:
        """获取指定桌子的采集器"""
        if table_id in cls._scrapers:
            return cls._scrapers[table_id]
        
        # 检查是否为 Lile333 网站（rd.lile333.com）
        url_26 = os.getenv("TARGET_TABLE_26_URL", "")
        url_27 = os.getenv("TARGET_TABLE_27_URL", "")
        
        lile333_url = f"https://rd.lile333.com/?d={table_id}"
        if (url_26 and 'lile333' in url_26) or (url_27 and 'lile333' in url_27) or lile333_url:
            # 使用 Lile333 专用浏览器采集器
            try:
                from .lile333_scraper import Lile333Scraper
                desk_id = int(table_id)
                logger.info(f"[{table_id}] 使用Lile333浏览器采集器 (desk_id={desk_id})")
                scraper = Lile333Scraper(table_id=table_id, desk_id=desk_id)
            except ImportError as e:
                logger.error(f"[{table_id}] Lile333采集器不可用({e})，请检查依赖配置")
                raise RuntimeError(f"采集器初始化失败: {e}")
            except Exception as e:
                logger.error(f"[{table_id}] Lile333采集器初始化失败({e})")
                raise RuntimeError(f"采集器初始化失败: {e}")
        else:
            scraper = cls._create_default_scraper(table_id)
        
        cls._scrapers[table_id] = scraper
        return scraper
    
    @classmethod
    def _create_default_scraper(cls, table_id: str) -> BaseScraper:
        """根据URL配置创建默认采集器"""
        url_key = f"TARGET_TABLE_{table_id}_URL"
        url = os.getenv(url_key, "")
        
        if url:
            if url.endswith(".json") or "/api/" in url:
                scraper = HttpApiScraper(table_id, url)
            else:
                scraper = HtmlScraper(table_id, url)
        else:
            raise RuntimeError(f"[{table_id}] 未配置数据源URL（请设置环境变量TARGET_TABLE_{table_id}_URL）")
        
        return scraper
    
    @classmethod
    async def close_scraper(cls, table_id: str):
        """关闭指定桌子的采集器"""
        if table_id in cls._scrapers:
            await cls._scrapers[table_id].close()
            del cls._scrapers[table_id]
    
    @classmethod
    async def close_all(cls):
        """关闭所有采集器"""
        for table_id in list(cls._scrapers.keys()):
            await cls.close_scraper(table_id)
    
    @classmethod
    def get_status(cls) -> Dict[str, Any]:
        """获取所有采集器状态"""
        status = {}
        for tid, scraper in cls._scrapers.items():
            status[tid] = {
                "type": type(scraper).__name__,
                "url": getattr(scraper, 'url', 'N/A'),
                "last_game_number": scraper.last_game_number,
                "stability_score": scraper.get_stability_score(),
                "total_calls": scraper.total_success + scraper.total_failure,
                "success_rate": (
                    scraper.total_success / (scraper.total_success + scraper.total_failure) * 100
                    if (scraper.total_success + scraper.total_failure) > 0
                    else 100.0
                ),
            }
        return status
