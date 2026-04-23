import re

with open('/workspace/frontend/src/pages/UploadPage.tsx', 'r') as f:
    content = f.read()

replacement = """    let currentStatus = '';
    try {
      const stateRes = await api.getSystemState();
      if (stateRes.data) {
        currentStatus = stateRes.data.status;
        if (currentStatus !== '空闲') {
          hasActiveGame = true;
        }
      }
    } catch {
      // 静默处理，继续上传流程
    }

    if (currentStatus === '深度学习中') {
      Modal.warning({
        title: '正在深度学习',
        content: '上一靴的数据正在进行AI深度学习总结，请耐心等待其完成（约30秒~1分钟）后再提交新靴数据。',
      });
      return;
    }"""

content = re.sub(r'    let currentStatus = \'\';\n    try {\n      const stateRes = await api\.getSystemState\(\);\n      if \(stateRes\.data && stateRes\.data\.status !== \'空闲\'\) {\n        hasActiveGame = true;\n        currentStatus = stateRes\.data\.status;\n      }\n    } catch {\n      // 静默处理，继续上传流程\n    }', replacement, content, flags=re.DOTALL)

with open('/workspace/frontend/src/pages/UploadPage.tsx', 'w') as f:
    f.write(content)
