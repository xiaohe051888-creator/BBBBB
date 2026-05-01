import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


class ReasoningDetailTemplateTest(unittest.TestCase):
    def test_single_ai_template_has_four_sections(self):
        from app.services.game.reasoning_format import format_reasoning_detail

        points, detail = format_reasoning_detail(
            mode="single_ai",
            combined_model={
                "final_prediction": "庄",
                "confidence": 0.72,
                "bet_tier": "标准",
                "summary": "因为…所以预测庄",
                "reasoning_points": ["大路偏庄", "下三路共振"],
                "reasoning_detail": "raw",
            },
        )
        self.assertEqual(points, ["大路偏庄", "下三路共振"])
        self.assertIn("【形态识别】", detail)
        self.assertIn("【共振信号】", detail)
        self.assertIn("【风险提示】", detail)
        self.assertIn("【结论与档位】", detail)

    def test_ai_template_has_four_sections(self):
        from app.services.game.reasoning_format import format_reasoning_detail

        _, detail = format_reasoning_detail(
            mode="ai",
            combined_model={
                "final_prediction": "闲",
                "confidence": 0.66,
                "bet_tier": "保守",
                "summary": "证据对比显示…所以…",
                "evidence_comparison": "庄闲证据偏闲",
                "bloodstain_analysis": "血迹提示风险",
                "pattern_assessment": "规律期",
                "adaptation_strategy": "降档防守",
                "conflict_handling": "冲突可控",
            },
        )
        self.assertIn("【形态识别】", detail)
        self.assertIn("【共振信号】", detail)
        self.assertIn("【风险提示】", detail)
        self.assertIn("【结论与档位】", detail)

    def test_rule_template_has_four_sections(self):
        from app.services.game.reasoning_format import format_reasoning_detail

        _, detail = format_reasoning_detail(
            mode="rule",
            combined_model={
                "final_prediction": "庄",
                "confidence": 0.55,
                "bet_tier": "保守",
                "summary": "【强规则引擎模式】\n因为…所以…",
                "reasoning_points": ["大路长龙", "下三路齐红"],
            },
        )
        self.assertIn("【形态识别】", detail)
        self.assertIn("【共振信号】", detail)
        self.assertIn("【风险提示】", detail)
        self.assertIn("【结论与档位】", detail)


if __name__ == "__main__":
    unittest.main()

