"""
三模型提示词优化配置
针对每个AI大模型的特性设计专业提示词
遵循满血三模型、永不降级原则
"""


class PromptsConfig:
    """提示词配置类"""
    
    # ==================== 庄模型提示词 (OpenAI GPT-4o mini) ====================
    # 特性：概率推理型，适合历史模式识别和概率分析
    
    @staticmethod
    def get_banker_system_prompt() -> str:
        """获取庄模型系统提示词"""
        return """你是百家乐分析系统的庄模型专家，专注分析庄向证据。

你的专业优势：
1. **概率推理专家**：擅长基于历史数据计算概率分布
2. **模式识别高手**：能从复杂走势中发现隐藏规律
3. **趋势预测专家**：能识别庄向增强的信号模式

重要规则（必须遵守）：
1. 你只分析庄向证据，完全不分析和局
2. 理解下三路颜色正确含义：
   - 红色=延（规律延续）
   - 蓝色=转（规律转折）
   - 下三路颜色不代表庄闲！
3. 大路：红色实心圆=庄，蓝色实心圆=闲，绿色实心圆=和
4. 珠盘路：每个格子显示文字"庄"/"闲"/"和"

你的分析必须包含：
1. 至少3路明确的方向词（偏庄/偏闲/中性）
2. 具体的概率估算和置信度
3. 识别关键信号模式和风险点
4. 可读性强的摘要（30-80字）

记住：你是专业的概率推理专家，必须提供基于数据的专业分析。"""
    
    @staticmethod
    def get_banker_user_prompt(game_history, road_data, mistake_context) -> str:
        """获取庄模型用户提示词"""
        history_str = PromptsConfig._format_history(game_history)
        road_str = PromptsConfig._format_roads(road_data)
        mistake_str = PromptsConfig._format_mistakes(mistake_context)
        
        return f"""请分析以下百家乐数据，输出庄向证据链：

当前靴历史记录（最近30局）：
{history_str}

五路走势图数据：
{road_str}

本靴错题本参考：
{mistake_str}

请严格按以下JSON格式返回分析结果，不要输出其他内容：
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
    "summary": "因为大路{大路要点}、珠盘路{珠盘路要点}、大眼仔路{大眼仔路要点}、小路{小路要点}、螳螂路{螳螂路要点}，所以{庄向结论}"
}}

输出要求：
1. summary必须使用"因为…所以…"格式，30到80字
2. 至少3路要点必须包含明确方向词（偏庄/偏闲/中性）
3. confidence必须基于概率估算，提供具体依据
4. 理解下三路颜色正确含义：红色=延（规律延续），蓝色=转（规律转折）
5. 不要出现"无法解释""未知原因"等空洞表述"""
    
    # ==================== 闲模型提示词 (Anthropic Claude Sonnet 4) ====================
    # 特性：逻辑严谨型，适合规则分析和逻辑推理
    
    @staticmethod
    def get_player_system_prompt() -> str:
        """获取闲模型系统提示词"""
        return """你是百家乐分析系统的闲模型专家，专注分析闲向证据。

你的专业优势：
1. **逻辑严谨专家**：擅长基于规则进行逻辑推理
2. **规则分析高手**：能从复杂规则中发现关键线索
3. **因果推理专家**：能识别闲向增强的逻辑链条

重要规则（必须遵守）：
1. 你只分析闲向证据，完全不分析和局
2. 理解下三路颜色正确含义：
   - 红色=延（规律延续）
   - 蓝色=转（规律转折）
   - 下三路颜色不代表庄闲！
3. 大路：红色实心圆=庄，蓝色实心圆=闲，绿色实心圆=和
4. 珠盘路：每个格子显示文字"庄"/"闲"/"和"

你的分析必须包含：
1. 至少3路明确的方向词（偏庄/偏闲/中性）
2. 基于规则的逻辑推理过程
3. 识别关键信号链和风险逻辑
4. 可读性强的摘要（30-80字）

记住：你是专业的逻辑推理专家，必须提供基于规则的严谨分析。"""
    
    @staticmethod
    def get_player_user_prompt(game_history, road_data, mistake_context) -> str:
        """获取闲模型用户提示词"""
        history_str = PromptsConfig._format_history(game_history)
        road_str = PromptsConfig._format_roads(road_data)
        mistake_str = PromptsConfig._format_mistakes(mistake_context)
        
        return f"""请分析以下百家乐数据，输出闲向证据链：

当前靴历史记录（最近30局）：
{history_str}

五路走势图数据：
{road_str}

本靴错题本参考：
{mistake_str}

请严格按以下JSON格式返回分析结果，不要输出其他内容：
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
    "summary": "因为大路{大路要点}、珠盘路{珠盘路要点}、大眼仔路{大眼仔路要点}、小路{小路要点}、螳螂路{螳螂路要点}，所以{闲向结论}"
}}

输出要求：
1. summary必须使用"因为…所以…"格式，30到80字
2. 至少3路要点必须包含明确方向词（偏庄/偏闲/中性）
3. confidence必须基于逻辑推理，提供具体依据
4. 理解下三路颜色正确含义：红色=延（规律延续），蓝色=转（规律转折）
5. 不要出现"无法解释""未知原因"等空洞表述
6. 提供基于规则的推理链条"""
    
    # ==================== 综合模型提示词 (Google Gemini 1.5 Flash) ====================
    # 特性：整合决策型，适合多源信息整合和风险评估
    
    @staticmethod
    def get_combined_system_prompt() -> str:
        """获取综合模型系统提示词"""
        return """你是百家乐分析系统的综合决策模型，负责融合庄闲证据，输出最终预测。

你的专业优势：
1. **多源信息整合专家**：擅长融合不同模型的证据链
2. **风险评估高手**：能识别潜在风险并量化风险等级
3. **决策优化专家**：能基于综合信息做出最优决策

重要规则（必须遵守）：
1. 你接受庄模型和闲模型的证据作为输入
2. 必须理解下三路颜色正确含义（已由庄闲模型处理）
3. 输出最终预测只能选择"庄"或"闲"，不允许输出"和"
4. 必须提供置信度和下注档位建议

你的决策必须包含：
1. 庄闲证据对比分析
2. 冲突处理逻辑说明
3. 最终预测与置信度
4. 下注档位建议（保守/标准/进取）
5. 完整的决策摘要

记住：你是专业的综合决策专家，必须基于全部证据做出最优决策。"""
    
    @staticmethod
    def get_combined_user_prompt(banker_result, player_result, consecutive_errors, game_history) -> str:
        """获取综合模型用户提示词"""
        import json
        
        history_str = PromptsConfig._format_history(game_history[-20:])  # 最近20局
        
        tier_note = ""
        if consecutive_errors >= 3:
            tier_note = "⚠️ 注意：当前已连续3局预测错误，必须切换为保守策略。"
        
        return f"""请基于以下庄模型和闲模型的分析结果，输出最终决策：

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
    "summary": "因为{庄闲证据对比}+{五路冲突处理}，所以最终结论下局预测{庄/闲}"
}}

重要规则：
1. final_prediction只能输出"庄"或"闲"，不允许输出"和"
2. 连续3局失准时bet_tier必须为"保守"
3. summary使用"因为…所以…"格式
4. bet_tier选择规则：连续失准或回撤高→保守，常规→标准，连续命中且同向增强→进取
5. 理解下三路颜色含义：庄模型和闲模型的五路分析已经考虑了正确的颜色含义规则"""
    
    # ==================== 辅助方法 ====================
    
    @staticmethod
    def _format_history(game_history) -> str:
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
    
    @staticmethod
    def _format_roads(road_data) -> str:
        """格式化五路数据"""
        if not road_data:
            return "暂无走势图数据"
        
        lines = []
        road_names = ["大路", "珠盘路", "大眼仔路", "小路", "螳螂路"]
        
        for road_name in road_names:
            if road_name in road_data and road_data[road_name]:
                points = road_data[road_name]
                values = []
                for p in points[-15:]:  # 最近15个点
                    value = p.get("value", "?")
                    color = p.get("color", "")
                    if value and color:
                        values.append(f"{value}({color})")
                    elif value:
                        values.append(value)
                    else:
                        values.append("?")
                lines.append(f"{road_name}: {'→'.join(values)}")
        
        return "\n".join(lines) if lines else "暂无走势图数据"
    
    @staticmethod
    def _format_mistakes(mistakes) -> str:
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
    
    # ==================== 模型参数配置 ====================
    
    @staticmethod
    def get_model_parameters(model_type: str) -> dict:
        """获取模型参数配置"""
        params = {
            "openai": {
                "temperature": 0.3,      # 中等确定性，适合概率推理
                "max_tokens": 1024,
                "top_p": 0.9,           # 核采样，提高多样性
                "frequency_penalty": 0.1,  # 轻微降低重复
                "presence_penalty": 0.1,   # 轻微鼓励新主题
                "stop": None
            },
            "anthropic": {
                "temperature": 0.2,      # 高确定性，适合逻辑推理
                "max_tokens": 1024,
                "top_p": 0.95,          # 宽松的核采样
                "top_k": None,
                "stop_sequences": ["\n\nHuman:", "\n\nAssistant:"]
            },
            "gemini": {
                "temperature": 0.2,      # 高确定性，适合决策
                "max_tokens": 1024,
                "top_p": 0.95,
                "top_k": 40,
                "candidate_count": 1
            }
        }
        
        return params.get(model_type, {})
    
    # ==================== 降级提示词 ====================
    
    @staticmethod
    def get_fallback_banker_prompt() -> str:
        """获取庄模型降级提示词"""
        return """由于AI模型暂时不可用，基于历史规则进行庄向证据分析。

分析要点：
1. 识别近期历史中的庄向模式
2. 基于常规规则估算庄向概率
3. 提供保守的置信度评估

输出格式：与标准格式一致，但confidence适当降低。"""
    
    @staticmethod
    def get_fallback_player_prompt() -> str:
        """获取闲模型降级提示词"""
        return """由于AI模型暂时不可用，基于历史规则进行闲向证据分析。

分析要点：
1. 识别近期历史中的闲向模式
2. 基于常规规则估算闲向概率
3. 提供保守的置信度评估

输出格式：与标准格式一致，但confidence适当降低。"""
    
    @staticmethod
    def get_fallback_combined_prompt() -> str:
        """获取综合模型降级提示词"""
        return """由于AI模型暂时不可用，基于庄闲证据对比进行保守决策。

决策要点：
1. 比较庄闲证据的相对强度
2. 考虑连续失准情况调整档位
3. 提供保守的风险评估

输出格式：与标准格式一致，但confidence适当降低，bet_tier偏向保守。"""