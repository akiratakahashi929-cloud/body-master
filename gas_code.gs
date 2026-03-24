/**
 * ============================================================
 * BODY MASTER — Google Apps Script (GAS)
 * 体系管理 & 筋トレ DX ツール
 * ============================================================
 * 
 * 【セットアップ手順】
 * 1. Google スプレッドシートを新規作成
 * 2. 「拡張機能」→「Apps Script」を開く
 * 3. このコードを Code.gs にコピー＆ペースト
 * 4. 上部の SPREADSHEET_ID をスプレッドシートのIDに変更
 *    （URL: https://docs.google.com/spreadsheets/d/★ここがID★/edit）
 * 5. 「デプロイ」→「新しいデプロイ」
 *    - 種類: ウェブアプリ
 *    - 次のユーザーとして実行: 自分
 *    - アクセスできるユーザー: 全員
 * 6. デプロイ後のURLをアプリのGAS設定に貼り付ける
 * 
 * ============================================================
 */

// ★★★ ここにスプレッドシートIDを入力 ★★★
const SPREADSHEET_ID = '1tlMgu_eg_5zbk0hpKbui6M4BTgVjjP317cLDbfxyu4I';

// シート名
const SHEET_DAILY = '日次データ';
const SHEET_TRAINING = 'トレーニング';
const SHEET_PROFILE = 'プロフィール';

/**
 * POST リクエスト受信
 */
function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const type = payload.type;
    const data = payload.data;

    let result;

    switch (type) {
      case 'daily':
        result = recordDailyData(data);
        break;
      case 'training':
        result = recordTrainingData(data);
        break;
      case 'profile':
        result = recordProfileData(data);
        break;
      default:
        result = { status: 'error', message: 'Unknown type: ' + type };
    }

    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * GET リクエスト（テスト用）
 */
function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({
      status: 'ok',
      message: 'BODY MASTER GAS is running!',
      timestamp: new Date().toISOString()
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * 日次データを記録
 */
function recordDailyData(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(SHEET_DAILY);

  // シートが無ければ作成
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_DAILY);
    sheet.appendRow([
      '日付', '体重(kg)', '腹囲(cm)', 'アプリ摂取kcal', '摂取kcal(合計)',
      'カーボ(g)', 'トレーニング', '基礎代謝', 'メンテナンスkcal',
      '必要摂取kcal', 'ギャップ', 'タイムスタンプ'
    ]);
    // ヘッダー書式
    const headerRange = sheet.getRange(1, 1, 1, 12);
    headerRange.setFontWeight('bold');
    headerRange.setBackground('#CE1141');
    headerRange.setFontColor('#FFFFFF');
    sheet.setFrozenRows(1);
  }

  sheet.appendRow([
    data.date || '',
    data.weight || '',
    data.waist || '',
    data.appKcal || '',
    data.totalKcal || '',
    data.carbs || '',
    data.training || '',
    data.bmr ? Math.round(data.bmr * 100) / 100 : '',
    data.maintenance ? Math.round(data.maintenance * 100) / 100 : '',
    data.targetKcal ? Math.round(data.targetKcal * 100) / 100 : '',
    data.gap ? Math.round(data.gap * 100) / 100 : '',
    data.timestamp || new Date().toISOString()
  ]);

  return { status: 'ok', sheet: SHEET_DAILY, rows: sheet.getLastRow() };
}

/**
 * トレーニングデータを記録
 */
function recordTrainingData(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(SHEET_TRAINING);

  // シートが無ければ作成
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_TRAINING);
    sheet.appendRow([
      '日付', '種目名', '部位', 'セット数', 
      'セット詳細(重量×回数)', '総ボリューム(kg)',
      'メモ', 'トレーニング時間(分)', 'タイムスタンプ'
    ]);
    const headerRange = sheet.getRange(1, 1, 1, 9);
    headerRange.setFontWeight('bold');
    headerRange.setBackground('#CE1141');
    headerRange.setFontColor('#FFFFFF');
    sheet.setFrozenRows(1);
  }

  const date = data.date || new Date().toISOString().split('T')[0];
  const exercises = data.exercises || [];

  exercises.forEach(function(ex) {
    const setDetails = ex.sets.map(function(s, i) {
      return (i + 1) + ': ' + s.weight + 'kg × ' + s.reps + '回' + (s.rpe ? ' (RPE' + s.rpe + ')' : '');
    }).join(' | ');

    sheet.appendRow([
      date,
      ex.name || '',
      ex.category || '',
      ex.totalSets || '',
      setDetails,
      ex.totalVolume || '',
      ex.notes || '',
      data.duration || '',
      new Date().toISOString()
    ]);
  });

  // サマリー行を追加
  if (exercises.length > 1) {
    sheet.appendRow([
      date,
      '【サマリー】',
      exercises.map(function(e) { return e.category; }).filter(function(v, i, a) { return a.indexOf(v) === i; }).join(', '),
      data.totalSets || '',
      '',
      data.totalVolume || '',
      '',
      data.duration || '',
      new Date().toISOString()
    ]);
  }

  return { status: 'ok', sheet: SHEET_TRAINING, rows: sheet.getLastRow() };
}

/**
 * プロフィールデータを記録
 */
function recordProfileData(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(SHEET_PROFILE);

  // シートが無ければ作成
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_PROFILE);
    sheet.appendRow([
      '更新日', '身長(cm)', '体重(kg)', '年齢', '性別',
      '活動レベル', '1日赤字目標(kcal)', '減量目標(kg)',
      '腹囲(cm)', 'タイムスタンプ'
    ]);
    const headerRange = sheet.getRange(1, 1, 1, 10);
    headerRange.setFontWeight('bold');
    headerRange.setBackground('#CE1141');
    headerRange.setFontColor('#FFFFFF');
    sheet.setFrozenRows(1);
  }

  const activityLabels = {
    '1.2': '座りがち',
    '1.375': '軽い運動',
    '1.55': '中程度',
    '1.725': '活発',
    '1.9': '非常に活発'
  };

  sheet.appendRow([
    new Date().toISOString().split('T')[0],
    data.height || '',
    data.weight || '',
    data.age || '',
    data.gender === 'male' ? '男性' : '女性',
    activityLabels[String(data.activity)] || data.activity,
    data.deficit || '',
    data.targetLoss || '',
    data.waist || '',
    new Date().toISOString()
  ]);

  return { status: 'ok', sheet: SHEET_PROFILE, rows: sheet.getLastRow() };
}

/**
 * 初回セットアップ用（手動実行）
 * メニューから実行すると全シートが初期化されます
 */
function setupSheets() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  
  // テスト用にダミーデータで各シートを初期化
  recordDailyData({
    date: '2026-03-17',
    weight: 82.7,
    waist: 85,
    appKcal: 2200,
    totalKcal: 2400,
    carbs: 350,
    training: '筋トレDay',
    bmr: 1821.39,
    maintenance: 2549.946,
    targetKcal: 2049.946,
    gap: 350.054,
    timestamp: new Date().toISOString()
  });

  recordProfileData({
    height: 168,
    weight: 82.7,
    age: 32,
    gender: 'male',
    activity: 1.375,
    deficit: 500,
    targetLoss: 10,
    waist: 85
  });

  Logger.log('セットアップ完了！');
}
