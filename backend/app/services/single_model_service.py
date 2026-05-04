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

        return {
            "combined_model": combined_model,
            "banker_model": {"summary": ""},
            "player_model": {"summary": ""},
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
                    "summary": "单AI模式未配置接口密钥，返回模拟结果",
                    "reasoning_points": ["单AI模式未配置接口密钥，当前为模拟输出"],
                    "reasoning_detail": "单AI模式未配置接口密钥，因此无法调用模型进行推理。本次展示为模拟结果，仅用于流程联调。",
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
                "summary": f"单AI模式调用失败: {str(last_error)[:200]}",
                "reasoning_points": ["上游接口调用失败，已触发安全降级输出"],
                "reasoning_detail": f"单AI模式调用上游接口失败，因此无法获得完整推理结果。错误摘要：{str(last_error)[:200]}",
            },
            ensure_ascii=False,
        )

    async def _call_raw(self, prompt: str) -> str:
        if not settings.SINGLE_AI_API_KEY:
            return "单AI模式未配置接口密钥，无法提取实时策略。"

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
