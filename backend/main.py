"""
百家乐分析预测系统 - 后端启动入口
"""
import uvicorn
from app.core.config import settings

if __name__ == "__main__":
    print(f"\n🚀 {settings.APP_NAME} v{settings.APP_VERSION}")
    print(f"   后端服务启动中...\n")
    
    uvicorn.run(
        "app.api.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
    )
