# Icon Flow (Phosphor統一)

## 基本ルール
- 新規アイコンは `phosphor-icons` の `regular` スタイルを使用する
- Unicode絵文字は使用しない
- UI上のアイコンは `<i class="ph ph-... ph-inline"></i>` 形式で記述する

## 使い方
1. `index.html` に次が入っていることを確認する  
   `../phosphor-icons/Fonts/regular/style.css`
2. 使いたいアイコン名を `phosphor-icons/Fonts/regular/style.css` から選ぶ
3. 画面側は `<i class="ph ph-ICON_NAME ph-inline"></i>` を使う

## 追加前チェック
- 変更後に以下を実行

```bash
python3 check_phosphor_icons.py
```

- `OK: Unicode絵文字は検出されませんでした。` が出れば完了
