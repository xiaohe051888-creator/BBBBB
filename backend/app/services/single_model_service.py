from typing import Dict, Any, Optional
import json
import aiohttp
import asyncio

from app.core.config import settings
from fastapi.encoders import jsonable_encoder


class SingleModelService:
    async def analyze(
        self,
        game_number: int,
        boot_number: int,
        game_history: list[dict[str, Any]],
        road_data: dict[str, Any],
        mistake_context: list[dict[str, Any]],
        consecutive_errors: int,
        prompt_template: Optional[str] = None,
    ) -> Dict[str, Any]:
        if prompt_template:
            prompt = self._build_prompt_with_template(
                prompt_template=prompt_template,
                game_number=game_number,
                boot_number=boot_number,
                game_history=game_history,
                road_data=road_data,
                mistake_context=mistake_context,
                consecutive_errors=consecutive_errors,
            )
        else:
            prompt = self._build_prompt(
                game_number=game_number,
                boot_number=boot_number,
                game_history=game_history,
                road_data=road_data,
                mistake_context=mistake_context,
                consecutive_errors=consecutive_errors,
            )

        text = await self._call_model(prompt)
        parsed = self._parse_model_json(text)

        combined_model = {
            "final_prediction": parsed.get("final_prediction") or parsed.get("prediction") or "庄",
            "confidence": float(parsed.get("confidence") or 0.0),
            "bet_tier": parsed.get("bet_tier") or "标准",
            "summary": parsed.get("summary") or "",
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
        encoded_road_data = jsonable_encoder(road_data)
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
    ) -> str:
        encoded_road_data = jsonable_encoder(road_data)
        encoded_mistakes = jsonable_encoder(mistake_context)
        return (
            "你是百家乐分析预测引擎。请基于当前靴的全量历史局与全量五路走势图，预测下一局庄/闲。\n"
            "输出必须是严格 JSON（不要任何额外文字），字段如下：\n"
            '{"final_prediction":"庄或闲","confidence":0-1,"bet_tier":"保守/标准/激进","summary":"一句话摘要"}\n'
            f"靴号: {boot_number}\n"
            f"局号: {game_number}\n"
            f"连续失准: {consecutive_errors}\n"
            f"历史: {json.dumps(game_history, ensure_ascii=False)}\n"
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
    ) -> str:
        encoded_road_data = jsonable_encoder(road_data)
        encoded_mistakes = jsonable_encoder(mistake_context)
        rendered = (
            prompt_template
            .replace("{{BOOT_NUMBER}}", str(boot_number))
            .replace("{{GAME_NUMBER}}", str(game_number))
            .replace("{{CONSECUTIVE_ERRORS}}", str(consecutive_errors))
            .replace("{{GAME_HISTORY}}", json.dumps(game_history, ensure_ascii=False))
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
