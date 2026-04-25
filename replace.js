const fs = require('fs');
let code = fs.readFileSync('/workspace/frontend/src/components/dashboard/DashboardHeader.tsx', 'utf8');

const regex = /\{\/\*\s*2\.\s*已开局信息\s*&\s*下局预测\s*\*\/\}[\s\S]*?\{\/\*\s*右侧组：余额\s*&\s*操作\s*\*\/\}/m;

const replacement = `{/* 2. 已开局信息 & 下局预测 */}
          <div style={{
            display: 'flex',
            alignItems: 'stretch',
            background: 'rgba(255,255,255,0.03)',
            borderRadius: 12,
            border: '1px solid rgba(255,255,255,0.08)',
            padding: '4px',
            gap: 4,
            flexWrap: 'wrap',
          }}>
            {/* 左半部分：最新开奖 */}
            <div style={{ padding: '6px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', letterSpacing: 1 }}>最新开奖</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 20, fontWeight: 700, color: '#fff', fontVariantNumeric: 'tabular-nums' }}>
                  {Math.min(systemState?.game_number || 0, 72)} <span style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.45)' }}>局</span>
                </span>
                {(systemState?.game_number || 0) >= 72 ? (
                  <div style={{
                    background: 'rgba(255,255,255,0.1)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    color: 'rgba(255,255,255,0.6)',
                    fontSize: 14, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                  }}>
                    已结束
                  </div>
                ) : systemState?.current_game_result ? (
                  <div style={{
                    background: systemState.current_game_result === '庄' ? 'rgba(255,77,79,0.2)' : 'rgba(24,144,255,0.2)',
                    border: \`1px solid \${systemState.current_game_result === '庄' ? '#ff4d4f' : '#1890ff'}\`,
                    color: systemState.current_game_result === '庄' ? '#ff4d4f' : '#1890ff',
                    fontSize: 14, fontWeight: 800, padding: '2px 8px', borderRadius: 6,
                  }}>
                    {systemState.current_game_result}
                  </div>
                ) : (
                  <div style={{ width: 28, height: 22, borderRadius: 6, background: 'rgba(255,255,255,0.05)', border: '1px dashed rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 13 }}>?</span>
                  </div>
                )}
              </div>
            </div>

            {/* 分隔符 */}
            <div style={{ width: 1, background: 'rgba(255,255,255,0.1)', margin: '4px 0' }}></div>

            {/* 右半部分：下局预测 */}
            <div className="predict-pulse-container" style={{
              padding: '6px 20px', display: 'flex', alignItems: 'center', gap: 12,
              background: 'rgba(255,215,0,0.08)',
              borderRadius: 8,
              border: '1px solid rgba(255,215,0,0.2)',
              boxShadow: '0 0 15px rgba(255,215,0,0.15) inset'
            }}>
              <span style={{ fontSize: 13, color: '#ffd666', letterSpacing: 1, fontWeight: 600 }}>下局预测</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {(systemState?.game_number || 0) >= 72 ? (
                  <span style={{ fontSize: 16, fontWeight: 800, color: 'rgba(255,215,0,0.8)' }}>
                    本靴结束，请新开一靴
                  </span>
                ) : (
                  <>
                    <span style={{ fontSize: 20, fontWeight: 800, color: '#ffd666', fontVariantNumeric: 'tabular-nums' }}>
                      第 {systemState?.next_game_number || (systemState?.game_number || 0) + 1} <span style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,215,0,0.5)' }}>局</span>
                    </span>
                    {systemState?.predict_direction ? (
                      <div className="predict-result-blink" style={{
                        background: systemState.predict_direction === '庄' ? '#ff4d4f' : systemState.predict_direction === '闲' ? '#1890ff' : '#faad14',
                        color: '#fff', fontSize: 16, fontWeight: 900, padding: '2px 10px', borderRadius: 6,
                        boxShadow: \`0 0 12px \${systemState.predict_direction === '庄' ? 'rgba(255,77,79,0.6)' : systemState.predict_direction === '闲' ? 'rgba(24,144,255,0.6)' : 'rgba(250,173,20,0.6)'}\`
                      }}>
                        {systemState.predict_direction}
                      </div>
                    ) : (
                      <div style={{ width: 32, height: 24, borderRadius: 6, background: 'rgba(255,215,0,0.05)', border: '1px dashed rgba(255,215,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ color: 'rgba(255,215,0,0.4)', fontSize: 14, fontWeight: 800 }}>?</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 右侧组：余额 & 操作 */}`;

if (!regex.test(code)) {
  console.log("Regex did not match!");
}

code = code.replace(regex, replacement);
fs.writeFileSync('/workspace/frontend/src/components/dashboard/DashboardHeader.tsx', code);
