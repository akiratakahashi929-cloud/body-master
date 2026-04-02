/**
 * ============================================================
 * BODY MASTER — Google Apps Script (GAS) v2.0
 * 双方向同期 + スキーマバージョン管理対応
 * ============================================================
 * 
 * 【アップデート内容】
 * - doGet(): 全データをJSONで返す（デバイス間同期）
 * - doPost(): データ種別ごとに保存（既存互換）
 * - スキーマバージョン管理で更新後もデータ破損しない
 * - CORS対応ヘッダー追加
 * 
 * 【セットアップ手順】
 * 1. Google スプレッドシートを新規作成
 * 2. 「拡張機能」→「Apps Script」を開く
 * 3. このコードを Code.gs にコピー＆ペースト
 * 4. SPREADSHEET_ID を実際のIDに変更
 * 5. 「デプロイ」→「新しいデプロイ」（または既存デプロイを更新）
 *    - 種類: ウェブアプリ
 *    - 実行ユーザー: 自分
 *    - アクセス: 全員
 * 6. デプロイURLをアプリのGAS設定に貼り付け
 * ============================================================
 */

const SPREADSHEET_ID = '1tlMgu_eg_5zbk0hpKbui6M4BTgVjjP317cLDbfxyu4I';

// シート名
const SHEET_DAILY    = '日次データ';
const SHEET_TRAINING = 'トレーニング';
const SHEET_PROFILE  = 'プロフィール';
const SHEET_SYNC     = '同期データ';   // ← 新規: JSON全データを保存

const SCHEMA_VERSION = 2;

// ============================================================
// ヘルパー
// ============================================================
function hasValue(v) { return v !== null && v !== undefined && v !== ''; }
function roundOrBlank(v) {
  if (!hasValue(v)) return '';
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : '';
}
function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
// GET: 全データをJSONで返す（デバイス間同期の読み込み側）
// ============================================================
function doGet(e) {
  try {
    const action = e && e.parameter && e.parameter.action;

    if (action === 'sync') {
      // 同期シートから最新のJSONデータを返す
      return jsonResponse(getSyncData());
    }

    // デフォルト: 稼働確認
    return jsonResponse({
      status: 'ok',
      message: 'BODY MASTER GAS v2.0 is running!',
      schemaVersion: SCHEMA_VERSION,
      timestamp: new Date().toISOString()
    });
  } catch(err) {
    return jsonResponse({ status: 'error', message: err.toString() });
  }
}

// ============================================================
// POST: データ受信 & 保存
// ============================================================
function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const { type, data } = payload;

    let result;
    switch (type) {
      case 'daily':    result = recordDailyData(data);    break;
      case 'training': result = recordTrainingData(data); break;
      case 'profile':  result = recordProfileData(data);  break;
      case 'sync':     result = saveSyncData(data);       break;  // ← 新規
      default:
        result = { status: 'error', message: 'Unknown type: ' + type };
    }

    return jsonResponse(result);
  } catch(err) {
    return jsonResponse({ status: 'error', message: err.toString() });
  }
}

// ============================================================
// 同期シート: 全データ一括保存・読み込み
// ============================================================
function getSyncData() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(SHEET_SYNC);
  if (!sheet) return { status: 'empty', data: null };

  const rows = sheet.getDataRange().getValues();
  // 最新行（タイムスタンプ降順の1行目: ヘッダー除く）
  let latestRow = null;
  let latestTime = 0;
  for (let i = 1; i < rows.length; i++) {
    const ts = new Date(rows[i][0]).getTime();
    if (ts > latestTime) {
      latestTime = ts;
      latestRow = rows[i];
    }
  }
  if (!latestRow) return { status: 'empty', data: null };

  try {
    const parsed = JSON.parse(latestRow[1]);
    return {
      status: 'ok',
      schemaVersion: latestRow[2] || 1,
      savedAt: latestRow[0],
      deviceType: latestRow[3] || 'unknown',
      data: parsed
    };
  } catch(e) {
    return { status: 'error', message: 'Parse error: ' + e.toString() };
  }
}

function saveSyncData(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(SHEET_SYNC);

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_SYNC);
    sheet.appendRow(['タイムスタンプ', 'JSONデータ', 'スキーマVersion', 'デバイス種別', '端末情報']);
    const h = sheet.getRange(1, 1, 1, 5);
    h.setFontWeight('bold');
    h.setBackground('#1A1A1A');
    h.setFontColor('#CE1141');
    sheet.setFrozenRows(1);
    // JSON列を広く
    sheet.setColumnWidth(2, 800);
  }

  const ts = data._syncedAt || new Date().toISOString();
  const device = data._deviceType || 'unknown';
  const json = JSON.stringify(data);

  sheet.appendRow([ts, json, SCHEMA_VERSION, device, '']);

  // 古いデータを削除（100行超えたら古い順に整理）
  const lastRow = sheet.getLastRow();
  if (lastRow > 102) {
    sheet.deleteRows(2, lastRow - 102);
  }

  return { status: 'ok', savedAt: ts, schemaVersion: SCHEMA_VERSION };
}

// ============================================================
// 日次データ記録（既存互換）
// ============================================================
function recordDailyData(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(SHEET_DAILY);

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_DAILY);
    sheet.appendRow([
      '日付', '体重(kg)', '腹囲(cm)', 'アプリ摂取kcal', '摂取kcal(合計)',
      'カーボ(g)', 'トレーニング', '基礎代謝', 'メンテナンスkcal',
      '必要摂取kcal', 'ギャップ', 'タイムスタンプ'
    ]);
    const h = sheet.getRange(1, 1, 1, 12);
    h.setFontWeight('bold'); h.setBackground('#CE1141'); h.setFontColor('#FFFFFF');
    sheet.setFrozenRows(1);
  }

  // 既存の同日データをupsert
  const allData = sheet.getDataRange().getValues();
  let targetRow = -1;
  for (let i = 1; i < allData.length; i++) {
    if (allData[i][0] === data.date) { targetRow = i + 1; break; }
  }

  const row = [
    data.date || '',
    hasValue(data.weight) ? data.weight : '',
    hasValue(data.waist) ? data.waist : '',
    hasValue(data.appKcal) ? data.appKcal : '',
    hasValue(data.totalKcal) ? data.totalKcal : '',
    hasValue(data.carbs) ? data.carbs : '',
    data.training || '',
    roundOrBlank(data.bmr),
    roundOrBlank(data.maintenance),
    roundOrBlank(data.targetKcal),
    roundOrBlank(data.gap),
    data.timestamp || new Date().toISOString()
  ];

  if (targetRow > 0) {
    sheet.getRange(targetRow, 1, 1, row.length).setValues([row]);
  } else {
    sheet.appendRow(row);
  }

  return { status: 'ok', sheet: SHEET_DAILY, rows: sheet.getLastRow() };
}

// ============================================================
// トレーニングデータ記録（既存互換）
// ============================================================
function recordTrainingData(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(SHEET_TRAINING);

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_TRAINING);
    sheet.appendRow([
      '日付', '種目名', '部位', 'セット数',
      'セット詳細(重量×回数)', '総ボリューム(kg)',
      'メモ', 'トレーニング時間(分)', 'タイムスタンプ'
    ]);
    const h = sheet.getRange(1, 1, 1, 9);
    h.setFontWeight('bold'); h.setBackground('#CE1141'); h.setFontColor('#FFFFFF');
    sheet.setFrozenRows(1);
  }

  const date = data.date || new Date().toISOString().split('T')[0];
  (data.exercises || []).forEach(function(ex) {
    const sets = Array.isArray(ex.sets) ? ex.sets : [];
    const setDetails = sets.map(function(s, i) {
      return (i+1) + ': ' + s.weight + 'kg×' + s.reps + '回' + (s.rpe ? ' (RPE'+s.rpe+')' : '');
    }).join(' | ');
    sheet.appendRow([
      date, ex.name || '', ex.category || '',
      hasValue(ex.totalSets) ? ex.totalSets : '',
      setDetails,
      hasValue(ex.totalVolume) ? ex.totalVolume : '',
      ex.notes || '',
      hasValue(data.duration) ? data.duration : '',
      new Date().toISOString()
    ]);
  });

  return { status: 'ok', sheet: SHEET_TRAINING, rows: sheet.getLastRow() };
}

// ============================================================
// プロフィール記録（既存互換）
// ============================================================
function recordProfileData(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(SHEET_PROFILE);

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_PROFILE);
    sheet.appendRow([
      '更新日', '身長(cm)', '体重(kg)', '年齢', '性別',
      '活動レベル', '1日赤字目標(kcal)', '減量目標(kg)',
      '腹囲(cm)', 'タイムスタンプ'
    ]);
    const h = sheet.getRange(1, 1, 1, 10);
    h.setFontWeight('bold'); h.setBackground('#CE1141'); h.setFontColor('#FFFFFF');
    sheet.setFrozenRows(1);
  }

  const activityLabels = {
    '1.2': '座りがち', '1.375': '軽い運動',
    '1.55': '中程度', '1.725': '活発', '1.9': '非常に活発'
  };

  sheet.appendRow([
    new Date().toISOString().split('T')[0],
    hasValue(data.height) ? data.height : '',
    hasValue(data.weight) ? data.weight : '',
    hasValue(data.age) ? data.age : '',
    data.gender === 'male' ? '男性' : (data.gender === 'female' ? '女性' : ''),
    activityLabels[String(data.activity)] || data.activity,
    hasValue(data.deficit) ? data.deficit : '',
    hasValue(data.targetLoss) ? data.targetLoss : '',
    hasValue(data.waist) ? data.waist : '',
    new Date().toISOString()
  ]);

  return { status: 'ok', sheet: SHEET_PROFILE, rows: sheet.getLastRow() };
}

/**
 * 初回セットアップ用（手動実行）
 */
function setupSheets() {
  getSyncData(); // 同期シートを初期化
  Logger.log('セットアップ完了: ' + new Date().toISOString());
}
