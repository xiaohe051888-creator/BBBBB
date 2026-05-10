import asyncio
import os
import sys
from unittest.mock import AsyncMock, patch
from uuid import uuid4

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.models.schemas import AnalysisOutcome, RoadExplanation
from app.services.game.rule_engine import BaccaratRuleEngine


def test_analysis_outcome_contains_user_facing_fields():
    outcome = AnalysisOutcome(
        direction="庄",
        confidence=0.76,
        confidence_label="中",
        source="single_ai",
        short_reason="当前大路延续更明显，本局建议继续跟庄。",
        final_reason="五条路里三条支持庄，两条偏中性，所以最终偏向庄。",
        road_explanations={
            "big_road": RoadExplanation(
                trend_label="大路连庄",
                tendency="庄",
                support_level="强",
                plain_summary="大路连续走庄，说明主走势还没有明显转向。",
            ),
            "bead_road": RoadExplanation(
                trend_label="珠盘路庄多",
                tendency="庄",
                support_level="中",
                plain_summary="珠盘路最近庄更多，整体仍偏庄。",
            ),
            "big_eye_road": RoadExplanation(
                trend_label="大眼仔偏顺",
                tendency="庄",
                support_level="中",
                plain_summary="大眼仔路保持红色顺势，说明当前延续性还在。",
            ),
            "small_road": RoadExplanation(
                trend_label="小路中性",
                tendency="中性",
                support_level="弱",
                plain_summary="小路没有明显新方向，更多是中性提醒。",
            ),
            "cockroach_road": RoadExplanation(
                trend_label="螳螂路轻微支持庄",
                tendency="庄",
                support_level="弱",
                plain_summary="螳螂路暂时没有看到明显反转，更偏向继续跟庄。",
            ),
        },
    )

    assert outcome.source == "single_ai"
    assert outcome.road_explanations["big_road"].plain_summary.startswith("大路")


def test_rule_engine_builds_user_friendly_road_explanations():
    engine = BaccaratRuleEngine()
    result = engine.analyze(
        game_history=[{"result": "庄"}, {"result": "庄"}, {"result": "庄"}],
        road_data={
            "big_road": [{"value": "庄"}, {"value": "庄"}, {"value": "庄"}],
            "bead_road": [{"value": "庄"}] * 12,
            "big_eye": [{"value": "红"}],
            "small_road": [{"value": "红"}],
            "cockroach_road": [{"value": "蓝"}],
        },
    )

    assert result["source"] == "rule_fallback"
    assert "road_explanations" in result
    assert "final_reason" in result
    assert result["road_explanations"]["big_road"]["plain_summary"]


def test_run_ai_analysis_single_ai_returns_unified_analysis_outcome():
    async def _run():
        from app.core import config as config_module
        from app.core.database import async_session, init_db
        from app.models.schemas import GameRecord
        from app.services.game.analysis import run_ai_analysis
        from app.services.game.session import get_session, get_session_lock

        await init_db()

        boot = int(uuid4().int % 1_000_000_000) + 3000
        async with async_session() as s:
            for i in range(1, 6):
                s.add(GameRecord(boot_number=boot, game_number=i, result="庄"))
            await s.commit()

        lock = get_session_lock()
        async with lock:
            sess = get_session()
            sess.boot_number = boot
            sess.next_game_number = 6
            sess.prediction_mode = "single_ai"

        config_module.settings.SINGLE_AI_API_KEY = "x" * 20
        payload = (
            '{"final_prediction":"闲","confidence":0.9,"bet_tier":"激进",'
            '"summary":"当前主趋势短暂转闲","reasoning_detail":"五路里三路支持闲"}'
        )

        with patch(
            "app.services.single_model_service.SingleModelService._call_model",
            new=AsyncMock(return_value=payload),
        ):
            async with async_session() as s:
                res = await run_ai_analysis(s, boot_number=boot)
                await s.commit()
                return res

    result = asyncio.run(_run())

    assert result["success"] is True
    assert result["prediction"] == "闲"
    assert result["analysis_outcome"]["direction"] == "闲"
    assert result["analysis_outcome"]["source"] == "single_ai"
    assert result["analysis_outcome"]["short_reason"]
