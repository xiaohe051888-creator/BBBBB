import re

with open('/workspace/backend/app/api/routes/game.py', 'r') as f:
    content = f.read()

replacement = """        except Exception as e:
            import logging
            from app.services.game.logging import write_game_log
            from app.services.game.session import broadcast_event
            logging.getLogger("uvicorn.error").error(f"下一局AI分析失败(reveal): {e}", exc_info=True)
            sess.status = "等待开奖"
            try:
                async with async_session() as log_session:
                    await write_game_log(
                        log_session, boot_number, sess.game_number if hasattr(sess, 'game_number') else 0,
                        "LOG-MDL-002", "AI分析异常", "失败",
                        f"触发下一局AI三模型分析失败: {str(e)}",
                        category="系统异常",
                        priority="P1"
                    )
                    await log_session.commit()
                await broadcast_event("state_update", {"status": "等待开奖"})
            except Exception:
                pass"""

content = content.replace("""        except Exception as e:
            import logging
            logging.getLogger("uvicorn.error").error(f"下一局AI分析失败(reveal): {e}", exc_info=True)
            sess.status = "等待开奖\"""", replacement)

with open('/workspace/backend/app/api/routes/game.py', 'w') as f:
    f.write(content)
