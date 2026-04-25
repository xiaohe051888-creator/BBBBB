const fs = require('fs');
let code = fs.readFileSync('/workspace/frontend/src/components/dashboard/DashboardHeader.tsx', 'utf8');

code = code.replace(/当前进度/g, '最新开奖');
code = code.replace(/预测下一局/g, '下局预测');

// Make them larger
code = code.replace(/padding: '4px 16px'/g, "padding: '6px 20px'");
code = code.replace(/fontSize: 16, fontWeight: 700/g, "fontSize: 20, fontWeight: 700");
code = code.replace(/fontSize: 12, fontWeight: 500/g, "fontSize: 13, fontWeight: 500");

// Limit to 72 and replace ? background logic
// I will just write a custom script to replace the whole block

fs.writeFileSync('/workspace/frontend/src/components/dashboard/DashboardHeader.tsx', code);
