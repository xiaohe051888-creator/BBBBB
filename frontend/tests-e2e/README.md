## E2E 运行

默认（最稳定：mock 上游）：

```bash
cd /workspace/frontend
npm run e2e
```

指定目标地址：

```bash
E2E_BASE_URL=http://localhost:8011 npm run e2e
```

启用真实外网 AI 连通性用例（可选）：

```bash
E2E_REAL_AI=1 npm run e2e
```
