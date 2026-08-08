# Codex 接入

ShipProof 不替代 Codex，而是把“Codex 负责实现”和“独立工具负责判定”串成闭环。

## Hook 模式

在目标仓库安装：

```bash
npm install --save-dev github:lianmt/shipproof#v0.1.1
npx shipproof init
npx shipproof install-codex-hooks
```

安装器会保留已有 `.codex/hooks.json`，只向 `SessionStart` 和 `Stop` 追加 ShipProof command hook。

### SessionStart

若仓库存在配置，Hook 创建 `.shipproof/lock.json`，记录开始实现前的验收契约。若锁定失败，它把原因作为系统消息返回，但不阻止会话启动。

### Stop

Stop Hook 执行完整验证：

- `VERIFIED`：允许 Codex 正常结束并提供报告路径。
- 首次非 `VERIFIED`：返回 `decision: block`，把具体失败交回 Codex 修复。
- 已经由 Stop Hook 续跑过仍未通过：返回 `continue: false`，避免无限循环，并保留最终边界。

Hook 只向 stdout 输出一行 JSON，适合 Codex 的 stdin/stdout 协议。手动诊断：

```bash
printf '%s' '{"cwd":"/absolute/repo","hook_event_name":"Stop"}' \
  | npx shipproof hook
```

## SDK 模式

`shipproof codex` 适合 CI 或内部自动化：

```bash
npx shipproof codex --prompt-file task.md --task task.md
```

顺序固定为：锁定契约 → 调用 Codex SDK → 运行独立验证 → 以四态退出码结束。它依赖可用的 `@openai/codex-sdk` 认证与运行环境；ShipProof 不保存或代理 OpenAI 凭据。

## GitHub Action 模式

推荐先获取完整 Git 历史和可信基线：

```yaml
name: shipproof
on: [pull_request]

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
        with:
          fetch-depth: 0
      - uses: actions/setup-node@v6
        with:
          node-version: 20
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - uses: lianmt/shipproof@v0.1.1
        with:
          baseline-ref: origin/main
          config: shipproof.yml
          task: task.md
      - uses: actions/upload-artifact@v7
        if: always()
        with:
          name: shipproof-evidence
          path: .shipproof/runs
```

若项目允许在 PR 中正常修改测试，不要把全部测试都设为 `protected`；应保护不可由实现者修改的外部验收集，或由主分支/独立仓库存放黑盒验收。

## 官方接口依据

- [Codex SDK](https://learn.chatgpt.com/docs/codex-sdk)
- [Codex Hooks](https://learn.chatgpt.com/docs/hooks)
- [Codex GitHub Action](https://learn.chatgpt.com/docs/github-action)

ShipProof 仅在适配器使用这些接口；核心判定格式对其他编程代理同样适用。
