from typing import Dict, List, Any
import random
import logging
import asyncio

from app.services.game.session import get_session
from app.services.game.logging import write_game_log

logger = logging.getLogger(__name__)

class BaccaratRuleEngine:
    """
    超强百家乐自适应规则引擎 - 具备动态权重“进化”能力
    基于本靴近期的“长龙” vs “单跳” 胜率反馈，动态调整策略权重
    """

    def __init__(self):
        # 默认基础权重
        self.weights = {
            "dragon_streak": 40,   # 长龙跟随的得分权重
            "chop_oscillation": 30,# 单跳震荡的得分权重
            "road_red_sync": 20,   # 下三路齐红共振的得分权重
            "road_blue_turn": 15   # 下三路蓝反转的得分权重
        }

    def _evolve_weights_from_history(self, game_history: List[Dict]):
        """
        核心进化算法：通过历史回测调整权重
        如果本靴最近经常出现长龙，调高长龙权重；如果经常断成单跳，调高震荡权重。
        加入“规则瞬断（Pattern Break）”的极速惩罚机制应对100%的随机性。
        返回是否触发了“断裂混沌期”。
        """
        if not game_history or len(game_history) < 5:
            return False

        streak_count = 0
        chop_count = 0
        
        # 简单统计最近20局里的长龙（连出3次及以上）和单跳形态出现次数
        history = [g.get("result") for g in game_history[-20:] if g.get("result") in ("庄", "闲")]
        
        current_streak = 1
        recent_break = False # 是否刚刚发生规律中断
        
        for i in range(1, len(history)):
            if history[i] == history[i-1]:
                current_streak += 1
            else:
                # 当趋势中断时，检查是不是刚断了一个长龙
                if current_streak >= 3:
                    streak_count += 1
                    if i == len(history) - 1: # 就是上一局刚刚断掉的
                        recent_break = True
                elif current_streak == 1:
                    chop_count += 1
                current_streak = 1
                
        if current_streak >= 3:
            streak_count += 1

        # 宏观趋势调整逻辑（自适应微调，上限100，下限10）
        if streak_count > chop_count:
            self.weights["dragon_streak"] = min(80, self.weights["dragon_streak"] + 5)
            self.weights["chop_oscillation"] = max(10, self.weights["chop_oscillation"] - 5)
        elif chop_count > streak_count:
            self.weights["chop_oscillation"] = min(80, self.weights["chop_oscillation"] + 5)
            self.weights["dragon_streak"] = max(10, self.weights["dragon_streak"] - 5)
            
        # 瞬时随机中断惩罚：如果上一局刚刚打断了一个极强的规律，下一局的该规律权重瞬间暴跌（防陷阱）
        if recent_break:
            logger.info("检测到长龙规律被随机性瞬间打断！强制调低追龙权重。")
            self.weights["dragon_streak"] = max(10, self.weights["dragon_streak"] - 30)
            
            # 记录系统日志
            try:
                sess = get_session()
                asyncio.create_task(
                    write_game_log(
                        None,
                        category="AI事件",
                        priority="P2",
                        event_type="策略进化",
                        event_result="-",
                        description=f"检测到长龙规律被瞬间打断，系统进入混沌防守状态，已动态调低追龙权重至 {self.weights['dragon_streak']}",
                        game_number=sess.game_number,
                        boot_number=sess.boot_number
                    )
                )
            except Exception:
                pass

        logger.info(f"规则引擎已自我进化！当前权重 -> 长龙:{self.weights['dragon_streak']}, 单跳:{self.weights['chop_oscillation']}")
        return recent_break

    def analyze(self, game_history: List[Dict], road_data: Dict) -> Dict:
        """
        根据五路数据进行强规则分析预测
        返回结构与 AI 模型类似，保证前端兼容
        """
        # 1. 每次分析前，先通过历史复盘进行“自我进化”
        is_chaos = self._evolve_weights_from_history(game_history)

        banker_score = 0
        player_score = 0
        banker_reasons = []
        player_reasons = []
        combined_reasons = []
        
        if is_chaos:
            combined_reasons.append("上一局发生了强规律的随机断裂，系统进入混沌防守状态")

        # 2. 大路连胜分析 (长龙跟随)
        big_road = self._extract_points(road_data.get("big_road", []))
        if big_road:
            last_result = big_road[-1].get("value") if isinstance(big_road[-1], dict) else getattr(big_road[-1], "value", None)
            streak = self._count_streak(big_road, last_result)

            if streak >= 3:
                reason = f"大路出现{streak}连{last_result}的长龙趋势"
                if last_result == "庄":
                    banker_score += self.weights['dragon_streak']
                    banker_reasons.append(reason)
                else:
                    player_score += self.weights['dragon_streak']
                    player_reasons.append(reason)
            elif streak == 1 and len(big_road) >= 3:
                # 检查单跳
                prev1 = self._get_value(big_road[-1])
                prev2 = self._get_value(big_road[-2])
                prev3 = self._get_value(big_road[-3])
                if prev1 != prev2 and prev2 != prev3:
                    reason = "大路呈现明显的单跳震荡格局"
                    if prev1 == "庄":
                        # 下一个预测为闲
                        player_score += self.weights['chop_oscillation']
                        player_reasons.append(reason)
                    else:
                        banker_score += self.weights['chop_oscillation']
                        banker_reasons.append(reason)

        # 3. 珠盘路 (Bead Road) 宏观密度与周期性分析
        # 统计最近 12 局（相当于两列）的庄闲密度，寻找宏观失衡点
        bead_road = self._extract_points(road_data.get("bead_road", []))
        if bead_road and len(bead_road) >= 12:
            recent_12 = [self._get_value(p) for p in bead_road[-12:]]
            recent_banker = recent_12.count("庄")
            recent_player = recent_12.count("闲")
            
            # 珠盘路呈现极度庄强
            if recent_banker >= 9:
                reason = f"珠盘路近12局呈现极度庄强({recent_banker}胜)"
                banker_score += 25
                banker_reasons.append(reason)
            # 珠盘路呈现极度闲强
            elif recent_player >= 9:
                reason = f"珠盘路近12局呈现极度闲强({recent_player}胜)"
                player_score += 25
                player_reasons.append(reason)

        # 4. 下三路共振分析 (大眼仔、小路、曱甴路)
        # 红色代表规律（顺），蓝色代表无序（反）
        # 实际编程中我们需要“问路”，这里我们通过下三路当前的收尾颜色来判断整体趋势
        # 修复 Bug：正确的键名是 big_eye 和 cockroach_road
        big_eye = self._extract_points(road_data.get("big_eye", []))
        small = self._extract_points(road_data.get("small_road", []))
        cockroach = self._extract_points(road_data.get("cockroach_road", []))
        
        def check_road_trend(road, name):
            nonlocal banker_score, player_score
            if not road: return
            last_color = self._get_value(road[-1])
            if last_color == "红":
                last_big = self._get_value(big_road[-1]) if big_road else None
                reason = f"{name}显示红，当前趋势继续顺延"
                if last_big == "庄":
                    banker_score += 20
                    banker_reasons.append(reason)
                elif last_big == "闲":
                    player_score += 20
                    player_reasons.append(reason)
            else:
                last_big = self._get_value(big_road[-1]) if big_road else None
                reason = f"{name}显示蓝，当前趋势面临转折"
                if last_big == "庄":
                    player_score += 15
                    player_reasons.append(reason)
                elif last_big == "闲":
                    banker_score += 15
                    banker_reasons.append(reason)

        check_road_trend(big_eye, "大眼仔路")
        check_road_trend(small, "小路")
        check_road_trend(cockroach, "曱甴路")

        # 决策
        if banker_score == player_score:
            # 随机打破僵局或根据全局比例
            banker_score += random.choice([-5, 5])
            
        prediction = "庄" if banker_score > player_score else "闲"
        confidence = max(55.0, min(95.0, 50 + abs(banker_score - player_score) * 0.5))
        
        # 混沌防守期的极端保护：强制拉低置信度，强制设为“保守”层级
        if is_chaos:
            confidence = min(confidence, 60.0)
            tier = "保守"
        else:
            tier = "高" if confidence > 75 else "标准"
        
        # 拼装“因为...所以...”的分析逻辑
        banker_summary = f"因为 {', '.join(banker_reasons)}，所以本局看好【庄】。" if banker_reasons else "因为当前路单未能捕捉到明显的庄向趋势特征，所以暂无庄向推荐。"
        player_summary = f"因为 {', '.join(player_reasons)}，所以本局看好【闲】。" if player_reasons else "因为当前路单未能捕捉到明显的闲向趋势特征，所以暂无闲向推荐。"
        
        combined_reason = banker_reasons if prediction == "庄" else player_reasons
        combined_summary = f"因为 {', '.join(combined_reason)}，并且{', '.join(combined_reasons) if combined_reasons else '当前处于规律期'}，所以最终预测为【{prediction}】。" if combined_reason else f"因为当前盘面处于无序状态，缺乏明显规律，所以系统根据经验补偿机制给出了偏向【{prediction}】的预测。"

        return {
            "predict": prediction,
            "confidence": round(confidence / 100.0, 2),
            "bet_amount": 100,  # 默认值，可以在外层覆盖
            "tier": tier,
            "banker_summary": banker_summary,
            "player_summary": player_summary,
            "combined_summary": combined_summary
        }

    def _extract_points(self, road_obj):
        if hasattr(road_obj, 'points'):
            return road_obj.points
        elif isinstance(road_obj, dict) and "points" in road_obj:
            return road_obj["points"]
        elif isinstance(road_obj, list):
            return road_obj
        return []

    def _get_value(self, p):
        return getattr(p, 'value', None) if not isinstance(p, dict) else p.get("value")

    def _count_streak(self, points: List[Any], target_value: str) -> int:
        if not points: return 0
        streak = 0
        for p in reversed(points):
            if self._get_value(p) == target_value:
                streak += 1
            else:
                break
        return streak
