from typing import Dict, List, Any
import random
import logging

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
        """
        if not game_history or len(game_history) < 5:
            return

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
            
        logger.info(f"规则引擎已自我进化！当前权重 -> 长龙:{self.weights['dragon_streak']}, 单跳:{self.weights['chop_oscillation']}")

    def analyze(self, game_history: List[Dict], road_data: Dict) -> Dict:
        """
        根据五路数据进行强规则分析预测
        返回结构与 AI 模型类似，保证前端兼容
        """
        # 1. 每次分析前，先通过历史复盘进行“自我进化”
        self._evolve_weights_from_history(game_history)

        banker_score = 0
        player_score = 0
        reasons = []

        # 2. 大路连胜分析 (长龙跟随)
        big_road = self._extract_points(road_data.get("big_road", []))
        if big_road:
            last_result = big_road[-1].get("value") if isinstance(big_road[-1], dict) else getattr(big_road[-1], "value", None)
            streak = self._count_streak(big_road, last_result)

            if streak >= 3:
                reasons.append(f"大路出现{streak}连{last_result}（长龙），动态权重加成：+{self.weights['dragon_streak']}")
                if last_result == "庄":
                    banker_score += self.weights['dragon_streak']
                else:
                    player_score += self.weights['dragon_streak']
            elif streak == 1 and len(big_road) >= 3:
                # 检查单跳
                prev1 = self._get_value(big_road[-1])
                prev2 = self._get_value(big_road[-2])
                prev3 = self._get_value(big_road[-3])
                if prev1 != prev2 and prev2 != prev3:
                    reasons.append(f"大路呈现单跳震荡形态，动态权重加成：+{self.weights['chop_oscillation']}")
                    if prev1 == "庄":
                        player_score += self.weights['chop_oscillation']
                    else:
                        banker_score += self.weights['chop_oscillation']

        # 3. 下三路共振分析 (大眼仔、小路、曱甴路)
        # 红色代表规律（顺），蓝色代表无序（反）
        # 实际编程中我们需要“问路”，这里我们通过下三路当前的收尾颜色来判断整体趋势
        big_eye = self._extract_points(road_data.get("big_eye_boy", []))
        small = self._extract_points(road_data.get("small_road", []))
        cockroach = self._extract_points(road_data.get("cockroach_pig", []))
        
        def check_road_trend(road, name):
            nonlocal banker_score, player_score
            if not road: return
            last_val = self._get_value(road[-1])
            streak = self._count_streak(road, last_val)
            if last_val == "红":
                reasons.append(f"{name}出现{streak}连红，趋势高度规律。")
                # 假设当前大路是庄，红意味着继续顺延
                # 这里简化：若大路最后是庄，红加庄；蓝加闲
                last_big = self._get_value(big_road[-1]) if big_road else None
                if last_big == "庄":
                    banker_score += 20
                elif last_big == "闲":
                    player_score += 20
            else:
                reasons.append(f"{name}出现蓝，趋势转折或无序。")
                last_big = self._get_value(big_road[-1]) if big_road else None
                if last_big == "庄":
                    player_score += 15
                elif last_big == "闲":
                    banker_score += 15

        check_road_trend(big_eye, "大眼仔路")
        check_road_trend(small, "小路")
        check_road_trend(cockroach, "曱甴路")

        # 决策
        if banker_score == player_score:
            # 随机打破僵局或根据全局比例
            banker_score += random.choice([-5, 5])
            
        prediction = "庄" if banker_score > player_score else "闲"
        confidence = max(55.0, min(95.0, 50 + abs(banker_score - player_score) * 0.5))
        
        summary = "基于强化规则引擎分析：\n" + "\n".join(f"- {r}" for r in reasons)
        
        return {
            "predict": prediction,
            "confidence": round(confidence / 100.0, 2),
            "bet_amount": 100,  # 默认值，可以在外层覆盖
            "tier": "高" if confidence > 75 else "标准",
            "summary": summary
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
