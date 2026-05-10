from typing import Dict, Any, Optional
import json
import aiohttp
import asyncio

from app.core.config import settings
from fastapi.encoders import jsonable_encoder


class SingleModelService:
    @staticmethod
    def _pick_value(data: Dict[str, Any], *keys: str, default: Any = None) -> Any:
        for key in keys:
            if key in data and data.get(key) not in (None, ""):
                return data.get(key)
        return default

    @staticmethod
    def _pick_list(data: Dict[str, Any], *keys: str) -> list[Any]:
        for key in keys:
            value = data.get(key)
            if isinstance(value, list):
                return value
        return []

    @staticmethod
    def _confidence_label(confidence: float) -> str:
        if confidence >= 0.75:
            return "高"
        if confidence >= 0.6:
            return "中"
        return "低"

    @staticmethod
    def _extract_points(road_obj: Any) -> list[Any]:
        if hasattr(road_obj, "points"):
            return road_obj.points
        if isinstance(road_obj, dict) and "points" in road_obj:
            return road_obj["points"]
        if isinstance(road_obj, list):
            return road_obj
        return []

    @staticmethod
    def _get_value(point: Any) -> Any:
        return point.get("value") if isinstance(point, dict) else getattr(point, "value", None)

    def _default_road_explanations(
        self,
        direction: str,
        road_data: dict[str, Any],
    ) -> dict[str, dict[str, str]]:
        big_road = self._extract_points(road_data.get("big_road", []))
        bead_road = self._extract_points(road_data.get("bead_road", []))
        big_eye = self._extract_points(road_data.get("big_eye", []))
        small_road = self._extract_points(road_data.get("small_road", []))
        cockroach_road = self._extract_points(road_data.get("cockroach_road", []))

        def neutral(name: str, summary: str) -> dict[str, str]:
            return {
                "trend_label": f"{name}中性",
                "tendency": "中性",
                "support_level": "弱",
                "plain_summary": summary,
            }

        def color_explanation(name: str, points: list[Any]) -> dict[str, str]:
            if not points:
                return neutral(name, f"{name}当前样本不足，暂时只能提供弱参考。")
            last_color = self._get_value(points[-1])
            if last_color == "红":
                return {
                    "trend_label": f"{name}偏顺",
                    "tendency": direction,
                    "support_level": "中",
                    "plain_summary": f"{name}目前收在红色，说明当前走势延续性仍在。",
                }
            return {
                "trend_label": f"{name}提示转折",
                "tendency": "闲" if direction == "庄" else "庄",
                "support_level": "弱",
                "plain_summary": f"{name}目前收在蓝色，提醒原走势可能开始减弱或转向。",
            }

        if big_road:
            last_value = self._get_value(big_road[-1])
            streak = 0
            for point in reversed(big_road):
                if self._get_value(point) == last_value:
                    streak += 1
                else:
                    break
            big_road_explanation = {
                "trend_label": f"大路{streak}连{last_value}" if streak >= 2 else "大路震荡",
                "tendency": last_value if last_value in ("庄", "闲") else "中性",
                "support_level": "强" if streak >= 3 else "中" if streak >= 2 else "弱",
                "plain_summary": (
                    f"大路最近连续走出{streak}次{last_value}，主走势还在延续。"
                    if streak >= 2 and last_value in ("庄", "闲")
                    else "大路当前更像切换阶段，暂时没有绝对单边信号。"
                ),
            }
        else:
            big_road_explanation = neutral("大路", "当前大路样本还不够，暂时只能作为弱参考。")

        if bead_road:
            recent = [self._get_value(point) for point in bead_road[-12:]]
            banker_count = recent.count("庄")
            player_count = recent.count("闲")
            if banker_count > player_count:
                bead_explanation = {
                    "trend_label": "珠盘路偏庄",
                    "tendency": "庄",
                    "support_level": "强" if banker_count - player_count >= 6 else "中",
                    "plain_summary": "珠盘路最近一段时间庄更多，整体密度仍偏向庄。",
                }
            elif player_count > banker_count:
                bead_explanation = {
                    "trend_label": "珠盘路偏闲",
                    "tendency": "闲",
                    "support_level": "强" if player_count - banker_count >= 6 else "中",
                    "plain_summary": "珠盘路最近一段时间闲更多，整体密度仍偏向闲。",
                }
            else:
                bead_explanation = neutral("珠盘路", "珠盘路庄闲分布接近，更多是中性提醒。")
        else:
            bead_explanation = neutral("珠盘路", "珠盘路当前样本不足，暂时只能作为弱参考。")

        return {
            "big_road": big_road_explanation,
            "bead_road": bead_explanation,
            "big_eye_road": color_explanation("大眼仔路", big_eye),
            "small_road": color_explanation("小路", small_road),
            "cockroach_road": color_explanation("螳螂路", cockroach_road),
        }

    def _build_analysis_outcome(
        self,
        parsed: Dict[str, Any],
        combined_model: Dict[str, Any],
        road_data: dict[str, Any],
    ) -> dict[str, Any]:
        direction = combined_model["final_prediction"]
        confidence = float(combined_model.get("confidence", 0.0) or 0.0)
        short_reason = str(
            self._pick_value(
                parsed,
                "short_reason",
                "summary",
                "reason",
                "摘要",
                "分析摘要",
                "理由",
                default=f"当前五路综合下来更偏向{direction}。",
            )
        ).strip()
        final_reason = str(
            self._pick_value(
                parsed,
                "final_reason",
                "reasoning_detail",
                "推理详情",
                "详细推理",
                "分析详情",
                "summary",
                "摘要",
                default=short_reason,
            )
        ).strip()
        technical_message = self._pick_value(parsed, "technical_message", "diagnostic", "错误摘要")
        technical_diagnostic = (
            {"code": None, "message": str(technical_message).strip()}
            if technical_message not in (None, "")
            else None
        )

        return {
            "direction": direction,
            "confidence": confidence,
            "confidence_label": self._confidence_label(confidence),
            "source": "single_ai",
            "short_reason": short_reason,
            "final_reason": final_reason,
            "fallback_reason": None,
            "road_explanations": self._default_road_explanations(direction, road_data),
            "technical_diagnostic": technical_diagnostic,
        }

    async def analyze(
        self,
        game_number: int,
        boot_number: int,
        game_history: list[dict[str, Any]],
        road_data: dict[str, Any],
        mistake_context: list[dict[str, Any]],
        consecutive_errors: int,
        road_features: Optional[dict[str, Any]] = None,
        prompt_template: Optional[str] = None,
    ) -> Dict[str, Any]:
        if prompt_template:
            prompt = self._build_prompt_with_template(
                prompt_template=prompt_template,
                game_number=game_number,
                boot_number=boot_number,
                game_history=game_history,
                road_data=road_data,
                road_features=road_features,
                mistake_context=mistake_context,
                consecutive_errors=consecutive_errors,
            )
        else:
            prompt = self._build_prompt(
                game_number=game_number,
                boot_number=boot_number,
                game_history=game_history,
                road_data=road_data,
                road_features=road_features,
                mistake_context=mistake_context,
                consecutive_errors=consecutive_errors,
            )

        text = await self._call_model(prompt)
        parsed = self._parse_model_json(text)

        fp = self._pick_value(parsed, "final_prediction", "prediction", "最终预测", "预测结果", "预测方向", default="庄")
        if fp not in ("庄", "闲"):
            fp = "庄"

        combined_model = {
            "final_prediction": fp,
            "confidence": float(self._pick_value(parsed, "confidence", "置信度", default=0.0) or 0.0),
            "bet_tier": self._pick_value(parsed, "bet_tier", "bet_level", "下注档位", "下注级别", "档位", default="标准"),
            "summary": self._pick_value(parsed, "summary", "reason", "摘要", "分析摘要", "理由", "结论摘要", default=""),
            "reasoning_points": self._pick_list(parsed, "reasoning_points", "signals", "推理要点", "关键信号"),
            "reasoning_detail": self._pick_value(
                parsed,
                "reasoning_detail",
                "reason",
                "推理详情",
                "详细推理",
                "分析详情",
                "summary",
                "摘要",
                default="",
            ),
        }
        analysis_outcome = self._build_analysis_outcome(parsed, combined_model, road_data)

        return {
            "combined_model": combined_model,
            "banker_model": {"summary": ""},
            "player_model": {"summary": ""},
            "analysis_outcome": analysis_outcome,
        }

    async def realtime_strategy_learning(
        self,
        game_history: list[dict[str, Any]],
        road_data: dict[str, Any],
        consecutive_errors: int = 0,
    ) -> str:
        tmpl = getattr(settings, "SINGLE_AI_REALTIME_STRATEGY_PROMPT_TEMPLATE", "") or ""
        encoded_road_data = jsonable_encoder(road_data)
        if tmpl:
            prompt = (
                tmpl
                .replace("{{GAME_HISTORY}}", json.dumps(game_history, ensure_ascii=False))
                .replace("{{ROAD_DATA}}", json.dumps(encoded_road_data, ensure_ascii=False))
                .replace("{{CONSECUTIVE_ERRORS}}", str(consecutive_errors))
            )
        else:
            prompt = (
                "你是百家乐分析系统的【策略提炼专家】。当前玩家已经下注，正在等待开奖。\n"
                "请利用等待时间，深度审视当前的五路结构，输出 100-200 字的高度浓缩策略总结。\n"
                "必须包含：当前主要处于什么形态（如长龙、单跳、齐脚等）、哪几路正在发生共振、下一局决策最该警惕的陷阱。\n"
                "不要寒暄，不要分点编号，直接输出策略文本。\n"
                f"历史: {json.dumps(game_history, ensure_ascii=False)}\n"
                f"五路: {json.dumps(encoded_road_data, ensure_ascii=False)}\n"
                f"连续失准: {consecutive_errors}\n"
            )
        return await self._call_raw(prompt)

    def _build_prompt(
        self,
        game_number: int,
        boot_number: int,
        game_history: list[dict[str, Any]],
        road_data: dict[str, Any],
        mistake_context: list[dict[str, Any]],
        consecutive_errors: int,
        road_features: Optional[dict[str, Any]] = None,
    ) -> str:
        encoded_road_data = jsonable_encoder(road_data)
        encoded_road_features = jsonable_encoder(road_features) if road_features else None
        encoded_mistakes = jsonable_encoder(mistake_context)
        return (
            "你是百家乐分析预测引擎。请基于当前靴的全量历史局与全量五路走势图，预测下一局庄/闲。\n"
            "你必须逐路核对五条路（大路/珠盘路/大眼仔/小路/螳螂），并先使用五路特征摘要进行投票汇总，再结合全量五路点位解释。\n"
            "输出必须是严格 JSON（不要任何额外文字），字段如下：\n"
            '{"final_prediction":"庄或闲","confidence":0-1,"bet_tier":"保守/标准/激进","summary":"一句话摘要","reasoning_points":["要点1","要点2"],"reasoning_detail":"更详细的解释版推理"}\n'
            f"靴号: {boot_number}\n"
            f"局号: {game_number}\n"
            f"连续失准: {consecutive_errors}\n"
            f"历史: {json.dumps(game_history, ensure_ascii=False)}\n"
            f"五路特征摘要: {json.dumps(encoded_road_features, ensure_ascii=False) if encoded_road_features else ''}\n"
            f"五路: {json.dumps(encoded_road_data, ensure_ascii=False)}\n"
            f"错题: {json.dumps(encoded_mistakes, ensure_ascii=False)}\n"
        )

    def _build_prompt_with_template(
        self,
        prompt_template: str,
        game_number: int,
        boot_number: int,
        game_history: list[dict[str, Any]],
        road_data: dict[str, Any],
        mistake_context: list[dict[str, Any]],
        consecutive_errors: int,
        road_features: Optional[dict[str, Any]] = None,
    ) -> str:
        encoded_road_data = jsonable_encoder(road_data)
        encoded_road_features = jsonable_encoder(road_features) if road_features else None
        encoded_mistakes = jsonable_encoder(mistake_context)
        rendered = (
            prompt_template
            .replace("{{BOOT_NUMBER}}", str(boot_number))
            .replace("{{GAME_NUMBER}}", str(game_number))
            .replace("{{CONSECUTIVE_ERRORS}}", str(consecutive_errors))
            .replace("{{GAME_HISTORY}}", json.dumps(game_history, ensure_ascii=False))
            .replace("{{ROAD_FEATURES}}", json.dumps(encoded_road_features, ensure_ascii=False) if encoded_road_features else "")
            .replace("{{ROAD_DATA}}", json.dumps(encoded_road_data, ensure_ascii=False))
            .replace("{{MISTAKE_CONTEXT}}", json.dumps(encoded_mistakes, ensure_ascii=False))
        )
        return rendered

    async def _call_model(self, prompt: str) -> str:
        if not settings.SINGLE_AI_API_KEY:
            return json.dumps(
                {
                    "final_prediction": "庄",
                    "confidence": 0.5,
                    "bet_tier": "标准",
                    "summary": "单 AI 模式未配置访问密钥，当前返回演示结果",
                    "reasoning_points": ["单 AI 模式未配置访问密钥，当前为演示输出"],
                    "reasoning_detail": "单 AI 模式未配置访问密钥，因此暂时无法调用模型进行推理。本次展示为演示结果，仅用于流程联调。",
                },
                ensure_ascii=False,
            )

        base_url = settings.SINGLE_AI_API_BASE or "https://api.deepseek.com/v1"
        url = f"{base_url.rstrip('/')}/chat/completions"

        payload = {
            "model": settings.SINGLE_AI_MODEL,
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": 900,
            "temperature": 0.2,
        }
        base = base_url.lower()
        model = (settings.SINGLE_AI_MODEL or "").lower()
        if "deepseek" in base or model.startswith("deepseek-"):
            thinking = getattr(settings, "SINGLE_AI_THINKING", "enabled")
            if thinking in ("enabled", "disabled"):
                payload["thinking"] = {"type": thinking}

        timeout = aiohttp.ClientTimeout(total=30.0)
        last_error: Exception | None = None
        for attempt in range(5):
            try:
                async with aiohttp.ClientSession(timeout=timeout) as session:
                    async with session.post(
                        url,
                        headers={
                            "Authorization": f"Bearer {settings.SINGLE_AI_API_KEY}",
                            "Content-Type": "application/json",
                        },
                        json=payload,
                    ) as response:
                        if response.status == 429 or response.status >= 500:
                            raise Exception(f"upstream error: {response.status}")
                        if response.status != 200:
                            raise Exception(f"upstream error: {response.status} {await response.text()}")
                        data = await response.json()
                        return data["choices"][0]["message"]["content"]
            except Exception as e:
                last_error = e
                await asyncio.sleep(min(1.0 * (2**attempt), 10.0))

        return json.dumps(
            {
                "final_prediction": "庄",
                "confidence": 0.0,
                "bet_tier": "保守",
                "summary": f"单 AI 模式调用失败: {str(last_error)[:200]}",
                "reasoning_points": ["上游接口调用失败，已触发安全降级输出"],
                "reasoning_detail": f"单 AI 模式调用上游接口失败，因此无法获得完整推理结果。错误摘要：{str(last_error)[:200]}",
            },
            ensure_ascii=False,
        )

    async def _call_raw(self, prompt: str) -> str:
        if not settings.SINGLE_AI_API_KEY:
            return "单 AI 模式未配置访问密钥，无法提取实时策略。"

        base_url = settings.SINGLE_AI_API_BASE or "https://api.deepseek.com/v1"
        url = f"{base_url.rstrip('/')}/chat/completions"
        payload = {
            "model": settings.SINGLE_AI_MODEL,
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": 700,
            "temperature": 0.2,
        }
        base = base_url.lower()
        model = (settings.SINGLE_AI_MODEL or "").lower()
        if "deepseek" in base or model.startswith("deepseek-"):
            thinking = getattr(settings, "SINGLE_AI_THINKING", "enabled")
            if thinking in ("enabled", "disabled"):
                payload["thinking"] = {"type": thinking}

        timeout = aiohttp.ClientTimeout(total=30.0)
        last_error: Exception | None = None
        for attempt in range(5):
            try:
                async with aiohttp.ClientSession(timeout=timeout) as session:
                    async with session.post(
                        url,
                        headers={
                            "Authorization": f"Bearer {settings.SINGLE_AI_API_KEY}",
                            "Content-Type": "application/json",
                        },
                        json=payload,
                    ) as response:
                        if response.status == 429 or response.status >= 500:
                            raise Exception(f"upstream error: {response.status}")
                        if response.status != 200:
                            raise Exception(f"upstream error: {response.status} {await response.text()}")
                        data = await response.json()
                        text = data["choices"][0]["message"]["content"]
                        return text.replace("```", "").strip()
            except Exception as e:
                last_error = e
                await asyncio.sleep(min(1.0 * (2**attempt), 10.0))

        return f"未能成功提取实时策略：{str(last_error)[:200]}"

    def _parse_model_json(self, text: str) -> Dict[str, Any]:
        try:
            return json.loads(text)
        except Exception:
            start = text.find("{")
            end = text.rfind("}")
            if start >= 0 and end > start:
                try:
                    return json.loads(text[start : end + 1])
                except Exception:
                    pass
        return {"final_prediction": "庄", "confidence": 0.0, "bet_tier": "保守", "summary": "解析失败"}
