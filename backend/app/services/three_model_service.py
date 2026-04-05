"""
三模型协作服务 - 庄模型、闲模型、综合模型
仅分析庄/闲，不分析和局
"""
from typing import Dict, Optional, List
from dataclasses import dataclass, field
from datetime import datetime
import json
import httpx
from app.core.config import settings


@dataclass
class RoadFactor:
    """单路因子"""
    road_name: str          # 路名称
    key_point: str          # 要点（6-12字）
    direction: str          # 方向词：偏庄/偏闲/中性


@dataclass
class ModelOutput:
    """模型输出结构"""
    model_type: str         # 模型类型：庄模型/闲模型/综合模型
    summary: str            # 可读摘要（30-80字）
    road_factors: List[RoadFactor] = field(default_factory=list)  # 五路要点
    key_signals: List[str] = field(default_factory=list)   # 关键信号
    risk_points: List[str] = field(default_factory=list)    # 反向风险点
    signal_strength: str = "中等"  # 信号强度
    confidence: float = 0.5       # 置信度 0-1
    final_prediction: Optional[str] = None  # 最终预测：庄/闲（仅综合模型）
    conflict_handling: str = ""    # 冲突处理说明（仅综合模型）
    bet_tier: str = "标准"        # 建议档位


class ThreeModelService:
    """
    三模型协作服务
    
    协作方式：
    - 庄模型：只输出庄向证据链
    - 闲模型：只输出闲向证据链
    - 庄/闲并行执行
    - 综合模型：串行汇总，输出最终预测与置信度
    """
    
    def __init__(self):
        self.api_key = settings.ANTHROPIC_API_KEY
        self.model = settings.AI_MODEL
    
    async def analyze(
        self,
        game_number: int,
        boot_number: int,
        game_history: List[Dict],
        road_data: Dict,
        mistake_context: Optional[List[Dict]] = None,
        consecutive_errors: int = 0,
    ) -> Dict:
        """
        执行三模型分析
        
        Args:
            game_number: 当前局号
            boot_number: 靴号
            game_history: 历史开奖记录
            road_data: 五路走势图数据
            mistake_context: 错题本上下文
            consecutive_errors: 连续失准次数
        
        Returns:
            包含三模型输出的完整结果
        """
        # 并行执行庄模型和闲模型
        banker_result = await self._banker_model(game_history, road_data, mistake_context)
        player_result = await self._player_model(game_history, road_data, mistake_context)
        
        # 综合模型汇总
        combined_result = await self._combined_model(
            banker_result, player_result, 
            consecutive_errors, game_history
        )
        
        return {
            "game_number": game_number,
            "banker_model": banker_result,
            "player_model": player_result,
            "combined_model": combined_result,
            "analyzed_at": datetime.now().isoformat(),
        }
    
    async def _banker_model(
        self, game_history: List[Dict], road_data: Dict, mistake_context: Optional[List[Dict]]
    ) -> Dict:
        """庄模型 - 只输出庄向证据链"""
        prompt = self._build_banker_prompt(game_history, road_data, mistake_context)
        
        try:
            result = await self._call_ai(prompt)
            return self._parse_model_output(result, "庄模型")
        except Exception as e:
            return self._get_fallback_output("庄模型", error=str(e))
    
    async def _player_model(
        self, game_history: List[Dict], road_data: Dict, mistake_context: Optional[List[Dict]]
    ) -> Dict:
        """闲模型 - 只输出闲向证据链"""
        prompt = self._build_player_prompt(game_history, road_data, mistake_context)
        
        try:
            result = await self._call_ai(prompt)
            return self._parse_model_output(result, "闲模型")
        except Exception as e:
            return self._get_fallback_output("闲模型", error=str(e))
    
    async def _combined_model(
        self, banker_result: Dict, player_result: Dict,
        consecutive_errors: int, game_history: List[Dict]
    ) -> Dict:
        """综合模型 - 融合证据与走势图输出最终预测与置信度"""
        prompt = self._build_combined_prompt(banker_result, player_result, consecutive_errors, game_history)
        
        try:
            result = await self._call_ai(prompt)
            return self._parse_combined_output(result, consecutive_errors)
        except Exception as e:
            # 降级：基于庄闲证据对比做简单决策
            return self._get_fallback_combined(banker_result, player_result, consecutive_errors, error=str(e))
    
    def _build_banker_prompt(self, game_history, road_data, mistake_context) -> str:
        """构建庄模型提示词"""
        history_str = self._format_history(game_history)
        road_str = self._format_roads(road_data)
        mistake_str = self._format_mistakes(mistake_context) if mistake_context else "无"
        
        return f"""你是百家乐分析系统的庄模型专家。你只分析庄向证据，不分析和局。

当前靴历史记录：
{history_str}

五路走势图数据：
{road_str}

本靴错题本参考：
{mistake_str}

请输出庄向证据分析，必须严格按以下JSON格式返回，不要输出其他内容：
{{
    "road_factors": {{
        "大路": "6到12字的庄向要点，必须包含方向词（偏庄/偏闲/中性）",
        "珠盘路": "6到12字的庄向要点",
        "大眼仔路": "6到12字的庄向要点",
        "小路": "6到12字的庄向要点",
        "螳螂路": "6到12字的庄向要点"
    }},
    "key_signals": ["关键信号1", "关键信号2"],
    "risk_points": ["反向风险点1"],
    "signal_strength": "强/中等/弱",
    "confidence": 0.0到1.0之间的数字,
    "summary": "因为大路{{大路要点}}、珠盘路{{珠盘路要点}}、大眼仔路{{大眼仔路要点}}、小路{{小路要点}}、螳螂路{{螳螂路要点}}，所以{{庄向结论}}"
}}

注意：
1. summary必须使用"因为…所以…"格式，30到80字
2. 至少3路要点必须包含明确方向词（偏庄/偏闲/中性）
3. 不要出现"无法解释""未知原因"等空洞表述
4. 不要堆叠专业术语，面向小白用户可读"""
    
    def _build_player_prompt(self, game_history, road_data, mistake_context) -> str:
        """构建闲模型提示词"""
        history_str = self._format_history(game_history)
        road_str = self._format_roads(road_data)
        mistake_str = self._format_mistakes(mistake_context) if mistake_context else "无"
        
        return f"""你是百家乐分析系统的闲模型专家。你只分析闲向证据，不分析和局。

当前靴历史记录：
{history_str}

五路走势图数据：
{road_str}

本靴错题本参考：
{mistake_str}

请输出闲向证据分析，必须严格按以下JSON格式返回，不要输出其他内容：
{{
    "road_factors": {{
        "大路": "6到12字的闲向要点，必须包含方向词（偏庄/偏闲/中性）",
        "珠盘路": "6到12字的闲向要点",
        "大眼仔路": "6到12字的闲向要点",
        "小路": "6到12字的闲向要点",
        "螳螂路": "6到12字的闲向要点"
    }},
    "key_signals": ["关键信号1", "关键信号2"],
    "risk_points": ["反向风险点1"],
    "signal_strength": "强/中等/弱",
    "confidence": 0.0到1.0之间的数字,
    "summary": "因为大路{{大路要点}}、珠盘路{{珠盘路要点}}、大眼仔路{{大眼仔路要点}}、小路{{小路要点}}、螳螂路{{螳螂路要点}}，所以{{闲向结论}}"
}}

注意：
1. summary必须使用"因为…所以…"格式，30到80字
2. 至少3路要点必须包含明确方向词（偏庄/偏闲/中性）
3. 不要出现"无法解释""未知原因"等空洞表述
4. 不要堆叠专业术语，面向小白用户可读"""
    
    def _build_combined_prompt(
        self, banker_result: Dict, player_result: Dict,
        consecutive_errors: int, game_history: List[Dict]
    ) -> str:
        """构建综合模型提示词"""
        history_str = self._format_history(game_history[-20:])  # 最近20局
        
        tier_note = ""
        if consecutive_errors >= 3:
            tier_note = "注意：当前已连续3局预测错误，必须切换为保守策略。"
        
        return f"""你是百家乐分析系统的综合决策模型。你需要融合庄模型和闲模型的证据，输出最终预测。

庄模型分析结果：
{json.dumps(banker_result, ensure_ascii=False, indent=2)}

闲模型分析结果：
{json.dumps(player_result, ensure_ascii=False, indent=2)}

最近历史记录：
{history_str}

连续失准次数：{consecutive_errors}
{tier_note}

请严格按以下JSON格式返回最终决策，不要输出其他内容：
{{
    "evidence_comparison": "庄闲证据对比结论（20字以内）",
    "conflict_handling": "五路冲突处理结果（20字以内）",
    "final_prediction": "庄或闲（只能选一个）",
    "confidence": 0.0到1.0之间的数字,
    "bet_tier": "保守/标准/进取",
    "summary": "因为{{庄闲证据对比}}+{{五路冲突处理}}，所以最终结论下局预测{{庄/闲}}"
}}

注意：
1. final_prediction只能输出"庄"或"闲"，不允许输出"和"
2. 连续3局失准时bet_tier必须为"保守"
3. summary使用"因为…所以…"格式
4. bet_tier选择规则：连续失准或回撤高→保守，常规→标准，连续命中且同向增强→进取"""
    
    async def _call_ai(self, prompt: str) -> str:
        """调用Claude API"""
        if not self.api_key:
            raise ValueError("未配置ANTHROPIC_API_KEY")
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": self.api_key,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                json={
                    "model": self.model,
                    "max_tokens": 1024,
                    "messages": [{"role": "user", "content": prompt}],
                },
            )
            response.raise_for_status()
            data = response.json()
            return data["content"][0]["text"]
    
    def _parse_model_output(self, raw: str, model_type: str) -> Dict:
        """解析模型输出"""
        try:
            # 提取JSON
            json_str = raw.strip()
            if "```json" in json_str:
                json_str = json_str.split("```json")[1].split("```")[0]
            elif "```" in json_str:
                json_str = json_str.split("```")[1].split("```")[0]
            
            data = json.loads(json_str)
            
            return {
                "model_type": model_type,
                "summary": data.get("summary", ""),
                "road_factors": data.get("road_factors", {}),
                "key_signals": data.get("key_signals", []),
                "risk_points": data.get("risk_points", []),
                "signal_strength": data.get("signal_strength", "中等"),
                "confidence": float(data.get("confidence", 0.5)),
                "is_complete": True,
            }
        except Exception as e:
            return self._get_fallback_output(model_type, error=f"解析失败: {str(e)}")
    
    def _parse_combined_output(self, raw: str, consecutive_errors: int) -> Dict:
        """解析综合模型输出"""
        try:
            json_str = raw.strip()
            if "```json" in json_str:
                json_str = json_str.split("```json")[1].split("```")[0]
            elif "```" in json_str:
                json_str = json_str.split("```")[1].split("```")[0]
            
            data = json.loads(json_str)
            
            # 连续失准时强制保守档
            bet_tier = data.get("bet_tier", "标准")
            if consecutive_errors >= 3:
                bet_tier = "保守"
            
            # 文案档位调整
            summary = data.get("summary", "")
            if bet_tier == "保守" and "保守策略" not in summary:
                summary = summary.replace("下局预测", "按保守策略下局预测")
            elif bet_tier == "进取" and "进取策略" not in summary:
                summary = summary.replace("下局预测", "按进取策略下局预测")
            elif bet_tier == "标准" and "标准策略" not in summary:
                summary = summary.replace("下局预测", "按标准策略下局预测")
            
            return {
                "model_type": "综合模型",
                "summary": summary,
                "evidence_comparison": data.get("evidence_comparison", ""),
                "conflict_handling": data.get("conflict_handling", ""),
                "final_prediction": data.get("final_prediction", "庄"),
                "confidence": float(data.get("confidence", 0.5)),
                "bet_tier": bet_tier,
                "is_complete": True,
            }
        except Exception as e:
            return self._get_fallback_combined({}, {}, consecutive_errors, error=str(e))
    
    def _get_fallback_output(self, model_type: str, error: str = "") -> Dict:
        """降级输出"""
        return {
            "model_type": model_type,
            "summary": "",
            "road_factors": {},
            "key_signals": [],
            "risk_points": [],
            "signal_strength": "弱",
            "confidence": 0.3,
            "is_complete": False,
            "error": error,
        }
    
    def _get_fallback_combined(
        self, banker: Dict, player: Dict, consecutive_errors: int, error: str = ""
    ) -> Dict:
        """综合模型降级输出"""
        banker_strength = banker.get("signal_strength", "弱")
        player_strength = player.get("signal_strength", "弱")
        
        # 简单决策
        strength_rank = {"强": 3, "中等": 2, "弱": 1}
        banker_score = strength_rank.get(banker_strength, 1) * banker.get("confidence", 0.3)
        player_score = strength_rank.get(player_strength, 1) * player.get("confidence", 0.3)
        
        prediction = "庄" if banker_score >= player_score else "闲"
        bet_tier = "保守" if consecutive_errors >= 3 else "标准"
        
        return {
            "model_type": "综合模型",
            "summary": f"因为庄向证据{'较强' if banker_score >= player_score else '较弱'}且冲突{'可控' if abs(banker_score - player_score) < 0.3 else '较大'}，所以按{bet_tier}策略下局预测{prediction}",
            "evidence_comparison": f"庄向{'较强' if banker_score >= player_score else '较弱'}",
            "conflict_handling": "保守处理" if abs(banker_score - player_score) < 0.3 else "偏强方向",
            "final_prediction": prediction,
            "confidence": max(banker_score, player_score),
            "bet_tier": bet_tier,
            "is_complete": False,
            "error": error,
        }
    
    def _format_history(self, game_history: List[Dict]) -> str:
        """格式化历史记录"""
        if not game_history:
            return "暂无历史记录"
        
        lines = []
        recent = game_history[-30:]  # 最近30局
        for g in recent:
            gn = g.get("game_number", "?")
            result = g.get("result", "?")
            predict = g.get("predict_direction", "未预测")
            correct = "✓" if g.get("predict_correct") else "✗"
            lines.append(f"第{gn}局: 结果={result}, 预测={predict}, {correct}")
        
        return "\n".join(lines)
    
    def _format_roads(self, road_data: Dict) -> str:
        """格式化五路数据"""
        if not road_data:
            return "暂无走势图数据"
        
        lines = []
        for road_name, points in road_data.items():
            if points:
                values = [p.get("value", "?") for p in points[-15:]]  # 最近15个点
                lines.append(f"{road_name}: {'→'.join(values)}")
        
        return "\n".join(lines) if lines else "暂无走势图数据"
    
    def _format_mistakes(self, mistakes: List[Dict]) -> str:
        """格式化错题本"""
        if not mistakes:
            return "本靴无错题记录"
        
        lines = []
        for m in mistakes[-5:]:  # 最近5条
            gn = m.get("game_number", "?")
            etype = m.get("error_type", "?")
            analysis = m.get("analysis", "未分析")
            lines.append(f"第{gn}局({etype}): {analysis}")
        
        return "\n".join(lines)
