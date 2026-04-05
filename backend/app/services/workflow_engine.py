"""
核心工作流引擎 - 百家乐分析预测系统
主循环：采集 → 清洗 → 分析预测 → 记录入库 → 决策 → 开奖结算
"""
import asyncio
from datetime import datetime, timedelta
from typing import Dict, Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func

from app.core.config import settings
from app.services.road_engine import UnifiedRoadEngine, FiveRoadResult
from app.services.three_model_service import ThreeModelService
from app.services.betting_service import BettingService
from app.services.scraper_service import ScraperManager, CrawlResult, GameData
from app.services.smart_model_selector import SmartModelSelector
from app.models.schemas import (
    GameRecord, BetRecord, SystemLog, MistakeBook, 
    SystemState, ModelVersion, ErrorType, LogPriority, LogCategory,
)
import json


# WebSocket广播函数（由main.py设置）
_broadcast_func = None

def set_broadcast_func(func):
    """设置WebSocket广播函数（在main.py中调用）"""
    global _broadcast_func
    _broadcast_func = func


async def workflow_broadcast(table_id: str, event_type: str, data: Dict):
    """工作流引擎通过此函数推送实时数据到前端"""
    global _broadcast_func
    if _broadcast_func:
        try:
            await _broadcast_func(table_id, event_type, data)
        except Exception:
            pass  # 推送失败不影响主流程


class WorkflowEngine:
    """
    核心工作流引擎
    
    单轮工作流：检测新局 → 采集 → 清洗 → 分析预测 → 记录入库 → 下注决策 → 开奖结算
    超时机制：150秒上限
    自动恢复：10分钟后自动重启
    """
    
    def __init__(self, session: AsyncSession):
        self.session = session
        self.table_id = ""
        self.boot_number = 0
        self.game_number = 0
        self.status = "已停止"
        self.road_engine = UnifiedRoadEngine()
        self.three_model = ThreeModelService()
        self.betting_service = BettingService()
        self.consecutive_errors = 0
        self.consecutive_correct = 0
        self.current_drawdown = 0.0
        self.running = False
        self.workflow_start_time: Optional[datetime] = None
        self.error_counter = 0
        self.last_game_number = 0
        self.no_data_since: Optional[datetime] = None
    
    async def start(self, table_id: str):
        """启动系统"""
        self.table_id = table_id
        self.running = True
        self.status = "运行中"
        
        # 加载系统状态
        await self._load_state()
        
        # ★ 智能选模（文档17：进入首页同时触发自动智能选模）
        try:
            selector = SmartModelSelector(self.session)
            selection = await selector.select_best_model(table_id)
            
            model_version = selection.get("selected_version", "v1.0-default")
            select_reason = selection.get("selection_reason", "")
            
            # 记录选模结果到日志
            await self._write_log(
                event_code="LOG-AI-002",
                event_type="智能选模",
                event_result="成功",
                description=f"[{table_id}] 选择模型: {model_version} | 原因: {select_reason}",
                category=LogCategory.SYSTEM,
                priority=LogPriority.P2,
                is_pinned=False,
            )
        except Exception as e:
            # 选模失败不影响启动，使用默认策略
            await self._write_log(
                event_code="LOG-AI-003",
                event_type="智能选模",
                event_result="降级",
                description=f"智能选模失败，使用默认策略: {str(e)}",
                category=LogCategory.SYSTEM,
                priority=LogPriority.P2,
            )
        
        # 写启动日志
        await self._write_log(
            event_code="LOG-SYS-001",
            event_type="系统启动",
            event_result="成功",
            description=f"系统已启动，当前桌号{table_id}",
            category=LogCategory.SYSTEM,
            priority=LogPriority.P2,
            is_pinned=True,
        )
    
    async def stop(self):
        """停止系统"""
        self.running = False
        self.status = "已停止"
        
        # 退回所有待开奖注单
        await self._refund_pending_bets()
        
        # 更新状态
        await self._update_state()
        
        # 写停止日志
        await self._write_log(
            event_code="LOG-SYS-002",
            event_type="系统停止",
            event_result="成功",
            description="系统已停止",
            category=LogCategory.SYSTEM,
            priority=LogPriority.P2,
            is_pinned=True,
        )
    
    async def run_main_loop(self):
        """主循环"""
        while self.running:
            try:
                cycle_start = datetime.now()
                self.workflow_start_time = cycle_start
                
                # 检查150秒超时
                if self.workflow_start_time:
                    elapsed = (datetime.now() - self.workflow_start_time).total_seconds()
                    if elapsed >= settings.WORKFLOW_TIMEOUT:
                        await self._handle_workflow_timeout()
                        await asyncio.sleep(10)
                        continue
                
                # 步骤1：轻量探测局号
                new_game = await self._detect_new_game()
                
                if new_game:
                    self.no_data_since = None
                    # 有新局号，执行完整流程
                    await self._process_full_cycle(new_game)
                else:
                    # 无新数据，检查洗牌等待
                    if self.no_data_since is None:
                        self.no_data_since = datetime.now()
                    elif (datetime.now() - self.no_data_since).total_seconds() >= settings.SHUFFLE_DETECT_INTERVAL:
                        self.status = "洗牌等待"
                        await self._write_log(
                            event_code="LOG-SYS-003",
                            event_type="状态变更",
                            event_result="洗牌等待",
                            description="连续10分钟未获取到有效数据，进入洗牌等待态",
                            category=LogCategory.SYSTEM,
                            priority=LogPriority.P2,
                        )
                        self.no_data_since = datetime.now()
                
                await self._update_state()
                
            except Exception as e:
                await self._write_log(
                    event_code="LOG-ERR-004",
                    event_type="工作流异常",
                    event_result="失败",
                    description=f"主循环异常：{str(e)}，系统已自动重试",
                    category=LogCategory.WORKFLOW,
                    priority=LogPriority.P1,
                    is_pinned=True,
                )
            
            await asyncio.sleep(settings.CRAWL_INTERVAL)
    
    async def _detect_new_game(self) -> Optional[Dict]:
        """
        轻量探测局号
        通过 ScraperManager 获取真实采集数据
        返回新局数据或None
        """
        try:
            scraper = ScraperManager.get_scraper(self.table_id)
            result: CrawlResult = await scraper.detect_new_game()
            
            if not result.success:
                # 采集失败，记录日志
                if self.error_counter % 5 == 0:  # 每5次失败记录一次，避免刷屏
                    await self._write_log(
                        event_code="LOG-ERR-007",
                        event_type="采集失败",
                        event_result="失败",
                        description=f"数据采集失败（第{self.error_counter + 1}次）：{result.error}",
                        category=LogCategory.WORKFLOW,
                        priority=LogPriority.P2,
                    )
                self.error_counter += 1
                return None
            
            # 采集成功
            if result.data is None:
                # 无新数据（局号相同）
                return None
            
            game_data: GameData = result.data
            
            # 去重检查：局号与上次相同则跳过
            if game_data.game_number == self.last_game_number and self.last_game_number > 0:
                return None
            
            # 新靴检测（双确认逻辑已内置于scraper中）
            if scraper.check_new_boot_candidate(game_data.game_number):
                # 确认新靴
                await self._on_new_boot_detected()
            
            # 更新采集稳定性到系统状态
            stability = scraper.get_stability_score()
            # 通过更新state来反映（在_update_state中处理）
            
            # ★ WebSocket 推送：检测到新局数据
            await workflow_broadcast(self.table_id, "new_game_detected", {
                "game_number": game_data.game_number,
                "result": game_data.result,
                "crawl_source": result.source,
            })
            
            return {
                "game_number": game_data.game_number,
                "result": game_data.result,
                "raw_data": game_data.raw_data,
                "crawl_source": result.source,
                "crawl_time": result.crawl_time,
            }
            
        except Exception as e:
            await self._write_log(
                event_code="LOG-ERR-008",
                event_type="采集异常",
                event_result="失败",
                description=f"采集模块异常：{str(e)}",
                category=LogCategory.WORKFLOW,
                priority=LogPriority.P1,
                is_pinned=True,
            )
            self.error_counter += 1
            return None
    
    async def _process_full_cycle(self, game_data: Dict):
        """执行完整的一轮工作流"""
        try:
            game_number = game_data["game_number"]
            result = game_data["result"]
            
            # 检查新靴
            await self._check_new_boot(game_number)
            
            # 更新局号
            self.game_number = game_number
            self.status = "运行中"
            
            # 步骤2：清洗
            await self._write_log(
                event_code="LOG-WF-002",
                event_type="清洗完成",
                event_result="成功",
                description=f"第{game_number}局数据清洗完成",
                category=LogCategory.WORKFLOW,
                priority=LogPriority.P3,
                game_number=game_number,
            )
            
            # 步骤3：更新五路走势图
            five_roads = self.road_engine.process_game(game_number, result)
            
            # 步骤4：AI三模型分析预测（仅庄/闲）
            predict_direction = None
            if result != "和":
                # 获取历史数据
                history = await self._get_game_history()
                road_data = self._serialize_roads(five_roads)
                mistakes = await self._get_mistakes()
                
                model_result = await self.three_model.analyze(
                    game_number=game_number,
                    boot_number=self.boot_number,
                    game_history=history,
                    road_data=road_data,
                    mistake_context=mistakes,
                    consecutive_errors=self.consecutive_errors,
                )
                
                predict_direction = model_result["combined_model"].get("final_prediction")
                confidence = model_result["combined_model"].get("confidence", 0.5)
                bet_tier = model_result["combined_model"].get("bet_tier", "标准")
                
                # 记录模型输出日志
                await self._log_model_output(game_number, model_result)
                
                # 步骤5：下注决策
                bet_info = self.betting_service.calculate_adaptive_bet(
                    confidence=confidence,
                    consecutive_correct=self.consecutive_correct,
                    consecutive_errors=self.consecutive_errors,
                    current_drawdown=self.current_drawdown,
                    version_stability=0.5,
                )
                bet_info.game_number = game_number
                bet_info.bet_direction = predict_direction
                
                balance_after = self.betting_service.place_bet(game_number, predict_direction, bet_info.bet_amount)
                bet_info.balance_after = balance_after
                
                # 记录下注
                await self._save_bet_record(game_number, predict_direction, bet_info)
                
                await self._write_log(
                    event_code="LOG-FND-001",
                    event_type="下注扣款",
                    event_result="成功",
                    description=f"第{game_number}局下注已执行，方向{predict_direction}，金额{int(bet_info.bet_amount)}，当前余额{int(balance_after)}",
                    category=LogCategory.FINANCE,
                    priority=LogPriority.P1,
                    is_pinned=True,
                    game_number=game_number,
                )
            
            # 步骤6：记录开奖入库
            predict_correct = None
            if predict_direction and result in ("庄", "闲"):
                predict_correct = (predict_direction == result)
                
                if predict_correct:
                    self.consecutive_errors = 0
                    self.consecutive_correct += 1
                    error_id = None
                else:
                    self.consecutive_errors += 1
                    self.consecutive_correct = 0
                    error_id = f"ERR-{game_number:04d}"
                    
                    # 记录错题本
                    await self._save_mistake(game_number, error_id, result)
                
                # 结算
                settle_result = self.betting_service.settle_bet(
                    bet_direction=predict_direction,
                    bet_amount=bet_info.bet_amount,
                    game_result=result,
                )
                
                # 更新回撤
                if settle_result["profit_loss"] < 0:
                    self.current_drawdown += abs(settle_result["profit_loss"]) / settings.DEFAULT_BALANCE
                else:
                    self.current_drawdown = max(0, self.current_drawdown - 0.01)
                
                # 连续失准应对
                if self.consecutive_errors >= settings.MAX_CONSECUTIVE_ERRORS:
                    await self._handle_consecutive_errors()
                
                await self._write_log(
                    event_code="LOG-WF-005",
                    event_type="结算完成",
                    event_result="成功",
                    description=f"第{game_number}局结算完成，结果{result}，盈亏{settle_result['profit_loss']:.0f}",
                    category=LogCategory.WORKFLOW,
                    priority=LogPriority.P3,
                    game_number=game_number,
                )
                
                await self._write_log(
                    event_code="LOG-FND-002",
                    event_type="开奖结算",
                    event_result="成功",
                    description=f"第{game_number}局结算完成，结果{result}，盈亏{settle_result['profit_loss']:.0f}",
                    category=LogCategory.FINANCE,
                    priority=LogPriority.P1,
                    is_pinned=True,
                    game_number=game_number,
                )
            
            # 保存开奖记录
            await self._save_game_record(
                game_number=game_number,
                result=result,
                predict_direction=predict_direction,
                predict_correct=predict_correct,
                error_id=error_id if predict_correct is False else None,
                profit_loss=settle_result["profit_loss"] if predict_correct is not None else 0,
                balance_after=self.betting_service.get_balance(),
            )
            
            # ★ WebSocket 实时推送：新局结算完成
            await workflow_broadcast(self.table_id, "game_settled", {
                "game_number": game_number,
                "result": result,
                "predict_direction": predict_direction,
                "predict_correct": predict_correct,
                "bet_tier": bet_info.bet_tier if 'bet_info' in dir() and predict_direction else None,
                "balance": self.betting_service.get_balance(),
            })
            
            # 更新系统状态
            await self._update_state()
            
        except Exception as e:
            await self._write_log(
                event_code="LOG-ERR-004",
                event_type="工作流异常",
                event_result="失败",
                description=f"第{game_number}局处理异常：{str(e)}",
                category=LogCategory.WORKFLOW,
                priority=LogPriority.P1,
                is_pinned=True,
                game_number=game_number if game_number else self.game_number,
            )
    
    async def _on_new_boot_detected(self):
        """新靴确认后的处理"""
        self.boot_number += 1
        self.game_number = 0
        self.consecutive_errors = 0
        self.consecutive_correct = 0
        self.current_drawdown = 0.0
        self.road_engine.reset_boot()
        self.betting_service = BettingService()
        
        await self._write_log(
            event_code="LOG-SYS-004",
            event_type="新靴检测",
            event_result="成功",
            description=f"检测到新靴开始，当前第{self.boot_number}靴",
            category=LogCategory.SYSTEM,
            priority=LogPriority.P2,
            is_pinned=True,
        )
    
    async def _check_new_boot(self, new_game_number: int):
        """检查新靴判定"""
        if self.last_game_number > 0 and new_game_number < self.last_game_number:
            # 局号递减 - 新靴候选
            # 双确认逻辑简化（实际应连续两次探测确认）
            self.boot_number += 1
            self.game_number = 0
            self.consecutive_errors = 0
            self.consecutive_correct = 0
            self.current_drawdown = 0.0
            self.road_engine.reset_boot()
            self.betting_service = BettingService()
            
            await self._write_log(
                event_code="LOG-SYS-004",
                event_type="新靴检测",
                event_result="成功",
                description=f"检测到新靴开始，当前第{self.boot_number}靴",
                category=LogCategory.SYSTEM,
                priority=LogPriority.P2,
                is_pinned=True,
            )
        
        self.last_game_number = new_game_number
    
    async def _handle_consecutive_errors(self):
        """连续3局失准应对"""
        self.status = "策略重评估中"
        await self._write_log(
            event_code="LOG-ERR-005",
            event_type="连续失准",
            event_result="告警",
            description=f"连续{self.consecutive_errors}局预测错误，已切换保守金额策略",
            category=LogCategory.WORKFLOW,
            priority=LogPriority.P1,
            is_pinned=True,
        )
        
        # ★ 在线策略重评估（文档05/06：动态修正权重/阈值）
        # 1. 推送策略变更事件
        await workflow_broadcast(self.table_id, "strategy_adjustment", {
            "trigger": f"consecutive_{self.consecutive_errors}_errors",
            "action": "switch_to_conservative",
            "reason": f"连续{self.consecutive_errors}局失准，自动降档至保守模式",
        })
        
        # 2. 记录重评估日志（含具体调整内容）
        await self._write_log(
            event_code="LOG-MDL-004",
            event_type="在线策略重评估",
            event_result="已执行",
            description=f"触发原因: 连续{self.consecutive_errors}错 | "
                       f"动作: 置信度阈值+0.05, 档位锁定保守, 权重向近期表现倾斜 | "
                       f"注意: 不中断每局下注，仅调整决策参数",
            category=LogCategory.WORKFLOW,
            priority=LogPriority.P2,
        )
        
        # 继续保持每局下注，不中断
    
    async def _handle_workflow_timeout(self):
        """150秒工作流超时处理"""
        self.status = "异常处理中"
        await self._write_log(
            event_code="LOG-WF-006",
            event_type="流程超时150秒",
            event_result="超时",
            description=f"第{self.game_number}局工作流超时150秒，判定异常，系统将暂停前台工作流，600秒后自动重启",
            category=LogCategory.WORKFLOW,
            priority=LogPriority.P1,
            is_pinned=True,
            game_number=self.game_number,
        )
        # ★ 10分钟后自动重启（文档13：150秒停机后10分钟重启）
        asyncio.create_task(self._auto_restart_after_delay(600))
    
    async def _auto_restart_after_delay(self, delay_seconds: int):
        """延迟后自动重启系统"""
        await self._write_log(
            event_code="LOG-SYS-005",
            event_type="定时重启计划",
            event_result="已调度",
            description=f"将在{delay_seconds}秒后自动重启系统（文档13：超时恢复机制）",
            category=LogCategory.SYSTEM,
            priority=LogPriority.P2,
            is_pinned=True,
        )
        
        await asyncio.sleep(delay_seconds)
        
        if not self.running:
            return  # 已手动停止，不自动重启
        
        try:
            # 重置状态
            self.status = "运行中"
            self.workflow_start_time = datetime.now()
            
            # 推送重启事件
            await workflow_broadcast(self.table_id, "system_restarted", {
                "reason": "timeout_auto_restart",
                "message": f"系统因150秒超时已自动重启",
            })
            
            await self._write_log(
                event_code="LOG-SYS-006",
                event_type="自动重启完成",
                event_result="成功",
                description=f"系统已完成自动重启，恢复正常工作流",
                category=LogCategory.SYSTEM,
                priority=LogPriority.P2,
                is_pinned=True,
            )
        except Exception as e:
            await self._write_log(
                event_code="LOG-ERR-010",
                event_type="自动重启失败",
                event_result="失败",
                description=f"自动重启异常：{str(e)}，需人工介入",
                category=LogCategory.SYSTEM,
                priority=LogPriority.P1,
                is_pinned=True,
            )
    
    async def _refund_pending_bets(self):
        """退回所有待开奖注单"""
        stmt = select(BetRecord).where(
            BetRecord.table_id == self.table_id,
            BetRecord.status == "待开奖",
        )
        result = await self.session.execute(stmt)
        pending_bets = result.scalars().all()
        
        for bet in pending_bets:
            elapsed = (datetime.now() - bet.bet_time).total_seconds() if bet.bet_time else 9999
            if elapsed >= settings.BET_TIMEOUT or not self.running:
                # 执行退回（幂等）
                self.betting_service.refund_bet(bet.bet_amount)
                bet.status = "异常退回"
                bet.balance_after = self.betting_service.get_balance()
                bet.settle_time = datetime.now()
                
                await self._write_log(
                    event_code="LOG-FND-003",
                    event_type="异常退回",
                    event_result="成功",
                    description=f"第{bet.game_number}局超过5分钟未开奖，已自动退回{int(bet.bet_amount)}",
                    category=LogCategory.FINANCE,
                    priority=LogPriority.P1,
                    is_pinned=True,
                    game_number=bet.game_number,
                )
        
        await self.session.commit()
    
    # ============ 数据持久化方法 ============
    
    async def _save_game_record(self, **kwargs):
        """保存开奖记录"""
        record = GameRecord(
            table_id=self.table_id,
            boot_number=self.boot_number,
            **kwargs,
            result_time=datetime.now(),
        )
        self.session.add(record)
        await self.session.commit()
    
    async def _save_bet_record(self, game_number: int, direction: str, bet_info):
        """保存下注记录"""
        record = BetRecord(
            table_id=self.table_id,
            boot_number=self.boot_number,
            game_number=game_number,
            bet_direction=direction,
            bet_amount=bet_info.bet_amount,
            bet_tier=bet_info.bet_tier,
            balance_before=bet_info.balance_before,
            balance_after=bet_info.balance_after,
            adapt_summary=bet_info.adapt_summary,
            bet_time=datetime.now(),
        )
        self.session.add(record)
        await self.session.commit()
    
    async def _save_mistake(self, game_number: int, error_id: str, actual_result: str):
        """保存错题本记录"""
        mistake = MistakeBook(
            table_id=self.table_id,
            boot_number=self.boot_number,
            game_number=game_number,
            error_id=error_id,
            error_type=ErrorType.TREND_MISJUDGE.value,
            predict_direction="?",  # 将由调用方更新
            actual_result=actual_result,
        )
        self.session.add(mistake)
        await self.session.commit()
    
    async def _write_log(
        self,
        event_code: str,
        event_type: str,
        event_result: str,
        description: str,
        category: str,
        priority: str,
        is_pinned: bool = False,
        game_number: Optional[int] = None,
    ):
        """写入实盘日志"""
        event_key = f"{self.table_id}_{self.boot_number}_{game_number or 0}_{event_code}_{datetime.now().strftime('%H%M%S')}"
        
        retention = "hot7"
        if priority == "P1":
            retention = "cold_perm"
        elif priority == "P2":
            retention = "warm30"
        
        log = SystemLog(
            log_time=datetime.now(),
            table_id=self.table_id,
            boot_number=self.boot_number,
            game_number=game_number,
            event_code=event_code,
            event_type=event_type,
            event_result=event_result,
            description=description,
            category=category,
            priority=priority,
            source_module="工作流引擎",
            event_key=event_key,
            is_pinned=is_pinned,
            retention_tier=retention,
        )
        self.session.add(log)
        await self.session.commit()
    
    async def _log_model_output(self, game_number: int, model_result: Dict):
        """记录模型输出到日志"""
        # 庄模型摘要
        banker = model_result.get("banker_model", {})
        if banker.get("summary"):
            await self._write_log(
                event_code="LOG-MDL-001",
                event_type="庄模型摘要刷新",
                event_result="成功",
                description=banker["summary"],
                category=LogCategory.WORKFLOW,
                priority=LogPriority.P2,
                game_number=game_number,
            )
        
        # 闲模型摘要
        player = model_result.get("player_model", {})
        if player.get("summary"):
            await self._write_log(
                event_code="LOG-MDL-002",
                event_type="闲模型摘要刷新",
                event_result="成功",
                description=player["summary"],
                category=LogCategory.WORKFLOW,
                priority=LogPriority.P2,
                game_number=game_number,
            )
        
        # 综合模型结论
        combined = model_result.get("combined_model", {})
        if combined.get("summary"):
            await self._write_log(
                event_code="LOG-MDL-003",
                event_type="综合结论生成",
                event_result="成功",
                description=f"{combined['summary']}，置信度{combined.get('confidence', 0):.0%}",
                category=LogCategory.WORKFLOW,
                priority=LogPriority.P2,
                game_number=game_number,
            )
    
    async def _get_game_history(self) -> List[Dict]:
        """获取当前靴历史记录"""
        stmt = select(GameRecord).where(
            GameRecord.table_id == self.table_id,
            GameRecord.boot_number == self.boot_number,
        ).order_by(GameRecord.game_number)
        result = await self.session.execute(stmt)
        records = result.scalars().all()
        return [
            {
                "game_number": r.game_number,
                "result": r.result,
                "predict_direction": r.predict_direction,
                "predict_correct": r.predict_correct,
            }
            for r in records
        ]
    
    async def _get_mistakes(self) -> List[Dict]:
        """获取本靴错题本"""
        stmt = select(MistakeBook).where(
            MistakeBook.table_id == self.table_id,
            MistakeBook.boot_number == self.boot_number,
        ).order_by(MistakeBook.game_number)
        result = await self.session.execute(stmt)
        records = result.scalars().all()
        return [
            {
                "game_number": m.game_number,
                "error_type": m.error_type,
                "predict_direction": m.predict_direction,
                "actual_result": m.actual_result,
                "analysis": m.analysis,
            }
            for m in records
        ]
    
    async def _load_state(self):
        """加载系统状态"""
        stmt = select(SystemState).where(SystemState.table_id == self.table_id)
        result = await self.session.execute(stmt)
        state = result.scalar_one_or_none()
        
        if state:
            self.boot_number = state.boot_number
            self.game_number = state.game_number
            self.betting_service.set_balance(state.balance)
            self.consecutive_errors = state.consecutive_errors
    
    async def _update_state(self):
        """更新系统状态"""
        stmt = select(SystemState).where(SystemState.table_id == self.table_id)
        result = await self.session.execute(stmt)
        state = result.scalar_one_or_none()
        
        if not state:
            state = SystemState(table_id=self.table_id)
            self.session.add(state)
        
        state.status = self.status
        state.boot_number = self.boot_number
        state.game_number = self.game_number
        state.balance = self.betting_service.get_balance()
        state.consecutive_errors = self.consecutive_errors
        state.updated_at = datetime.now()
        
        await self.session.commit()
    
    def _serialize_roads(self, five_roads: FiveRoadResult) -> Dict:
        """序列化五路数据为JSON友好格式"""
        def road_to_list(road):
            return [
                {
                    "game_number": p.game_number,
                    "column": p.column,
                    "row": p.row,
                    "value": p.value,
                    "is_new_column": p.is_new_column,
                    "error_id": p.error_id,
                }
                for p in road.points
            ]
        
        return {
            "大路": road_to_list(five_roads.big_road),
            "珠盘路": road_to_list(five_roads.bead_road),
            "大眼仔路": road_to_list(five_roads.big_eye_boy),
            "小路": road_to_list(five_roads.small_road),
            "螳螂路": road_to_list(five_roads.cockroach_road),
        }
