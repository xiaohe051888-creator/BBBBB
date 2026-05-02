"""
百家乐分析预测系统 - 后端启动入口
"""
import os
import uvicorn

if __name__ == "__main__":
    host = (os.getenv("HOST") or "0.0.0.0").strip()
    port = int((os.getenv("BACKEND_PORT") or os.getenv("PORT") or "8001").strip())
    reload = (os.getenv("DEBUG") or "").strip().lower() in ("1", "true", "yes")
    uvicorn.run(
        "app.api.main:app",
        host=host,
        port=port,
        reload=reload,
    )
