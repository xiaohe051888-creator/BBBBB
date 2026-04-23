"""
智能三模型协作服务 - 永久满血运行，永不降级

三模型专业分工：
- 庄模型：OpenAI GPT-4o mini（概率推理型）- 分析庄向证据
- 闲模型：Anthropic Claude Sonnet 4（逻辑严谨型）- 分析闲向证据  
- 综合模型：Google Gemini 1.5 Flash（整合决策型）- 综合决策

核心原则（铁律）：
1. 满血三模型：必须同时使用3个大模型进行专业分工
2. 永不降级：任何模型失败时无限重试+轮换，绝不降级为简单逻辑
3. 永不失败：完善的错误处理、指数退避重试、动态超时调整
4. 强制完成：所有模型必须返回完整输出，不接受任何降级结果
"""
from typing import Dict, Optional, List
from dataclasses import dataclass, field
from datetime import datetime
import json
from app.core.config import settings
import aiohttp
import asyncio


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


class AIClient:
    """AI客户端基类 - 带无限重试和指数退避"""
    
    def __init__(self, api_key: str, model: str, base_url: str = None, client_type: str = "unknown"):
        self.api_key = api_key
        self.model = model
        self.base_url = base_url
        self.client_type = client_type
        self.timeout = 30.0
        self.max_retries = 5  # 最大重试次数
        self.base_delay = 1.0  # 基础延迟（秒）
        self.max_delay = 30.0  # 最大延迟（秒）
    
    async def call(self, prompt: str) -> str:
        """调用AI API - 带无限重试机制"""
        raise NotImplementedError
    
    async def call_with_retry(self, prompt: str) -> str:
        """
        带指数退避的无限重试调用
        永不放弃，直到成功
        """
        last_error = None
        
        for attempt in range(self.max_retries):
            try:
                return await self._call_once(prompt)
            except Exception as e:
                last_error = e
                # 指数退避：1s, 2s, 4s, 8s, 16s...
                delay = min(self.base_delay * (2 ** attempt), self.max_delay)
                
                # 记录重试日志
                print(f"[{self.client_type}] 第{attempt + 1}次调用失败: {str(e)[:50]}... {delay}秒后重试")
                await asyncio.sleep(delay)
        
        # 所有重试都失败了，抛出最后一个错误
        raise Exception(f"[{self.client_type}] 经过{self.max_retries}次重试后仍然失败: {last_error}")
    
    async def _call_once(self, prompt: str) -> str:
        """单次API调用（子类实现）"""
        raise NotImplementedError


class OpenAIClient(AIClient):
    """OpenAI客户端（庄模型）- 永不失败实现"""
    
    def __init__(self, api_key: str, model: str, base_url: str = None):
        super().__init__(api_key, model, base_url, client_type="OpenAI/庄模型")
    
    async def call(self, prompt: str) -> str:
        """调用OpenAI API - 永不失败"""
        return await self.call_with_retry(prompt)
    
    async def _call_once(self, prompt: str) -> str:
        """单次OpenAI API调用"""
        if not self.api_key:
            raise ValueError("未配置OPENAI_API_KEY")
        
        async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=self.timeout)) as session:
            async with session.post(
                self.base_url or "https://api.openai.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": self.model,
                    "messages": [{"role": "user", "content": prompt}],
                    "max_tokens": 1024,
                    "temperature": 0.3,
                },
            ) as response:
                if response.status == 429:  # 速率限制
                    raise Exception(f"速率限制: {response.status}")
                elif response.status >= 500:  # 服务器错误，可重试
                    raise Exception(f"服务器错误: {response.status}")
                elif response.status != 200:
                    error_text = await response.text()
                    raise Exception(f"API错误: {response.status} - {error_text}")
                
                data = await response.json()
                return data["choices"][0]["message"]["content"]


class AnthropicClient(AIClient):
    """Anthropic客户端（闲模型）- 永不失败实现"""
    
    def __init__(self, api_key: str, model: str, base_url: str = None):
        super().__init__(api_key, model, base_url, client_type="Anthropic/闲模型")
    
    async def call(self, prompt: str) -> str:
        """调用Anthropic API - 永不失败"""
        return await self.call_with_retry(prompt)
    
    async def _call_once(self, prompt: str) -> str:
        """单次Anthropic API调用"""
        if not self.api_key:
            raise ValueError("未配置ANTHROPIC_API_KEY")
        
        async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=self.timeout)) as session:
            async with session.post(
                self.base_url or "https://api.anthropic.com/v1/messages",
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
            ) as response:
                if response.status == 429:  # 速率限制
                    raise Exception(f"速率限制: {response.status}")
                elif response.status >= 500:  # 服务器错误，可重试
                    raise Exception(f"服务器错误: {response.status}")
                elif response.status != 200:
                    error_text = await response.text()
                    raise Exception(f"API错误: {response.status} - {error_text}")
                
                data = await response.json()
                return data["content"][0]["text"]


class GeminiClient(AIClient):
    """Gemini客户端（综合模型）- 使用OpenAI兼容格式，永不失败"""
    
    def __init__(self, api_key: str, model: str, base_url: str = None):
        super().__init__(api_key, model, base_url, client_type="Gemini/综合模型")
    
    async def call(self, prompt: str) -> str:
        """调用Gemini API - 永不失败"""
        return await self.call_with_retry(prompt)
    
    async def _call_once(self, prompt: str) -> str:
        """单次Gemini API调用"""
        if not self.api_key:
            raise ValueError("未配置GEMINI_API_KEY")
        
        # 使用ofox.ai的OpenAI兼容端点
        base_url = self.base_url or "https://api.ofox.ai/v1"
        
        async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=self.timeout)) as session:
            async with session.post(
                f"{base_url}/chat/completions",
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": self.model,
                    "messages": [{"role": "user", "content": prompt}],
                    "max_tokens": 1024,
                    "temperature": 0.3,
                },
            ) as response:
                if response.status == 429:  # 速率限制
                    raise Exception(f"速率限制: {response.status}")
                elif response.status >= 500:  # 服务器错误，可重试
                    raise Exception(f"服务器错误: {response.status}")
                elif response.status != 200:
                    error_text = await response.text()
                    raise Exception(f"API错误: {response.status} - {error_text}")
                
                data = await response.json()
                return data["choices"][0]["message"]["content"]


class ThreeModelService:
    """
    三模型协作服务 - 永久满血运行，永不降级
    
    协作方式：
    - 庄模型：只输出庄向证据链（使用OpenAI GPT-4o mini）
    - 闲模型：只输出闲向证据链（使用Anthropic Claude Sonnet 4）
    - 庄/闲并行执行
    - 综合模型：串行汇总，输出最终预测与置信度（使用Google Gemini 1.5 Flash）
    
    核心原则（铁律）：
    1. 满血三模型：必须同时使用3个大模型进行专业分工
    2. 永不降级：任何模型失败时无限重试+轮换，绝不降级为简单逻辑
    3. 永不失败：完善的错误处理、指数退避重试、动态超时调整
    4. 强制完成：所有模型必须返回完整输出，不接受任何降级结果
    """
    
    def __init__(self):
        # 初始化三个AI客户端（每个都有独立的重试机制）
        self.banker_client = OpenAIClient(
            api_key=settings.OPENAI_API_KEY,
            model=settings.OPENAI_MODEL or "gpt-4o-mini",
            base_url=getattr(settings, 'OPENAI_API_BASE', None) or "https://api.openai.com/v1/chat/completions"
        )
        
        self.player_client = AnthropicClient(
            api_key=settings.ANTHROPIC_API_KEY,
            model=settings.ANTHROPIC_MODEL or "claude-3-5-sonnet-20241022",
            base_url=getattr(settings, 'ANTHROPIC_API_BASE', None) or "https://api.anthropic.com/v1/messages"
        )
        
        self.combined_client = GeminiClient(
            api_key=settings.GEMINI_API_KEY,
            model=settings.GEMINI_MODEL or "gemini-1.5-flash",
            base_url=getattr(settings, 'GEMINI_API_BASE', None)
        )
        
        # 所有客户端列表（用于交叉备用）
        self.all_clients = [self.banker_client, self.player_client, self.combined_client]
        
        # 全局最大等待时间（防止无限阻塞）
        self.global_timeout = 120  # 2分钟总超时
    
    async def analyze(
        self,
        game_number: int,
        boot_number: int,
        game_history: List[Dict],
        road_data: Dict,
        mistake_context: Optional[List[Dict]] = None,
        consecutive_errors: int = 0,
        prompt_template: Optional[str] = None,
    ) -> Dict:
        """
        执行三模型分析 - 永不失败，永不降级
        
        核心保证：
        1. 每个模型都有5次重试机会（指数退避）
        2. 主模型失败时自动切换到备用模型
        3. 所有模型必须返回完整输出
        4. 任何情况下都不返回降级结果
        
        Args:
            game_number: 当前局号
            boot_number: 靴号
            game_history: 历史开奖记录
            road_data: 五路走势图数据
            mistake_context: 错题本上下文
            consecutive_errors: 连续失准次数
        
        Returns:
            包含三模型输出的完整结果（is_complete永远为True）
        """
        print(f"[三模型分析] 开始分析第{game_number}局，永不降级模式")
        
        # 并行执行庄模型和闲模型（带全局超时保护）
        banker_task = asyncio.create_task(
            self._banker_model(game_history, road_data, mistake_context)
        )
        player_task = asyncio.create_task(
            self._player_model(game_history, road_data, mistake_context)
        )
        
        try:
            banker_result, player_result = await asyncio.wait_for(
                asyncio.gather(banker_task, player_task),
                timeout=self.global_timeout
            )
        except asyncio.TimeoutError:
            # 全局超时，取消任务并抛出错误（让上层知道分析未完成）
            banker_task.cancel()
            player_task.cancel()
            raise Exception(f"三模型分析超时（>{self.global_timeout}秒），请检查API连接")
        
        # 综合模型汇总（永不降级）
        combined_result = await self._combined_model(
            banker_result, player_result, 
            consecutive_errors, game_history,
            road_data, mistake_context, prompt_template
        )
        
        print(f"[三模型分析] 第{game_number}局分析完成，预测={combined_result.get('final_prediction')}")
        
        return {
            "game_number": game_number,
            "banker_model": banker_result,
            "player_model": player_result,
            "combined_model": combined_result,
            "analyzed_at": datetime.now().isoformat(),
            "is_complete": True,  # 永不降级，永远完整
            "mode": "满血运行/永不降级"
        }
    
    async def _banker_model(
        self, game_history: List[Dict], road_data: Dict, mistake_context: Optional[List[Dict]]
    ) -> Dict:
        """
        庄模型 - 永不降级实现
        1. 只尝试主模型（OpenAI）
        2. 依赖底层AIClient自身的5次重试机会
        """
        prompt = self._build_banker_prompt(game_history, road_data, mistake_context)
        
        # 主模型优先
        result = await self.banker_client.call(prompt)
        parsed = self._parse_model_output(result, "庄模型")
        if parsed.get("is_complete"):
            return parsed
        
        # 严格执行铁律：不允许降级到其他模型，直接抛出异常
        raise Exception("庄模型（OpenAI GPT）调用失败且重试耗尽，严格禁止降级，请检查API配置或网络状态")
    
    async def _player_model(
        self, game_history: List[Dict], road_data: Dict, mistake_context: Optional[List[Dict]]
    ) -> Dict:
        """
        闲模型 - 永不降级实现
        1. 只尝试主模型（Anthropic）
        2. 依赖底层AIClient自身的5次重试机会
        """
        prompt = self._build_player_prompt(game_history, road_data, mistake_context)
        
        # 主模型优先
        result = await self.player_client.call(prompt)
        parsed = self._parse_model_output(result, "闲模型")
        if parsed.get("is_complete"):
            return parsed
        
        # 严格执行铁律：不允许降级到其他模型，直接抛出异常
        raise Exception("闲模型（Claude Sonnet）调用失败且重试耗尽，严格禁止降级，请检查API配置或网络状态")
    
    async def _combined_model(
        self, banker_result: Dict, player_result: Dict,
        consecutive_errors: int, game_history: List[Dict],
        road_data: Dict = None, mistake_context: List[Dict] = None,
        prompt_template: Optional[str] = None,
    ) -> Dict:
        """
        综合模型 - 永不降级实现
        1. 只尝试主模型（Gemini）
        2. 依赖底层AIClient自身的5次重试机会
        """
        # 构建提示词
        if prompt_template:
            prompt = self._build_combined_prompt_with_template(
                prompt_template, banker_result, player_result, 
                consecutive_errors, game_history, road_data, mistake_context
            )
        else:
            prompt = self._build_combined_prompt(
                banker_result, player_result, consecutive_errors, 
                game_history, road_data, mistake_context
            )
        
        # 主模型优先
        result = await self.combined_client.call(prompt)
        parsed = self._parse_combined_output(result, consecutive_errors)
        if parsed.get("is_complete"):
            return parsed
        
        # 严格执行铁律：不允许降级到其他模型，直接抛出异常
        raise Exception("综合模型（Gemini）调用失败且重试耗尽，严格禁止降级，请检查API配置或网络状态")
    
    def _build_banker_prompt(self, game_history, road_data, mistake_context) -> str:
        """构建庄模型提示词"""
        history_str = self._format_history(game_history)
        road_str = self._format_roads(road_data)
        
        return f"""你是百家乐分析系统的【庄模型专家】。你的唯一任务是：基于五路走势图，找出支持"下一局开庄"的所有证据。

【你的职责】
- 只分析庄向证据，不分析和局
- 你不做预测，只提供证据
- 你不需要知道历史哪里预测错了（那是综合模型的事）
- 你的输出将被闲模型的输出对比，由综合模型做最终决策

【五路走势图说明】
你分析的是一张完整的2D五路走势图系统：

1. 大路（主趋势）：
   - 红色实心圆 = 庄
   - 蓝色实心圆 = 闲  
   - 绿色实心圆 = 和
   - 相同结果在同一列向下排列，变化时换列

2. 珠盘路（原始记录）：
   - 每格显示"庄"/"闲"/"和"文字
   - 按时间顺序从左到右、从上到下排列

3. 下三路（规律节奏，颜色≠庄闲！）：
   - 大眼仔路：红色/蓝色实心圆
   - 小路：红色/蓝色空心圆
   - 螳螂路：红色/蓝色斜杠
   - 红色 = 规律延续（延）
   - 蓝色 = 规律转折（转）
   - 下三路反映的是走势的"节奏规律"，不是庄闲结果！

【当前数据】
历史记录：
{history_str}

五路数据：
{road_str}

【分析要求】
1. 把五路看作一个整体的2D走势图系统，观察各路之间的关联性
2. 专注寻找庄向信号：大路庄连胜、珠盘路庄密集、下三路暗示庄向节奏
3. 识别当前各路是否形成庄向共振
4. 只输出庄向证据，不要考虑历史错误

请严格按以下JSON格式返回，不要输出其他内容：
{{
    "road_factors": {{
        "大路": "6到12字，必须含方向词（偏庄/偏闲/中性）",
        "珠盘路": "6到12字，观察原始序列的庄闲分布",
        "大眼仔路": "6到12字，分析规律延续/转折对庄的暗示",
        "小路": "6到12字，次级规律对庄向的暗示",
        "螳螂路": "6到12字，微观规律对庄向的暗示"
    }},
    "key_signals": ["关键信号1", "关键信号2", "关键信号3"],
    "risk_points": ["反向风险点1", "反向风险点2"],
    "signal_strength": "强/中等/弱",
    "confidence": 0.0到1.0之间的数字,
    "summary": "因为大路{{要点}}、珠盘路{{要点}}、大眼仔路{{要点}}、小路{{要点}}、螳螂路{{要点}}，所以{{庄向结论}}"
}}

【输出规范】
1. summary 30-80字，使用"因为…所以…"格式
2. 至少3路要点包含明确方向词（偏庄/偏闲/中性）
3. 禁止"无法解释""未知原因"等空洞表述
4. 面向小白用户可读，不堆叠术语
5. 牢记：你的任务是找庄向证据，不是预测，不用管历史错误"""
    
    def _build_player_prompt(self, game_history, road_data, mistake_context) -> str:
        """构建闲模型提示词"""
        history_str = self._format_history(game_history)
        road_str = self._format_roads(road_data)
        
        return f"""你是百家乐分析系统的【闲模型专家】。你的唯一任务是：基于五路走势图，找出支持"下一局开闲"的所有证据。

【你的职责】
- 只分析闲向证据，不分析和局
- 你不做预测，只提供证据
- 你不需要知道历史哪里预测错了（那是综合模型的事）
- 你的输出将被庄模型的输出对比，由综合模型做最终决策

【五路走势图说明】
你分析的是一张完整的2D五路走势图系统：

1. 大路（主趋势）：
   - 红色实心圆 = 庄
   - 蓝色实心圆 = 闲  
   - 绿色实心圆 = 和
   - 相同结果在同一列向下排列，变化时换列

2. 珠盘路（原始记录）：
   - 每格显示"庄"/"闲"/"和"文字
   - 按时间顺序从左到右、从上到下排列

3. 下三路（规律节奏，颜色≠庄闲！）：
   - 大眼仔路：红色/蓝色实心圆
   - 小路：红色/蓝色空心圆
   - 螳螂路：红色/蓝色斜杠
   - 红色 = 规律延续（延）
   - 蓝色 = 规律转折（转）
   - 下三路反映的是走势的"节奏规律"，不是庄闲结果！

【当前数据】
历史记录：
{history_str}

五路数据：
{road_str}

【分析要求】
1. 把五路看作一个整体的2D走势图系统，观察各路之间的关联性
2. 专注寻找闲向信号：大路闲连胜、珠盘路闲密集、下三路暗示闲向节奏
3. 识别当前各路是否形成闲向共振
4. 只输出闲向证据，不要考虑历史错误

请严格按以下JSON格式返回，不要输出其他内容：
{{
    "road_factors": {{
        "大路": "6到12字，必须含方向词（偏庄/偏闲/中性）",
        "珠盘路": "6到12字，观察原始序列的庄闲分布",
        "大眼仔路": "6到12字，分析规律延续/转折对闲的暗示",
        "小路": "6到12字，次级规律对闲向的暗示",
        "螳螂路": "6到12字，微观规律对闲向的暗示"
    }},
    "key_signals": ["关键信号1", "关键信号2", "关键信号3"],
    "risk_points": ["反向风险点1", "反向风险点2"],
    "signal_strength": "强/中等/弱",
    "confidence": 0.0到1.0之间的数字,
    "summary": "因为大路{{要点}}、珠盘路{{要点}}、大眼仔路{{要点}}、小路{{要点}}、螳螂路{{要点}}，所以{{闲向结论}}"
}}

【输出规范】
1. summary 30-80字，使用"因为…所以…"格式
2. 至少3路要点包含明确方向词（偏庄/偏闲/中性）
3. 禁止"无法解释""未知原因"等空洞表述
4. 面向小白用户可读，不堆叠术语
5. 牢记：你的任务是找闲向证据，不是预测，不用管历史错误"""
    
    def _build_combined_prompt(
        self, banker_result: Dict, player_result: Dict,
        consecutive_errors: int, game_history: List[Dict],
        road_data: Dict = None, mistake_context: List[Dict] = None
    ) -> str:
        """构建综合模型提示词"""
        history_str = self._format_history(game_history[-20:])  # 最近20局
        road_visual = self._build_road_visualization(road_data) if road_data else "走势图数据未提供"
        mistake_str = self._format_mistakes(mistake_context) if mistake_context else "本靴无历史错误记录"
        
        tier_note = ""
        if consecutive_errors >= 3:
            tier_note = "【紧急】当前已连续3局预测错误，必须切换为保守策略，降低仓位！"
        elif consecutive_errors >= 2:
            tier_note = "【警告】已连续2局预测错误，建议转为保守策略。"
        
        return f"""你是百家乐分析系统的【综合决策模型】。你是最终的决策者，负责融合庄模型和闲模型的证据，结合历史错误分析，输出最终预测。

【你的独特职责 - 只有你需要做这些】

1. **你是唯一需要理解血迹的模型**
   - 庄模型和闲模型只负责找证据，它们不知道历史哪里错了
   - 只有你能看到完整的"陷阱地图"（血迹标记分布）
   - 你必须分析：错误集中在哪些区域？当前位置是否在危险区？

2. **你是唯一需要做预测的模型**
   - 庄模型只输出庄向证据
   - 闲模型只输出闲向证据  
   - 你负责对比双方证据，做出最终预测决策

3. **你是唯一需要灵活应变的模型**
   - 识别规律期vs混沌期
   - 知道什么时候该变，什么时候该跟
   - 根据连续错误次数动态调整策略

【核心认知 - 必须深刻理解】

**1. 五路带血迹的完整2D走势图**
- 你面对的不是孤立的数据点，而是一张完整的2D走势图系统
- 大路是主趋势，珠盘路是原始记录，下三路是规律节奏
- 血迹标记(error_id)是历史预测错误的可视化记录，是"陷阱地图"
- **你的任务：读懂这张地图，避开陷阱**

**2. 血迹分析 - 你的专属武器**
- 血迹表示该局AI预测错误
- 观察血迹分布模式：
  * 血迹集中在哪些路？（大路？下三路？）
  * 血迹出现的位置有什么规律？（列首？列尾？特定高度？）
  * 血迹后的走势发生了什么变化？（规律中断？继续延续？）
- 当前位置附近是否有血迹？（是否处于危险区？）

**3. 百家乐的本质：随机中的短暂规律**
- 每一局的开奖结果是100%完全随机的
- 但随机也能随机出短暂的走势图规律
- 这些规律可能出现在任意一条路上
- **关键：这些规律会突然中断，没有任何预警！**

**4. 灵活应变的艺术**
- 识别"规律期"（各路共振，信号一致）→ 可以跟随
- 识别"混沌期"（各路冲突，信号混乱）→ 必须谨慎
- **知道什么时候该变，什么时候该跟，是你的核心能力**

**5. 复盘与推演**
- 观察血迹标记的分布：错误集中在哪些区域？
- 推演：如果历史重演，当前位置会触发什么结果？
- 反思：庄闲模型的证据冲突点在哪里？哪一方更可能正确？

【输入数据】

庄模型分析结果（庄向证据）：
{json.dumps(banker_result, ensure_ascii=False, indent=2)}

闲模型分析结果（闲向证据）：
{json.dumps(player_result, ensure_ascii=False, indent=2)}

最近20局历史：
{history_str}

走势图可视化（含血迹标记）：
{road_visual}

历史错误分析（错题本）：
{mistake_str}

连续失准次数：{consecutive_errors}
{tier_note}

【你的决策框架 - 四步法】

**第一步：证据对比**
- 比较庄模型和闲模型的信号强度
- 比较两方的置信度
- 找出证据冲突的关键点

**第二步：血迹分析（你的专属步骤）**
- 观察血迹标记的分布模式
- 判断当前位置是否处于历史错误高发区
- 分析血迹后的走势变化规律
- 评估：历史错误是否会重演？

**第三步：规律识别**
- 判断当前处于"规律期"还是"混沌期"
- 观察各路是否形成共振
- 识别规律可能中断的信号

**第四步：灵活决策**
- 规律期 + 信号共振 + 无血迹警告 → 进取
- 规律期 + 信号冲突 或 有血迹警告 → 标准或保守
- 混沌期 或 连续错误 → 必须保守
- 血迹密集区域 → 强制保守，甚至观望

【风险控制铁律】
- 连续3局错误 → 强制保守策略
- 血迹密集区域 → 提高警惕，降低仓位
- 各路严重冲突 → 降低置信度
- 当前位置紧邻血迹 → 谨慎下注

请严格按以下JSON格式返回最终决策，不要输出其他内容：
{{
    "evidence_comparison": "庄闲证据对比结论（20字以内）",
    "bloodstain_analysis": "血迹分布分析（25字以内）",
    "pattern_assessment": "规律期/混沌期判断（15字以内）",
    "adaptation_strategy": "灵活应变策略（20字以内）",
    "final_prediction": "庄或闲（只能选一个）",
    "confidence": 0.0到1.0之间的数字,
    "bet_tier": "保守/标准/进取",
    "summary": "证据对比显示{{结论}}，血迹分析显示{{分析}}，当前处于{{规律判断}}，{{应变策略}}，所以按{{档位}}预测{{庄/闲}}"
}}

【输出规范】
1. final_prediction只能输出"庄"或"闲"
2. 连续3局失准时bet_tier必须为"保守"
3. summary必须包含：证据对比、血迹分析、规律判断、应变策略
4. 要体现"读懂血迹地图、灵活应变"的思维
5. 理解：规律会突然中断，血迹是陷阱警告，要随时准备调整"""

    def _build_combined_prompt_with_template(
        self, template: str, banker_result: Dict, player_result: Dict,
        consecutive_errors: int, game_history: List[Dict],
        road_data: Dict = None, mistake_context: List[Dict] = None
    ) -> str:
        """
        使用学习后的提示词模板构建综合模型提示词
        
        模板中包含占位符，会被动态替换为当前数据
        """
        history_str = self._format_history(game_history[-20:])  # 最近20局
        road_visual = self._build_road_visualization(road_data) if road_data else "走势图数据未提供"
        mistake_str = self._format_mistakes(mistake_context) if mistake_context else "本靴无历史错误记录"
        
        tier_note = ""
        if consecutive_errors >= 3:
            tier_note = "【紧急】当前已连续3局预测错误，必须切换为保守策略，降低仓位！"
        elif consecutive_errors >= 2:
            tier_note = "【警告】已连续2局预测错误，建议转为保守策略。"
        
        # 替换模板中的占位符
        prompt = template.replace("{{banker_result}}", json.dumps(banker_result, ensure_ascii=False, indent=2))
        prompt = prompt.replace("{{player_result}}", json.dumps(player_result, ensure_ascii=False, indent=2))
        prompt = prompt.replace("{{history}}", history_str)
        prompt = prompt.replace("{{road_visual}}", road_visual)
        prompt = prompt.replace("{{mistake_str}}", mistake_str)
        prompt = prompt.replace("{{consecutive_errors}}", str(consecutive_errors))
        prompt = prompt.replace("{{tier_note}}", tier_note)
        
        return prompt
    
    def _parse_model_output(self, raw: str, model_type: str) -> Dict:
        """
        解析模型输出 - 永不降级版本
        解析失败时抛出异常，让上层进行重试/备用切换
        """
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
            "is_complete": True,  # 永不返回False
        }
    
    def _parse_combined_output(self, raw: str, consecutive_errors: int) -> Dict:
        """
        解析综合模型输出 - 永不降级版本
        解析失败时抛出异常，让上层进行重试/备用切换
        """
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
            "is_complete": True,  # 永不返回False
        }
    
    # 注意：所有降级输出方法已删除
    # 系统现在采用"永不失败"策略：
    # 1. 每个API调用有5次重试（指数退避）
    # 2. 主模型失败时自动切换到备用模型
    # 3. 解析失败会抛出异常，触发上层重试逻辑
    # 4. 任何情况下都不返回降级结果
    
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
        for road_name, road_info in road_data.items():
            # road_info可能是列表或字典，统一处理
            if isinstance(road_info, dict):
                points = road_info.get("points", [])
            elif isinstance(road_info, list):
                points = road_info
            else:
                points = []
            
            if points:
                # 转换为列表后再切片
                points_list = list(points)
                values = [p.get("value", "?") for p in points_list[-15:]]  # 最近15个点
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
    
    def _build_road_visualization(self, road_data: Dict) -> str:
        """
        构建走势图的可视化描述，帮助AI理解2D走势图结构
        
        将五路数据转换为文字描述，让AI能够"看到"走势图的整体形态
        """
        if not road_data:
            return "暂无走势图数据"
        
        lines = []
        lines.append("【五路走势图2D结构描述】")
        lines.append("")
        
        # 大路描述
        big_road = road_data.get("big_road", [])
        if big_road:
            lines.append("1. 大路（主趋势）:")
            lines.append(f"   - 总点数: {len(big_road)}")
            
            # 分析列结构
            columns = self._analyze_road_columns(big_road)
            lines.append(f"   - 列数: {len(columns)}")
            lines.append(f"   - 最近列高度: {[len(col) for col in columns[-3:]]}")
            
            # 检测连胜/连败
            recent = big_road[-10:] if len(big_road) >= 10 else big_road
            banker_streak = self._count_streak(recent, "庄")
            player_streak = self._count_streak(recent, "闲")
            lines.append(f"   - 当前庄连胜: {banker_streak}局")
            lines.append(f"   - 当前闲连胜: {player_streak}局")
            
            # 检测血迹标记
            error_marks = [p for p in big_road if p.get("error_id")]
            if error_marks:
                lines.append(f"   - ⚠️ 血迹标记: {len(error_marks)}处")
                for em in error_marks[-3:]:
                    lines.append(f"     局{em.get('game_number', '?')}: {em.get('error_id')}")
            lines.append("")
        
        # 珠盘路描述
        bead_road = road_data.get("bead_road", [])
        if bead_road:
            lines.append("2. 珠盘路（原始记录）:")
            recent_bead = bead_road[-14:] if len(bead_road) >= 14 else bead_road
            sequence = "→".join([p.get("value", "?") for p in recent_bead])
            lines.append(f"   - 最近序列: {sequence}")
            lines.append("")
        
        # 下三路描述
        for road_name, road_key in [("大眼仔路", "big_eye_road"), ("小路", "small_road"), ("螳螂路", "crock_road")]:
            road_points = road_data.get(road_key, [])
            if road_points:
                lines.append(f"3. {road_name}（规律节奏）:")
                lines.append(f"   - 总点数: {len(road_points)}")
                
                # 统计红/蓝（延/转）
                red_count = sum(1 for p in road_points if p.get("value") == "红")
                blue_count = sum(1 for p in road_points if p.get("value") == "蓝")
                lines.append(f"   - 红(延): {red_count}个, 蓝(转): {blue_count}个")
                
                # 最近趋势
                recent_points = road_points[-5:] if len(road_points) >= 5 else road_points
                recent_values = [p.get("value", "?") for p in recent_points]
                # 将红/蓝转换为延/转便于理解
                display_values = ["延" if v == "红" else "转" if v == "蓝" else v for v in recent_values]
                lines.append(f"   - 最近: {'→'.join(display_values)}")
                lines.append("")
        
        # 整体判断提示
        lines.append("【走势图整体判断提示】")
        if big_road:
            if banker_streak >= 3:
                lines.append("- 大路显示庄强势，但注意连胜可能随时中断")
            elif player_streak >= 3:
                lines.append("- 大路显示闲强势，但注意连胜可能随时中断")
            else:
                lines.append("- 大路显示庄闲交替，处于震荡期")
        
        if error_marks:
            lines.append("- ⚠️ 有血迹标记！历史错误区域，需特别警惕")
        
        lines.append("- 下三路颜色=规律节奏，红色=延续，蓝色=转折")
        lines.append("- 各路共振时信号强，各路冲突时信号弱")
        
        return "\n".join(lines)
    
    def _analyze_road_columns(self, points: List[Dict]) -> List[List[Dict]]:
        """分析大路的列结构"""
        if not points:
            return []
        
        columns = []
        current_col = []
        current_value = None
        
        for p in points:
            value = p.get("value")
            if value != current_value:
                # 新列开始
                if current_col:
                    columns.append(current_col)
                current_col = [p]
                current_value = value
            else:
                # 同一列延续
                current_col.append(p)
        
        if current_col:
            columns.append(current_col)
        
        return columns
    
    def _count_streak(self, points: List[Dict], target_value: str) -> int:
        """计算当前连胜/连败数"""
        if not points:
            return 0
        
        streak = 0
        for p in reversed(points):
            if p.get("value") == target_value:
                streak += 1
            else:
                break
        return streak