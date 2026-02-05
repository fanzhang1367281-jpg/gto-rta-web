#!/bin/bash
# 安装 pre-commit 本地门禁

echo "🔧 安装 pre-commit..."

# 检查 Python
if ! command -v python3 &> /dev/null; then
    echo "❌ 需要 Python3"
    exit 1
fi

# 安装 pre-commit
pip3 install pre-commit -q

# 安装 git hooks
echo "📦 安装 git hooks..."
pre-commit install

# 手动运行一次检查所有文件
echo "🧪 运行首次检查..."
pre-commit run --all-files || true

echo ""
echo "✅ pre-commit 安装完成！"
echo ""
echo "使用说明："
echo "  每次 git commit 前会自动运行检查"
echo "  手动检查: pre-commit run --all-files"
echo "  跳过检查: git commit --no-verify (不推荐)"
echo ""
