"""
靴管理模块 - 结束本靴和深度学习
"""
import asyncio
from datetime import datetime
from typing import Dict, Any

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.schemas import GameRecord
from .session import get_session, broadcast_event
from .state import get_or_create_state
from .logging import write_game_log


async def end_boot(
    db: AsyncSession,
) -> Dict[str, Any]:
    """
    结束本靴 - 触发深度学习，完成后才能开始新靴
    """
    sess = get_session()
    
    # 检查是否有待开奖注单
    if sess.pending_bet_direction is not None:
        return {
            "success": False,
            "error": f"第{sess.pending_game_number}局还有待开奖注单，请先开奖",
        }
    
    current_boot = sess.boot_number
    
    # 检查是否有足够数据用于学习
    stmt = select(GameRecord).where(
        GameRecord.boot_number == current_boot,
        GameRecord.result.isnot(None),
    )
    result = await db.execute(stmt)
    games = result.scalars().all()
    
    if len(games) < 5:
        return {
            "success": False,
            "error": f"本靴只有{len(games)}局有效记录，至少需要5局才能进行深度学习",
        }
    
    # 设置状态为深度学习中
    sess.status = "深度学习中"
    sess.deep_learning_status = {
        "boot_number": current_boot,
        "status": "启动中",
        "progress": 0,
        "message": "正在准备学习数据...",
        "start_time": datetime.now().isoformat(),
    }
    
    # 更新系统状态
    state = await get_or_create_state(db)
    state.status = "深度学习中"
    
    await write_game_log(
        db, current_boot, None,
        "LOG-BOOT-001", "结束本靴", "启动深度学习",
        f"第{current_boot}靴结束，共{len(games)}局，启动深度学习",
        category="系统事件",
        priority="P1",
    )
    
    await db.commit()
    
    # 广播深度学习启动
    await broadcast_event("deep_learning_started", {
        "boot_number": current_boot,
        "game_count": len(games),
        "status": "启动中",
        "progress": 0,
        "message": "正在准备学习数据...",
    })
    
    # 异步启动深度学习
    asyncio.create_task(run_deep_learning(db, current_boot))
    
    return {
        "success": True,
        "boot_number": current_boot,
        "game_count": len(games),
        "status": "深度学习中",
        "message": f"第{current_boot}靴深度学习已启动，请等待完成...",
    }


async def run_deep_learning(
    db: AsyncSession,
    boot_number: int,
):
    """
    执行深度学习 - 带进度推送
    """
    sess = get_session()
    
    try:
        from app.services.ai_learning_service import AILearningService
        
        # 更新进度：数据准备
        sess.deep_learning_status["status"] = "数据准备"
        sess.deep_learning_status["progress"] = 10
        sess.deep_learning_status["message"] = "正在收集训练数据..."
        
        await broadcast_event("deep_learning_progress", {
            "boot_number": boot_number,
            "status": "数据准备",
            "progress": 10,
            "message": "正在收集训练数据...",
        })
        
        await asyncio.sleep(1)  # 模拟处理时间
        
        # 更新进度：AI分析
        sess.deep_learning_status["status"] = "AI分析"
        sess.deep_learning_status["progress"] = 30
        sess.deep_learning_status["message"] = "AI正在深度分析错误模式..."
        
        await broadcast_event("deep_learning_progress", {
            "boot_number": boot_number,
            "status": "AI分析",
            "progress": 30,
            "message": "AI正在深度分析错误模式...",
        })
        
        # 执行实际学习
        ai_learning = AILearningService(db)
        
        # 更新进度：AI分析中
        sess.deep_learning_status["status"] = "AI分析"
        sess.deep_learning_status["progress"] = 40
        sess.deep_learning_status["message"] = "AI正在深度分析错误模式..."
        
        await broadcast_event("deep_learning_progress", {
            "boot_number": boot_number,
            "status": "AI分析",
            "progress": 40,
            "message": "AI正在深度分析错误模式...",
        })
        
        # 调用真正的AI深度学习
        result = await ai_learning.start_learning(boot_number)
        
        if not result.success:
            raise Exception(result.error or "深度学习失败")
        
        # 更新进度：生成新版本
        sess.deep_learning_status["status"] = "生成版本"
        sess.deep_learning_status["progress"] = 80
        sess.deep_learning_status["message"] = f"正在生成新版本 {result.version}..."
        
        await broadcast_event("deep_learning_progress", {
            "boot_number": boot_number,
            "status": "生成版本",
            "progress": 80,
            "message": f"新版本 {result.version} 生成中...",
            "version": result.version,
        })
        
        # 更新进度：完成
        sess.deep_learning_status["status"] = "完成"
        sess.deep_learning_status["progress"] = 100
        sess.deep_learning_status["message"] = "深度学习完成，新版本已生成"
        
        # 设置状态为等待新靴
        sess.status = "等待新靴"
        
        # 清空预测缓存
        sess.predict_direction = None
        sess.predict_confidence = None
        sess.predict_bet_tier = None
        sess.predict_bet_amount = None
        sess.banker_summary = None
        sess.player_summary = None
        sess.combined_summary = None
        
        await broadcast_event("deep_learning_completed", {
            "boot_number": boot_number,
            "status": "完成",
            "progress": 100,
            "message": "深度学习完成，可以上传新靴数据了",
        })
        
        await write_game_log(
            db, boot_number, None,
            "LOG-BOOT-002", "深度学习", "完成",
            f"第{boot_number}靴深度学习完成",
            category="AI事件",
            priority="P1",
        )
        
    except Exception as e:
        sess.deep_learning_status["status"] = "失败"
        sess.deep_learning_status["message"] = f"深度学习失败: {str(e)}"
        sess.status = "空闲"
        
        await broadcast_event("deep_learning_failed", {
            "boot_number": boot_number,
            "status": "失败",
            "error": str(e),
        })
        
        await write_game_log(
            db, boot_number, None,
            "LOG-BOOT-003", "深度学习", "失败",
            f"第{boot_number}靴深度学习失败: {str(e)}",
            category="AI事件",
            priority="P0",
        )
