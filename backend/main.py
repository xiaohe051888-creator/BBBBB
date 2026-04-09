"""
百家乐分析预测系统 - 后端启动入口
"""
import os
from dotenv import load_dotenv
import uvicorn
from app.core.config import settings

# 加载环境变量
def load_environment():
    """加载环境变量配置"""
    env_path = os.path.join(os.path.dirname(__file__), '.env')
    if os.path.exists(env_path):
        load_dotenv(env_path)
        print(f"✅ 已加载环境变量: {env_path}")
    else:
        print(f"⚠️  环境变量文件不存在: {env_path}")

if __name__ == "__main__":
    # 先加载环境变量
    load_environment()
    
    print(f"\n🚀 {settings.APP_NAME} v{settings.APP_VERSION}")
    print(f"   后端服务启动中...\n")
    
    # 打印AI模型配置
    print("🔧 AI模型配置:")
    print(f"   庄模型(OpenAI): {'✅ 已配置' if settings.ENABLE_OPENAI_MODEL else '❌ 未配置'}")
    print(f"   闲模型(Anthropic): {'✅ 已配置' if settings.ENABLE_ANTHROPIC_MODEL else '❌ 未配置'}")
    print(f"   综合模型(Gemini): {'✅ 已配置' if settings.ENABLE_GEMINI_MODEL else '❌ 未配置'}")
    print()
    
    uvicorn.run(
        "app.api.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
    )
