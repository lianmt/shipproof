# Contributing

欢迎贡献能降低 AI 编程任务误判的最小变更。

1. 为问题提供可重复的仓库或测试夹具。
2. 先说明期望四态结论及理由。
3. 修改后运行 `npm run lint && npm run typecheck && npm test && npm run build`。
4. 新的防误判场景应加入受控基准，并确保不存在 false `VERIFIED`。

不要在 fixture、日志或 Issue 中提交真实 token、客户数据或生产响应。
