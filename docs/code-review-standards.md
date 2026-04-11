# 百家乐分析预测系统 - 代码审查标准与流程

> 版本: v1.0  
> 制定日期: 2026-04-10  
> 适用范围: BBBBB 项目全栈代码

---

## 一、代码审查目标

1. **保证代码质量** - 消除潜在bug，提高代码可维护性
2. **统一代码风格** - 确保团队代码风格一致
3. **知识共享** - 通过审查促进团队成员相互学习
4. **错误可追溯** - 所有错误必须记录到系统状态面板

---

## 二、审查流程

### 2.1 提交前自检清单

开发者在提交PR前必须完成以下检查：

```markdown
## PR 自检清单

### 基础检查
- [ ] 代码可以正常编译/运行，无语法错误
- [ ] 所有测试通过（如有）
- [ ] 无 console.log 调试代码残留
- [ ] 无未使用的导入/变量

### 代码质量
- [ ] 单文件行数符合规范（见第三节）
- [ ] 函数复杂度不超过10
- [ ] 无深层嵌套（不超过4层）
- [ ] 错误处理完善，使用 addIssue 记录错误

### 类型安全
- [ ] TypeScript 无 any 类型（特殊情况需注释说明）
- [ ] 函数参数和返回值类型明确
- [ ] 接口/类型定义完整

### 性能
- [ ] 无 O(n²) 算法（大数据集场景）
- [ ] React Query 配置正确（staleTime: Infinity）
- [ ] 无不必要的重渲染

### 文档
- [ ] 复杂函数添加 JSDoc 注释
- [ ] 新增 API 更新接口文档
- [ ] 修改逻辑更新相关注释
```

### 2.2 PR 审查流程

```
1. 创建 PR → 2. 自动化检查 → 3. 人工审查 → 4. 修改反馈 → 5. 合并
```

**自动化检查（CI）：**
- ESLint 检查（0错误0警告）
- TypeScript 编译检查
- Python 语法检查
- 文件大小检查

**人工审查：**
- 至少1名团队成员审查
- 重点关注业务逻辑正确性
- 检查错误处理是否完善

---

## 三、代码规范标准

### 3.1 文件大小限制

| 类型 | 最大行数 | 说明 |
|------|----------|------|
| Page 组件 | 300行 | 页面级组件，需拆分子组件 |
| 业务组件 | 200行 | 可复用业务组件 |
| UI 组件 | 150行 | 纯展示组件 |
| Hooks | 150行 | 自定义 Hooks |
| 工具函数 | 100行 | utils 文件 |
| Python 模块 | 500行 | 后端模块文件 |

**当前超标文件（需逐步重构）：**
- `DashboardPage.tsx` - 1240行 ⚠️ P0
- `UploadPage.tsx` - 1185行 ⚠️ P0
- `main.py` - 1354行 ⚠️ P0

### 3.2 函数/方法规范

#### 3.2.1 复杂度限制

```typescript
// ❌ 错误：复杂度 > 10
function processData(data: Data) {
  if (condition1) {
    if (condition2) {
      for (const item of items) {
        if (condition3) {
          // ... 多层嵌套
        }
      }
    }
  }
}

// ✅ 正确：拆分小函数
function processData(data: Data) {
  if (!validateData(data)) return;
  return transformItems(data.items);
}
```

**限制标准：**
- 圈复杂度 ≤ 10
- 嵌套深度 ≤ 4层
- 函数长度 ≤ 50行

#### 3.2.2 参数限制

```typescript
// ❌ 错误：参数过多
function createUser(name: string, age: number, email: string, phone: string, address: string) {}

// ✅ 正确：使用参数对象
interface CreateUserParams {
  name: string;
  age: number;
  email: string;
  phone: string;
  address: string;
}
function createUser(params: CreateUserParams) {}
```

**限制标准：**
- 参数数量 ≤ 5个
- 超过3个可选参数需使用配置对象

### 3.3 错误处理规范

**铁律：所有错误必须记录到系统状态面板**

```typescript
// ❌ 错误：静默失败
try {
  await api.placeBet(data);
} catch (error) {
  console.error('下注失败:', error);
}

// ✅ 正确：记录到系统状态
const { addIssue } = useSystemDiagnostics();

try {
  await api.placeBet(data);
} catch (error) {
  const message = error instanceof Error ? error.message : '下注失败';
  addIssue({
    id: `bet-error-${Date.now()}`,
    level: 'critical',
    title: '下注失败',
    detail: message,
    time: new Date(),
    source: 'system',
  });
}
```

**必须记录的错误类型：**
1. 网络请求错误
2. API 调用失败
3. 业务逻辑异常
4. 数据解析错误
5. WebSocket 连接异常

### 3.4 命名规范

#### 3.4.1 前端命名

```typescript
// 组件 - PascalCase
components/
  ├── SystemStatusPanel.tsx
  ├── FiveRoadChart.tsx
  └── RevealModal.tsx

// Hooks - camelCase，use 开头
hooks/
  ├── useSystemDiagnostics.ts
  ├── useGameState.ts
  └── useWebSocket.ts

// 工具函数 - camelCase
utils/
  ├── formatDate.ts
  └── calculateWinRate.ts

// 类型定义 - PascalCase
types/
  ├── road.ts
  └── api.ts
```

#### 3.4.2 后端命名

```python
# 模块 - snake_case
app/
  ├── api/
  │   ├── game_routes.py
  │   └── bet_routes.py
  ├── services/
  │   ├── ai_service.py
  │   └── road_service.py

# 类 - PascalCase
class RoadAnalyzer:
    pass

# 函数/方法 - snake_case
def calculate_derived_road(big_road_data: list) -> dict:
    pass

# 常量 - UPPER_SNAKE_CASE
MAX_GAMES_PER_BOOT = 70
DEFAULT_BET_AMOUNT = 100
```

### 3.5 类型安全规范

#### 3.5.1 TypeScript 规范

```typescript
// ❌ 错误：使用 any
data: any

// ✅ 正确：使用 unknown 或具体类型
data: unknown
// 或
data: ApiResponse<GameData>

// ❌ 错误：隐式 any
const handler = (event) => { }

// ✅ 正确：明确类型
const handler = (event: React.MouseEvent<HTMLButtonElement>) => { }
```

#### 3.5.2 Python 类型注解

```python
# ✅ 正确：完整类型注解
from typing import Optional, List, Dict

def analyze_road(
    road_data: List[Dict[str, int]],
    threshold: float = 0.5
) -> Optional[AnalysisResult]:
    pass
```

### 3.6 常量管理规范

```typescript
// ❌ 错误：魔法数字分散在代码中
if (status === 2) { }
if (count > 100) { }

// ✅ 正确：集中管理常量
// constants.ts
export const STATUS = {
  PENDING: 0,
  ACTIVE: 1,
  COMPLETED: 2,
  FAILED: 3,
} as const;

export const LIMITS = {
  MAX_GAMES_PER_BOOT: 70,
  DEFAULT_BET_AMOUNT: 100,
} as const;
```

### 3.7 React Query 规范

```typescript
// ✅ 正确：乐观UI配置
const { data } = useQuery({
  queryKey: ['games', tableId],
  queryFn: () => api.getGames(tableId),
  staleTime: Infinity,    // 数据永不过期
  gcTime: 30 * 60 * 1000, // 30分钟垃圾回收
});

// ✅ 正确：乐观更新
const mutation = useMutation({
  mutationFn: api.placeBet,
  onMutate: async (newBet) => {
    // 乐观更新UI
    await queryClient.cancelQueries({ queryKey: ['bets'] });
    const previousBets = queryClient.getQueryData(['bets']);
    queryClient.setQueryData(['bets'], (old) => [...old, newBet]);
    return { previousBets };
  },
  onError: (err, newBet, context) => {
    // 错误时回滚
    queryClient.setQueryData(['bets'], context.previousBets);
    // 记录错误
    addIssue({ ... });
  },
});
```

### 3.8 SVG 图标管理

```typescript
// ❌ 错误：每个文件重复定义SVG
const Icons = {
  Reload: () => <svg>...</svg>,
  Upload: () => <svg>...</svg>,
}

// ✅ 正确：统一图标组件库
// components/icons/index.tsx
export { ReloadIcon } from './ReloadIcon';
export { UploadIcon } from './UploadIcon';
export { ChartIcon } from './ChartIcon';
// ...

// 使用
import { ReloadIcon, UploadIcon } from '../components/icons';
```

---

## 四、代码审查检查表

### 4.1 审查者检查表

```markdown
## 代码审查检查表

### 架构与设计
- [ ] 代码符合单一职责原则
- [ ] 组件/函数拆分合理
- [ ] 无重复代码（DRY原则）
- [ ] 依赖关系清晰，无循环依赖

### 代码质量
- [ ] 无复杂度过高的函数
- [ ] 无深层嵌套
- [ ] 命名清晰有意义
- [ ] 注释准确且必要

### 错误处理
- [ ] 所有错误都被捕获
- [ ] 错误记录到系统状态面板
- [ ] 无静默失败
- [ ] 用户友好的错误提示

### 性能
- [ ] 无低效算法
- [ ] 无不必要的重渲染
- [ ] 大数据集处理优化
- [ ] React Query 配置正确

### 类型安全
- [ ] TypeScript 类型完整
- [ ] 无 any 类型
- [ ] 返回值类型明确
- [ ] 接口定义完整

### 测试
- [ ] 关键逻辑有测试覆盖
- [ ] 边界条件处理正确
- [ ] 测试用例独立

### 文档
- [ ] 复杂逻辑有注释
- [ ] API 变更已更新文档
- [ ] 新增功能有使用说明
```

### 4.2 严重级别定义

| 级别 | 说明 | 处理方式 |
|------|------|----------|
| P0 - Critical | 阻塞问题，必须修复 | 禁止合并 |
| P1 - High | 重要问题，强烈建议修复 | 需说明不修复理由 |
| P2 - Medium | 一般问题，建议修复 | 可后续修复 |
| P3 - Low | 小问题，可选修复 | 可忽略 |

### 4.3 常见审查问题

#### P0 - Critical
- [ ] 错误未记录到系统状态面板
- [ ] 文件超过最大行数限制
- [ ] 存在未处理的 Promise 错误
- [ ] 使用 any 类型未加注释

#### P1 - High
- [ ] 函数复杂度 > 10
- [ ] 嵌套深度 > 4层
- [ ] 参数数量 > 5个
- [ ] 魔法数字未提取为常量

#### P2 - Medium
- [ ] 函数长度 > 50行
- [ ] 缺少 JSDoc 注释
- [ ] 命名不够清晰
- [ ] 可复用逻辑未提取

---

## 五、重构优先级

### 5.1 P0 - 立即重构

| 文件 | 当前行数 | 目标行数 | 重构方案 |
|------|----------|----------|----------|
| DashboardPage.tsx | 1240 | 300 | 拆分为多个子组件 |
| UploadPage.tsx | 1185 | 300 | 提取业务逻辑到 hooks |
| main.py | 1354 | 500 | 按功能拆分为多个模块 |

### 5.2 P1 - 短期重构

1. **SVG 图标统一**
   - 创建 `components/icons/` 目录
   - 提取所有 SVG 到独立组件
   - 统一引用方式

2. **类型定义集中**
   - 创建 `src/types/` 目录
   - 集中管理所有接口定义
   - 消除重复类型

### 5.3 P2 - 中期优化

1. **工具函数提取**
   - 提取通用格式化函数
   - 创建共享工具库

2. **样式优化**
   - 统一 styled-components 模式
   - 提取公共样式变量

---

## 六、审查工具配置

### 6.1 ESLint 配置

```json
{
  "extends": [
    "@typescript-eslint/recommended",
    "plugin:react-hooks/recommended"
  ],
  "rules": {
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/explicit-function-return-type": "warn",
    "complexity": ["error", 10],
    "max-lines": ["error", { "max": 300 }],
    "max-params": ["error", 5],
    "max-nested-callbacks": ["error", 4]
  }
}
```

### 6.2 CI 检查脚本

```yaml
# .github/workflows/code-quality.yml
name: Code Quality Check

on: [pull_request]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Frontend Lint
        run: |
          cd frontend
          npm ci
          npm run lint
          npm run type-check
      
      - name: Backend Lint
        run: |
          cd backend
          pip install flake8
          flake8 app/
      
      - name: File Size Check
        run: |
          ./scripts/check-file-size.sh
```

---

## 七、审查记录模板

```markdown
## PR 审查记录

**PR:** #123
**审查者:** @reviewer
**日期:** 2026-04-10

### 总体评价
- 代码质量: ⭐⭐⭐⭐☆
- 可读性: ⭐⭐⭐⭐⭐
- 性能: ⭐⭐⭐⭐☆

### 发现的问题

#### P1 - High
1. `DashboardPage.tsx` 行数超标 (1240 > 300)
   - 建议：拆分为子组件
   - 位置：第 1-1240 行

#### P2 - Medium
2. `useEffect` 缺少依赖项
   - 建议：添加完整依赖或注释说明
   - 位置：`DashboardPage.tsx:156`

### 建议改进
- [ ] 提取 SVG 图标到独立组件
- [ ] 添加更多单元测试

### 审查结论
- [ ] 批准合并
- [x] 需修改后重新审查
- [ ] 拒绝合并
```

---

## 八、附录

### 8.1 参考资源

- [TypeScript 风格指南](https://google.github.io/styleguide/tsguide.html)
- [React 最佳实践](https://react.dev/learn)
- [Python PEP 8](https://pep8.org/)

### 8.2 更新记录

| 版本 | 日期 | 更新内容 |
|------|------|----------|
| v1.0 | 2026-04-10 | 初始版本，建立代码审查标准 |

---

**铁律重申：**
1. **所有错误必须记录到系统状态面板**
2. **禁止使用虚拟数据/Mock数据**
3. **分析预测永不降级，必须满血3模型**
4. **单文件不超过500行（Page组件不超过300行）**
5. **ESLint 0错误0警告**
