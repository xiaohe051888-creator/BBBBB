"""
模拟跟注与结算服务
仿真下注验证，不向目标网站执行真实下注
"""
from typing import Dict, Optional
from datetime import datetime
from dataclasses import dataclass
from app.core.config import settings


@dataclass
class BetResult:
    """下注结果"""
    game_number: int
    bet_direction: str
    bet_amount: float
    bet_tier: str
    balance_before: float
    balance_after: float
    adapt_summary: str


class BettingService:
    """
    模拟跟注与结算服务
    
    规则要点：
    - 每个有效下注局必须下注
    - 下注即扣款，开奖即结算
    - 超过5分钟未开奖：异常注单自动退回
    - 和局不输钱
    - 金额智能自适应，满足最小10、最大10000、10的倍数
    """
    
    def __init__(self):
        self.balance = settings.DEFAULT_BALANCE
    
    def calculate_adaptive_bet(
        self,
        confidence: float,
        consecutive_correct: int,
        consecutive_errors: int,
        current_drawdown: float,
        version_stability: float,
    ) -> BetResult:
        """
        智能自适应下注金额计算
        
        Args:
            confidence: 当前置信度
            consecutive_correct: 连续命中次数
            consecutive_errors: 连续失准次数
            current_drawdown: 当前回撤比例
            version_stability: 模型版本稳定性评分
        
        Returns:
            包含档位和金额的BetResult
        """
        # 确定档位
        if consecutive_errors >= 3 or current_drawdown > 0.15:
            tier = "保守"
            factor = settings.CONSERVATIVE_FACTOR
        elif consecutive_correct >= 3 and confidence > 0.7 and version_stability > 0.6:
            tier = "进取"
            factor = settings.AGGRESSIVE_FACTOR
        else:
            tier = "标准"
            factor = settings.STANDARD_FACTOR
        
        # 计算金额
        raw_amount = settings.BASE_AMOUNT * factor
        bet_amount = int(raw_amount // settings.BET_STEP) * settings.BET_STEP
        
        # 边界裁剪
        bet_amount = min(settings.MAX_BET, max(settings.MIN_BET, bet_amount))
        
        # 生成依据摘要
        adapt_summary = (
            f"置信度{confidence:.0%}，连续{consecutive_correct}中{consecutive_errors}错，"
            f"回撤{current_drawdown:.1%}，版本稳定性{version_stability:.1%}，"
            f"档位{tier}，系数{factor}"
        )
        
        balance_before = self.balance
        
        return BetResult(
            game_number=0,  # 由调用方填入
            bet_direction="",  # 由调用方填入
            bet_amount=float(bet_amount),
            bet_tier=tier,
            balance_before=balance_before,
            balance_after=balance_before,  # 下注后更新
            adapt_summary=adapt_summary,
        )
    
    def place_bet(self, game_number: int, direction: str, amount: float) -> float:
        """
        执行下注（扣款）
        
        Returns:
            下注后余额
        """
        if amount > self.balance:
            amount = self.balance
        self.balance -= amount
        return self.balance
    
    def settle_bet(
        self,
        bet_direction: str,
        bet_amount: float,
        game_result: str,
    ) -> Dict:
        """
        结算注单
        
        Args:
            bet_direction: 下注方向（庄/闲）
            bet_amount: 下注金额
            game_result: 开奖结果（庄/闲/和）
        
        Returns:
            结算结果字典
        """
        if game_result == "和":
            # 和局不输钱，退回本金
            self.balance += bet_amount
            return {
                "status": "已结算",
                "profit_loss": 0.0,
                "settlement_amount": bet_amount,
                "reason": "和局不输钱",
            }
        
        if bet_direction == game_result:
            # 命中
            if bet_direction == "庄":
                payout = bet_amount * settings.BANKER_ODDS
            else:
                payout = bet_amount * settings.PLAYER_ODDS
            
            profit = payout - bet_amount
            self.balance += payout
            return {
                "status": "已结算",
                "profit_loss": profit,
                "settlement_amount": payout,
                "reason": f"命中{bet_direction}",
            }
        else:
            # 未命中
            return {
                "status": "已结算",
                "profit_loss": -bet_amount,
                "settlement_amount": 0.0,
                "reason": f"未命中，开{game_result}",
            }
    
    def refund_bet(self, amount: float) -> float:
        """异常退回"""
        self.balance += amount
        return self.balance
    
    def get_balance(self) -> float:
        """获取当前余额"""
        return self.balance
    
    def set_balance(self, balance: float):
        """设置余额（用于从数据库恢复）"""
        self.balance = balance
