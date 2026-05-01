from __future__ import annotations

from typing import Any


def format_reasoning_detail(
    mode: str,
    combined_model: dict[str, Any],
    banker_summary: str = "",
    player_summary: str = "",
) -> tuple[list[str], str]:
    prediction = combined_model.get("final_prediction") or combined_model.get("prediction") or ""
    tier = combined_model.get("bet_tier") or ""
    confidence = combined_model.get("confidence")
    summary = combined_model.get("summary") or ""

    def _as_lines(v: Any) -> list[str]:
        if not v:
            return []
        if isinstance(v, list):
            return [str(x).strip() for x in v if str(x).strip()]
        if isinstance(v, str):
            s = v.strip()
            return [s] if s else []
        return [str(v).strip()] if str(v).strip() else []

    points = _as_lines(combined_model.get("reasoning_points"))
    if not points:
        candidate = []
        candidate += _as_lines(combined_model.get("evidence_comparison"))
        candidate += _as_lines(combined_model.get("bloodstain_analysis"))
        candidate += _as_lines(combined_model.get("pattern_assessment"))
        candidate += _as_lines(combined_model.get("adaptation_strategy"))
        candidate += _as_lines(combined_model.get("conflict_handling"))
        points = candidate
    points = points[:6]

    if mode == "ai":
        shape = combined_model.get("pattern_assessment") or "综合模型已完成盘面形态识别。"
        resonance_items = []
        ev = combined_model.get("evidence_comparison")
        if ev:
            resonance_items.append(str(ev).strip())
        ad = combined_model.get("adaptation_strategy")
        if ad:
            resonance_items.append(str(ad).strip())
        if not resonance_items:
            resonance_items = points
        resonance = "\n".join(f"- {x}" for x in resonance_items[:6]) if resonance_items else "无"

        risk_items = []
        blood = combined_model.get("bloodstain_analysis")
        if blood:
            risk_items.append(str(blood).strip())
        conflict = combined_model.get("conflict_handling")
        if conflict:
            risk_items.append(str(conflict).strip())
        risk = "\n".join(f"- {x}" for x in risk_items[:6]) if risk_items else "无"

    elif mode == "single_ai":
        shape = "单AI基于当前靴的全量历史与五路结构识别盘面形态，并进行单模型推理。"
        resonance = "\n".join(f"- {x}" for x in points[:6]) if points else "无"
        risk_items = []
        if tier == "保守":
            risk_items.append("当前风险偏高，已建议使用保守档控制波动。")
        if isinstance(confidence, (int, float)) and confidence < 0.6:
            risk_items.append("置信度偏低，建议谨慎或适当降低仓位。")
        risk = "\n".join(f"- {x}" for x in risk_items[:6]) if risk_items else "无"
    else:
        shape = "规则引擎基于五路形态与近期反馈进行推演。"
        resonance = "\n".join(f"- {x}" for x in points[:6]) if points else "无"
        risk_items = []
        if tier == "保守":
            risk_items.append("系统判定风险上升，进入保守防守策略。")
        risk = "\n".join(f"- {x}" for x in risk_items[:6]) if risk_items else "无"

    conf_text = ""
    if isinstance(confidence, (int, float)):
        conf_text = f"{confidence:.0%}"
    conclusion_lines = []
    if prediction:
        conclusion_lines.append(f"方向：{prediction}")
    if tier:
        conclusion_lines.append(f"档位：{tier}")
    if conf_text:
        conclusion_lines.append(f"置信度：{conf_text}")

    if not summary and mode == "ai":
        summary = (combined_model.get("summary") or "").strip()
    if not summary and mode == "rule":
        if prediction == "庄":
            summary = banker_summary
        elif prediction == "闲":
            summary = player_summary

    conclusion = " | ".join(conclusion_lines) + (f"\n{summary}".strip() if summary else "")
    if not conclusion.strip():
        conclusion = "无"

    detail = (
        f"【形态识别】\n{shape}\n\n"
        f"【共振信号】\n{resonance}\n\n"
        f"【风险提示】\n{risk}\n\n"
        f"【结论与档位】\n{conclusion}"
    )

    return points, detail

