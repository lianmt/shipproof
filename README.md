# ShipProof

ShipProof 是 AI 编程代理的独立验收层：代理可以写代码，但不能仅凭自己的表述宣布任务完成。

它把任务验收写成仓库内的 `shipproof.yml`，执行命令、文件、HTTP 和真实浏览器检查，保存可追溯证据，并只给出四种结论：

- `VERIFIED`：所有必需检查通过，验收契约未被篡改，证据仍对应当前工作区。
- `FAILED`：产品或测试结果明确不符合验收条件。
- `BLOCKED`：环境、依赖、服务或浏览器使验证无法完成。
- `UNVERIFIED`：缺少可信锁、验收契约被修改，或旧证据已经过期。

> 核心边界：ShipProof 证明的是“这份工作区通过了这份验收契约”，不是“软件不存在任何缺陷”。验收契约本身仍需要人或可信流程审阅。

## 为什么做它

AI 编程工具很擅长生成实现，却容易把源码存在、命令返回 0、Mock 成功或旧服务页面，当成业务已经完成。ShipProof 将“实现者”和“判定者”分开：

1. 实现前锁定任务说明和验收文件哈希。
2. 实现后由确定性检查器独立运行验收。
3. 保存命令输出、HTTP 响应、浏览器截图、Git 状态和 SHA-256。
4. 工作区变化后，旧的 `VERIFIED` 自动降为 `UNVERIFIED`。

## 5 分钟开始

要求 Node.js 20 或更高版本。

```bash
npm install --save-dev shipproof
npx shipproof init
```

审阅生成的 `shipproof.yml`，将真实任务写入文件，再在代理开始修改前锁定：

```bash
npx shipproof lock --task task.md
# 让 Codex 或其他代理完成任务
npx shipproof verify --task task.md
npx shipproof report
```

退出码稳定对应四种结论：`0=VERIFIED`、`1=FAILED`、`2=BLOCKED`、`3=UNVERIFIED`。

## 配置示例

```yaml
version: 1
evidenceDir: .shipproof/runs

# 代理实现期间不允许静默修改的验收契约
protected:
  - shipproof.yml
  - tests/**

checks:
  - id: unit-tests
    type: command
    run: npm test
    timeoutMs: 120000

  - id: built-file
    type: file
    path: dist/index.js
    exists: true
    minBytes: 100

  - id: health
    type: http
    start: npm start
    url: http://127.0.0.1:3000/health
    expectStatus: 200
    contains: ready

  - id: browser
    type: playwright
    start: npm start
    url: http://127.0.0.1:3000/
    selector: '[data-testid="dashboard"]'
    contains: Dashboard
    viewport: { width: 390, height: 844 }
```

HTTP 和浏览器检查默认拒绝复用启动前已经响应的 URL，避免把另一个旧进程误当成当前代码。确实要验证外部环境时，显式配置 `allowExisting: true`。

Playwright 检查要求目标仓库安装 `playwright`，并预先执行 `npx playwright install chromium`。GitHub Action 不会静默联网下载浏览器。

## 支持的检查

| 类型 | 验收能力 | 主要证据 |
|---|---|---|
| `command` | 退出码、必含/禁含输出、超时 | 命令、cwd、stdout、stderr、退出码 |
| `file` | 存在性、内容、最小字节数 | 路径、大小、SHA-256、内容片段 |
| `http` | 自启服务、状态码、响应文本 | URL、状态、正文、服务日志 |
| `playwright` | 自启服务、页面文本、选择器、标题、视口 | 导航状态、标题、截图、服务日志 |

所有命令输出和 HTTP 正文会对常见敏感环境变量值做脱敏。证据目录 `.shipproof/` 默认应忽略提交；基准报告除外。

## Codex 接入

### 生命周期 Hook

```bash
npx shipproof install-codex-hooks
```

它会合并写入 `.codex/hooks.json`：`SessionStart` 锁定验收契约，`Stop` 独立运行验证。首次失败会阻止 Codex 停止并把失败原因送回；再次仍失败时停止循环并保留精确结论。

### Codex SDK

```bash
npx shipproof codex \
  --prompt-file task.md \
  --task task.md
```

该命令先锁定契约，再调用 `@openai/codex-sdk`，最后独立验证代理产物。SDK 使用需要已经配置可用的 Codex 环境。

Codex 接入依据 OpenAI 官方的 [Codex SDK](https://learn.chatgpt.com/docs/codex-sdk)、[Hooks](https://learn.chatgpt.com/docs/hooks) 和 [GitHub Action](https://learn.chatgpt.com/docs/github-action) 文档实现。

### GitHub Action

```yaml
- uses: your-org/shipproof@v0.1.0
  with:
    config: shipproof.yml
    task: task.md
    baseline-ref: origin/main
```

Action 会把报告写入 Job Summary，并输出 `status` 与 `report`。非 `VERIFIED` 结果会让步骤失败。若使用 `baseline-ref`，受保护验收文件必须与可信 Git ref 一致。

## CLI

```text
shipproof init                    创建起始配置并忽略 .shipproof/
shipproof lock [--task file]      锁定任务与验收契约
shipproof verify [--task file]    执行验证并保存证据
shipproof report                  检查最新证据是否仍然新鲜
shipproof install-codex-hooks     安装 Codex 生命周期 Hook
shipproof hook                    供 Codex 以 JSON stdin/stdout 调用
shipproof codex                   运行 Codex SDK 后独立验收
shipproof benchmark               执行 20 例受控误判基准
```

`verify --allow-unlocked` 只适合本地探索；它不会伪造可信锁，正式代理流程不应使用。

## 可运行示例与基准

- [`fixtures/node-basic`](fixtures/node-basic) 同时覆盖命令、文件、HTTP 和 Playwright。
- `npm run benchmark` 运行 20 个受控案例，覆盖退出失败、超时、验收篡改、任务篡改、服务崩溃、旧服务和过期证据。
- 最新受控结果写入 `benchmark/results/latest.md` 和 `latest.json`。

更完整的边界见 [架构与安全边界](docs/架构与安全边界.md)、[Codex接入](docs/Codex接入.md) 和 [基准说明](docs/基准说明.md)。

## 当前阶段

这是一个能真实运行的 v0.1 基线，不是已经证明市场需求的商业产品。现在最重要的不是继续堆功能，而是让 5–10 个真实仓库使用，并记录它抓住了哪些“代理说完成、实际没完成”的问题。路线图见 [ROADMAP.md](ROADMAP.md)。

## 开发

```bash
npm ci
npm run lint
npm run typecheck
npm test
npm run build
npm run benchmark
```

Apache-2.0 License。欢迎提交最小复现、误判案例和新的确定性检查器。
