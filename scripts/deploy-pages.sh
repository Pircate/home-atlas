#!/usr/bin/env bash
# 构建并发布到 GitHub Pages 的 gh-pages 分支，不影响 main。
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REMOTE="${PAGES_REMOTE:-origin}"
BRANCH="${PAGES_BRANCH:-gh-pages}"
PUBLISH_DIR="$(mktemp -d)"
trap 'rm -rf "$PUBLISH_DIR"' EXIT

REMOTE_URL="$(git -C "$REPO_DIR" remote get-url "$REMOTE")"

cd "$REPO_DIR"
npm test
npm run build:pages

cp -R dist/. "$PUBLISH_DIR/"
# 阻止 Jekyll 处理产物
touch "$PUBLISH_DIR/.nojekyll"

git -C "$PUBLISH_DIR" init -q -b "$BRANCH"
git -C "$PUBLISH_DIR" add -A
git -C "$PUBLISH_DIR" commit -q -m "chore | 发布构建产物到 GitHub Pages"
git -C "$PUBLISH_DIR" push -f "$REMOTE_URL" "$BRANCH"

echo "已发布到 https://pircate.github.io/home-atlas/"
