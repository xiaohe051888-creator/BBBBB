# scripts/ — 开发辅助脚本目录

此目录存放开发过程中产生的**调试脚本、测试脚本、修复脚本和临时报告**。

这些文件**不是生产代码**，仅供开发参考使用。

## 文件说明

| 文件 | 说明 |
|------|------|
| `debug_config_loading.py` | 调试配置加载时序问题 |
| `deep_analysis.py` | 深度分析脚本 |
| `final_ai_check.py` | AI 配置最终验证 |
| `fix_admin_password.py` | 管理员密码修复脚本 |
| `fix_ai_learning.py` | AI 学习 API 修复 |
| `fix_three_model_service.py` | 三模型服务修复 |
| `verify_ai_config.py` | AI API 密钥配置验证 |
| `test_*.py` | 各模块功能测试脚本 |
| `*.md / *.json` | 开发过程中产生的分析报告 |

## 注意

- 这些脚本已列入 `.gitignore`，不会提交到 GitHub（仅本地保留）
- 如需运行，在 `backend/` 目录下执行，确保已激活虚拟环境
