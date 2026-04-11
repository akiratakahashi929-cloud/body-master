cat << 'INNER' > patch.json
{
  "TargetFile": "/Users/takahashiakira/アキラmgtsys/BODY_MASTERのコピー/app.js",
  "Instruction": "Modify loadRoutineToMenu to autofill sets and weights from history.",
  "Description": "Routine loader now pulls previous weights & sets from user history.",
  "ReplacementChunks": [
    {
      "AllowMultiple": false,
      "TargetContent": "    let sets = [];\n    if (isObj && Array.isArray(exItem.defaultSets)) {\n      sets = exItem.defaultSets.map(s => ({ weight: 0, reps: s.reps }));\n    }\n    return { ...found, sets, totalSets: sets.length, totalVolume: 0, recorded: false };",
      "ReplacementContent": "    let sets = [];\n    \n    // 過去のログからこの種目の最新セットを取得\n    let prevEx = null;\n    for (let i = APP.trainingLogs.length - 1; i >= 0; i--) {\n      const log = APP.trainingLogs[i];\n      const matched = log.exercises.find(e => e.name === name && e.recorded);\n      if (matched) {\n        prevEx = matched;\n        break;\n      }\n    }\n\n    if (isObj && Array.isArray(exItem.defaultSets)) {\n      // ルーティーンにデフォルトレップ数が定義されている場合（MRTなど）\n      sets = exItem.defaultSets.map((s, idx) => {\n        let w = 0;\n        if (prevEx && prevEx.sets[idx]) w = prevEx.sets[idx].weight;\n        else if (prevEx && prevEx.sets.length > 0) w = prevEx.sets[0].weight;\n        return { weight: w, reps: s.reps };\n      });\n    } else if (prevEx && prevEx.sets && prevEx.sets.length > 0) {\n      // ユーザーが編集して文字列のみになった場合、前回のセット履歴を丸ごとコピー\n      sets = prevEx.sets.map(s => ({ weight: s.weight, reps: s.reps }));\n    } else {\n      // 履歴もデフォルトもない場合は空の1セットを用意する\n      sets = [{ weight: 0, reps: 0 }];\n    }\n    \n    return { ...found, sets, totalSets: sets.length, totalVolume: 0, recorded: false };",
      "StartLine": 1856,
      "EndLine": 1860
    }
  ]
}
INNER
