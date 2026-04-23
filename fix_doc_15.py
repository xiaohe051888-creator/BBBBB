with open('/workspace/docs/15-启动页登录与管理员页面.md', 'r') as f:
    content = f.read()

content = content.replace('启动页登录与管理员页面', '登录与管理员页面')
content = content.replace('启动页右上角', '首页顶部')
content = content.replace('启动页到首页流程\n- 用户在启动页选择桌子并点击启动后，立即进入前端首页。\n- 进入首页同时自动触发智能选模流程（若存在可用模型版本）。', '进入系统流程\n- 用户直接进入首页（原启动页与桌台选择已移除）。\n- 上传新靴数据时自动触发智能选模流程（若存在可用模型版本）。')

with open('/workspace/docs/15-登录与管理员页面.md', 'w') as f:
    f.write(content)
