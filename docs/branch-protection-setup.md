# GitHub 分支保护设置指南

## 必须在 GitHub 网页中完成的设置

### 1. 启用分支保护规则

访问：
```
https://github.com/fanzhang1367281-jpg/gto-rta-web/settings/branches
```

点击 **"Add rule"** 按钮

### 2. 规则配置

**Branch name pattern**: `main`

#### 保护选项（全部勾选）

- [x] **Require a pull request before merging**
  - [x] Require approvals: `1`
  - [x] Dismiss stale PR approvals when new commits are pushed
  - [x] Require review from CODEOWNERS

- [x] **Require status checks to pass before merging**
  - [x] Require branches to be up to date before merging
  - **Status checks that are required**:
    - `Three-Layer Collaboration Check`
    - `test` (CI workflow)

- [x] **Require conversation resolution before merging**

- [x] **Include administrators** ⚠️ 重要：强制所有人遵守

### 3. 验证设置

设置完成后，在本地运行：
```bash
gh ruleset check --default
```

预期输出：
```
1 rules apply to branch main in repo fanzhang1367281-jpg/gto-rta-web
```

### 4. 测试保护效果

尝试直接 push 到 main：
```bash
git checkout main
git commit --allow-empty -m "test"
git push origin main
```

预期结果：
```
! [remote rejected] main -> main (protected branch hook declined)
```

---

## 当前已配置的自动化检查

### CI Workflows
1. **Three-Layer Collaboration Check** (`.github/workflows/collaboration-check.yml`)
   - 检查 PR 描述中的 OwnerAgent, DoD, Repro Steps
   - 验证分支命名规范
   - 验证 Conventional Commits

2. **CI Tests** (`.github/workflows/test.yml`)
   - 运行 pytest
   - 检查代码覆盖率

### CODEOWNERS
以下文件必须由指定人审批：
- `AGENTS.md`
- `TASK_PLAN.md`
- `RUN_REPORT.md`
- `docs/metrics.md`
- `docs/version_strategy.md`
- `services/strategy-api/main.py`

### Pre-commit Hooks (本地)
安装命令：
```bash
./install-precommit.sh
```

检查内容：
- trailing-whitespace
- end-of-file-fixer
- check-yaml
- check-json
- black (Python 格式化)
- flake8 (Python lint)
- prettier (JS/JSON/YAML/Markdown 格式化)

---

## 完整工作流验证

### 正常流程（应该成功）
```bash
# 1. 创建功能分支
git checkout -b feat/webrtc-capture

# 2. 修改代码（pre-commit 自动运行）
git add .
git commit -m "feat: add WebRTC screen capture"

# 3. 推送并创建 PR
git push origin feat/webrtc-capture
gh pr create --title "feat: WebRTC screen capture" --body "## OwnerAgent
- [x] B OpenCode

## DoD
- [x] WebRTC capture implemented
- [x] Tests added
- [x] CI green

## Repro Steps
```bash
./start.sh
# 打开浏览器访问 http://localhost:8080
```"

# 4. 等待 CI 通过
# 5. 等待 CODEOWNERS 审批
# 6. 合并 PR
```

### 违规流程（应该被阻止）
```bash
# 尝试直接 push main
git checkout main
git commit --allow-empty -m "direct push"
git push origin main  # ❌ 被拒绝

# PR 缺少 OwnerAgent
gh pr create --title "bad pr" --body "no owner agent"  # ❌ CI 失败

# 修改 AGENTS.md 未审批
# PR 会被标记 "CODEOWNERS review required"
```

---

## 故障排查

### 问题：pre-commit 安装失败
```bash
# 手动安装
pip3 install pre-commit
pre-commit install
```

### 问题：CI 检查不通过
```bash
# 本地运行检查
pre-commit run --all-files
pytest
```

### 问题：需要紧急合并
**不要**使用 `--admin` 绕过，而是：
1. 创建 PR
2. 标记为 `priority/urgent`
3. 快速审批流程

---

*设置状态: 等待 GitHub 网页配置*  
*配置文件已就绪: CODEOWNERS, workflows, pre-commit*
