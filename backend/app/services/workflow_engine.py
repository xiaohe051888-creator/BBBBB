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
from app.models.schemas import (
    GameRecord, BetRecord, SystemLog, MistakeBook, 
    SystemState, ModelVersion, ErrorType, LogPriority, LogCategory,
)
import json


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
        返回新局数据或None
        """
        # TODO: 实际爬虫逻辑 - 这里需要根据目标网站实现
        # 当前返回模拟数据用于开发
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
        # 继续保持每局下注，不中断
    
    async def _handle_workflow_timeout(self):
        """150秒工作流超时处理"""
        self.status = "异常处理中"
        await self._write_log(
            event_code="LOG-WF-006",
            event_type="流程超时150秒",
            event_result="超时",
            description=f"第{self.game_number}局工作流超时150秒，判定异常，系统已暂停前台工作流",
            category=LogCategory.WORKFLOW,
            priority=LogPriority.P1,
            is_pinned=True,
            game_number=self.game_number,
        )
        # 10分钟后自动重启（实际应在独立计时器中实现）
    
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
