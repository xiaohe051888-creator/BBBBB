"""
百家乐分析预测系统 - 后端启动入口
"""
import os
from dotenv import load_dotenv

# ========== 第一步：必须先加载环境变量 ==========
# 在导入任何其他模块之前加载 .env，确保 settings 能读取到环境变量
env_path = os.path.join(os.path.dirname(__file__), '.env')
if os.path.exists(env_path):
    load_dotenv(env_path, override=True)  # override=True 确保覆盖已存在的环境变量
    print(f"✅ 已加载环境变量: {env_path}")
else:
    print(f"⚠️  环境变量文件不存在: {env_path}")

# ========== 第二步：导入其他模块 ==========
import uvicorn
from app.core.config import settings

if __name__ == "__main__":
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
