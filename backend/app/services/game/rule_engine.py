from typing import Dict, List, Any
import random

class BaccaratRuleEngine:
    """
    超强百家乐规则引擎 - 基于“多路共振”、“长龙跟随”、“单跳震荡收敛”等核心量化策略
    """
    
    def __init__(self):
        pass

    def analyze(self, game_history: List[Dict], road_data: Dict) -> Dict:
        """
        根据五路数据进行强规则分析预测
        返回结构与 AI 模型类似，保证前端兼容
        """
        banker_score = 0
        player_score = 0
        reasons = []

        # 1. 大路连胜分析 (长龙跟随)
        big_road = self._extract_points(road_data.get("big_road", []))
        if big_road:
            last_result = big_road[-1].get("value") if isinstance(big_road[-1], dict) else getattr(big_road[-1], "value", None)
            streak = self._count_streak(big_road, last_result)
            
            if streak >= 3:
                reasons.append(f"大路出现{streak}连{last_result}（长龙），顺势跟随。")
                if last_result == "庄":
                    banker_score += 40
                else:
                    player_score += 40
            elif streak == 1 and len(big_road) >= 3:
                # 检查单跳
                prev1 = self._get_value(big_road[-1])
                prev2 = self._get_value(big_road[-2])
                prev3 = self._get_value(big_road[-3])
                if prev1 != prev2 and prev2 != prev3:
                    reasons.append("大路呈现单跳震荡形态，预测反转。")
                    if prev1 == "庄":
                        player_score += 30
                    else:
                        banker_score += 30

        # 2. 下三路共振分析 (大眼仔、小路、曱甴路)
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
