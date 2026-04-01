#!/bin/bash
# BODY MASTER — GitHub 自動プッシュスクリプト
# 使い方: ./push.sh "更新内容のメッセージ"

REPO_DIR="/Users/takahashiakira/アキラmgtsys/BODY_MASTERのコピー"
REMOTE_URL="https://github.com/akiratakahashi929-cloud/body-master.git"

cd "$REPO_DIR" || { echo "[ERROR] ディレクトリが見つかりません: $REPO_DIR"; exit 1; }

# コミットメッセージ（引数がなければ日時を使用）
MSG="${1:-$(date '+%Y-%m-%d %H:%M') - 進捗更新}"

echo "[INFO] BODY MASTER — GitHub プッシュ開始"
echo "[INFO] コミットメッセージ: $MSG"
echo ""

# リモートが設定されているか確認
if ! git remote get-url origin &>/dev/null; then
    echo "[SETUP] リモートURLを設定中..."
    git remote add origin "$REMOTE_URL"
fi

# 変更があるか確認
STATUS=$(git status --porcelain)
if [ -z "$STATUS" ]; then
    echo "[OK] 変更はありません。最新状態です。"
    exit 0
fi

# ステージング → コミット → プッシュ
git add -A
echo "[OK] ステージング完了"

git commit -m "$MSG"
echo "[OK] コミット完了"

git push origin main
echo ""
echo "[DONE] GitHub へのプッシュが完了しました！"
echo "[LINK] https://github.com/akiratakahashi929-cloud/body-master"
