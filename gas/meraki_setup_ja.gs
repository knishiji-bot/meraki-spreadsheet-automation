// ============================================================
// Cisco Meraki 初期設定デモ - Google Apps Script
// MX VLAN + MS Trunk + MR SSID + RF Profile 統合版
// Logヘッダー・全差分チェック・RF一括反映対応
// ============================================================

// ── 定数 ──────────────────────────────────────────────────
const SHEET_CONFIG  = 'Config';
const SHEET_VLAN    = 'VLAN_Settings';
const SHEET_MS      = 'MS_Settings';
const SHEET_SSID    = 'SSID_Settings';
const SHEET_RF      = 'RF_Settings';
const BASE_URL      = 'https://api.meraki.com/api';

// ============================================================
// ユーティリティ：確認ダイアログ共通関数
// ============================================================
function showConfirmDialog(title, message) {
  const ui      = SpreadsheetApp.getUi();
  const confirm = ui.alert(title, message, ui.ButtonSet.YES_NO);
  return confirm === ui.Button.YES;
}

// ============================================================
// ユーティリティ：Config シートから値取得
// ============================================================
function getConfig() {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_CONFIG);

  if (!sheet) {
    throw new Error(
      `❌ シートが見つかりません。\n` +
      `「${SHEET_CONFIG}」という名前のシートを確認してください。`
    );
  }

  const data   = sheet.getDataRange().getValues();
  const config = {};
  data.forEach(row => {
    if (row[0]) config[row[0]] = row[1];
  });
  return config;
}

// ============================================================
// ユーティリティ：Meraki API 共通リクエスト関数
// ============================================================
function merakiRequest(method, endpoint, payload, apiKey) {
  const url     = BASE_URL + endpoint;
  const options = {
    method             : method,
    headers            : {
      'X-Cisco-Meraki-API-Key' : apiKey,
      'Content-Type'           : 'application/json'
    },
    muteHttpExceptions : true
  };

  if (payload) {
    options.payload = JSON.stringify(payload);
  }

  const response = UrlFetchApp.fetch(url, options);
  const code     = response.getResponseCode();
  const body     = response.getContentText();

  Logger.log(`[${method}] ${endpoint} → HTTP ${code}`);

  if (code >= 200 && code < 300) {
    return body ? JSON.parse(body) : {};
  } else {
    Logger.log('Error Response: ' + body);
    throw new Error(`API Error ${code}: ${body}`);
  }
}

// ============================================================
// ユーティリティ：ステータス列を更新
// ============================================================
function updateStatus(sheet, rowIndex, colIndex, message) {
  sheet.getRange(rowIndex, colIndex).setValue(message);
}

// ============================================================
// ユーティリティ：Logシートにヘッダーを追加（初回のみ）
// ============================================================
function ensureLogHeader() {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  let sheet   = ss.getSheetByName('Log');

  // ── Logシートが存在しない場合は新規作成 ──────────
  if (!sheet) {
    sheet = ss.insertSheet('Log');
  }

  // ── 1行目が空の場合のみヘッダーを追加 ────────────
  const firstCell = sheet.getRange(1, 1).getValue();
  if (firstCell === '' || firstCell === null) {
    sheet.getRange(1, 1, 1, 5).setValues([[
      '実行日時', '実行者', '実行内容', '対象', '結果'
    ]]);
    // ── ヘッダー行のスタイル設定 ───────────────────
    sheet.getRange(1, 1, 1, 5)
      .setBackground('#4A86E8')
      .setFontColor('#FFFFFF')
      .setFontWeight('bold');

    // ── 列幅の自動調整 ────────────────────────────
    sheet.setColumnWidth(1, 160); // 実行日時
    sheet.setColumnWidth(2, 200); // 実行者
    sheet.setColumnWidth(3, 160); // 実行内容
    sheet.setColumnWidth(4, 220); // 対象
    sheet.setColumnWidth(5, 300); // 結果
  }

  return sheet;
}

// ============================================================
// ユーティリティ：ログシートに実行履歴を記録
// ============================================================
function writeLog(action, target, status) {
  const sheet = ensureLogHeader();
  sheet.appendRow([
    new Date(),
    Session.getActiveUser().getEmail(),
    action,
    target,
    status
  ]);
}

// ============================================================
// MX VLAN 差分チェック関数（新規追加）
// ============================================================
function checkVlanDiff(sheet, rowIndex, vlanId, payload, apiKey, networkId) {

  const endpoint = `/v1/networks/${networkId}/appliance/vlans/${vlanId}`;
  const current  = merakiRequest('GET', endpoint, null, apiKey);

  const diffs = [];

  // VLAN名
  if (current.name !== payload.name) {
    diffs.push(`name: 期待値「${payload.name}」→ 実際「${current.name}」`);
  }

  // サブネット
  if (current.subnet !== payload.subnet) {
    diffs.push(`subnet: 期待値「${payload.subnet}」→ 実際「${current.subnet}」`);
  }

  // MX IPアドレス
  if (current.applianceIp !== payload.applianceIp) {
    diffs.push(
      `applianceIp: 期待値「${payload.applianceIp}」→ 実際「${current.applianceIp}」`
    );
  }

  // DNS
  if (payload.dnsNameservers &&
      current.dnsNameservers !== payload.dnsNameservers) {
    diffs.push(
      `dns: 期待値「${payload.dnsNameservers}」→ 実際「${current.dnsNameservers}」`
    );
  }

  // ── 結果を H列に書き込み ────────────────────────
  if (diffs.length === 0) {
    sheet.getRange(rowIndex, 8).setValue('✅ 一致');
  } else {
    sheet.getRange(rowIndex, 8).setValue(`⚠️ 不一致:\n${diffs.join('\n')}`);
  }

  return diffs;
}

// ============================================================
// MS ポート 差分チェック関数（新規追加）
// ============================================================
function checkMsDiff(sheet, rowIndex, serial, portId, payload, apiKey) {

  const endpoint = `/v1/devices/${serial}/switch/ports/${portId}`;
  const current  = merakiRequest('GET', endpoint, null, apiKey);

  const diffs = [];

  // ポート名
  if (current.name !== payload.name) {
    diffs.push(`name: 期待値「${payload.name}」→ 実際「${current.name}」`);
  }

  // ポートタイプ
  if (current.type !== payload.type) {
    diffs.push(`type: 期待値「${payload.type}」→ 実際「${current.type}」`);
  }

  // ネイティブVLAN
  if (payload.type === 'trunk' && current.vlan !== payload.vlan) {
    diffs.push(`nativeVlan: 期待値「${payload.vlan}」→ 実際「${current.vlan}」`);
  }

  // 許可VLAN
  if (payload.type === 'trunk' &&
      String(current.allowedVlans) !== String(payload.allowedVlans)) {
    diffs.push(
      `allowedVlans: 期待値「${payload.allowedVlans}」→ 実際「${current.allowedVlans}」`
    );
  }

  // PoE
  if (current.poeEnabled !== payload.poeEnabled) {
    diffs.push(
      `poeEnabled: 期待値「${payload.poeEnabled}」→ 実際「${current.poeEnabled}」`
    );
  }

  // ── 結果を H列に書き込み ────────────────────────
  if (diffs.length === 0) {
    sheet.getRange(rowIndex, 8).setValue('✅ 一致');
  } else {
    sheet.getRange(rowIndex, 8).setValue(`⚠️ 不一致:\n${diffs.join('\n')}`);
  }

  return diffs;
}

// ============================================================
// MR SSID 差分チェック関数
// ============================================================
function checkDiff(sheet, rowIndex, ssidNumber, payload, apiKey, networkId) {

  const endpoint = `/v1/networks/${networkId}/wireless/ssids/${ssidNumber}`;
  const current  = merakiRequest('GET', endpoint, null, apiKey);

  const diffs = [];

  // SSID名
  if (current.name !== payload.name) {
    diffs.push(`name: 期待値「${payload.name}」→ 実際「${current.name}」`);
  }

  // 有効/無効
  if (current.enabled !== payload.enabled) {
    diffs.push(`enabled: 期待値「${payload.enabled}」→ 実際「${current.enabled}」`);
  }

  // 認証方式
  if (current.authMode !== payload.authMode) {
    diffs.push(`authMode: 期待値「${payload.authMode}」→ 実際「${current.authMode}」`);
  }

  // VLAN ID
  if (payload.useVlanTagging) {
    if (payload.ipAssignmentMode === 'NAT mode' ||
        payload.ipAssignmentMode === 'Bridge mode') {
      Logger.log(
        `ℹ️ SSID ${ssidNumber}: ${payload.ipAssignmentMode} のため` +
        `VLANチェックをスキップします。`
      );
    } else {
      const expectedVlan = Number(payload.defaultVlanId);
      const actualVlan   = current.defaultVlanId !== undefined
                         ? Number(current.defaultVlanId)
                         : null;

      if (actualVlan === null) {
        diffs.push(
          `vlanId: MerakiダッシュボードでVLANが有効化されていない可能性があります。` +
          `（期待値「${expectedVlan}」→ 実際「未設定」）`
        );
      } else if (actualVlan !== expectedVlan) {
        diffs.push(`vlanId: 期待値「${expectedVlan}」→ 実際「${actualVlan}」`);
      }
    }
  }

  // IPモード
  if (current.ipAssignmentMode !== payload.ipAssignmentMode) {
    diffs.push(
      `ipAssignmentMode: 期待値「${payload.ipAssignmentMode}」` +
      `→ 実際「${current.ipAssignmentMode}」`
    );
  }

  // ── 結果をN列に書き込み ──────────────────────────
  if (diffs.length === 0) {
    sheet.getRange(rowIndex, 14).setValue('✅ 一致');
  } else {
    sheet.getRange(rowIndex, 14).setValue(`⚠️ 不一致:\n${diffs.join('\n')}`);
  }

  return diffs;
}

// ============================================================
// 💾 バックアップ：現在の設定を取得してシートに保存
// ============================================================
function backupCurrentSettings() {

  if (!showConfirmDialog(
    '💾 バックアップ確認',
    '現在のMeraki設定をバックアップします。\n\n' +
    '対象：\n' +
    '・MX VLAN設定\n' +
    '・MR SSID設定\n\n' +
    'よろしいですか？'
  )) {
    SpreadsheetApp.getUi().alert('❌ キャンセルしました。');
    return;
  }

  const config    = getConfig();
  const apiKey    = config['API_KEY'];
  const networkId = config['NETWORK_ID'];

  const now         = new Date();
  const timestamp   = Utilities.formatDate(now, 'Asia/Tokyo', 'yyyyMMdd_HHmmss');
  const sheetName   = `Backup_${timestamp}`;

  const ss          = SpreadsheetApp.getActiveSpreadsheet();
  const backupSheet = ss.insertSheet(sheetName);

  backupSheet.getRange('A1:G1')
    .setBackground('#4A86E8')
    .setFontColor('#FFFFFF')
    .setFontWeight('bold');

  // ── META情報 ──────────────────────────────────
  backupSheet.appendRow(['【META】', 'バックアップ日時',
    Utilities.formatDate(now, 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss'), '', '', '', '']);
  backupSheet.appendRow(['【META】', '実行者',
    Session.getActiveUser().getEmail(), '', '', '', '']);
  backupSheet.appendRow(['【META】', 'Network ID', networkId, '', '', '', '']);
  backupSheet.appendRow(['', '', '', '', '', '', '']);

  try {
    // ── MX VLAN設定 ───────────────────────────────
    backupSheet.appendRow([
      '【MX VLAN】', 'VLAN ID', 'VLAN名', 'サブネット', 'MX IPアドレス', 'DNS', ''
    ]);
    backupSheet.getRange(backupSheet.getLastRow(), 1, 1, 6)
      .setBackground('#D9EAD3').setFontWeight('bold');

    const vlans = merakiRequest(
      'GET', `/v1/networks/${networkId}/appliance/vlans`, null, apiKey
    );
    vlans.forEach(vlan => {
      backupSheet.appendRow([
        '【MX VLAN】',
        vlan.id,
        vlan.name,
        vlan.subnet,
        vlan.applianceIp,
        vlan.dnsNameservers || '',
        ''
      ]);
    });

    backupSheet.appendRow(['', '', '', '', '', '', '']);

    // ── MR SSID設定 ───────────────────────────────
    backupSheet.appendRow([
      '【MR SSID】', 'SSID番号', 'SSID名', '有効/無効', '認証方式',
      'VLAN ID', 'IPモード'
    ]);
    backupSheet.getRange(backupSheet.getLastRow(), 1, 1, 7)
      .setBackground('#FCE5CD').setFontWeight('bold');

    const ssids = merakiRequest(
      'GET', `/v1/networks/${networkId}/wireless/ssids`, null, apiKey
    );
    ssids.forEach(ssid => {
      backupSheet.appendRow([
        '【MR SSID】',
        ssid.number,
        ssid.name,
        ssid.enabled,
        ssid.authMode,
        ssid.defaultVlanId    || '',
        ssid.ipAssignmentMode || ''
      ]);
    });

    writeLog('バックアップ', sheetName, '✅ 成功');
    SpreadsheetApp.getUi().alert(
      `✅ バックアップが完了しました！\n\n` +
      `保存先シート：${sheetName}\n\n` +
      `ロールバック時はこのシート名を使用してください。`
    );

  } catch (e) {
    writeLog('バックアップ', sheetName, `❌ エラー: ${e.message}`);
    SpreadsheetApp.getUi().alert(
      `❌ バックアップ中にエラーが発生しました:\n${e.message}`
    );
  }
}

// ============================================================
// ↩️  ロールバック：バックアップシートから設定を復元
// ============================================================
function rollbackSettings() {

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const backupSheets = ss.getSheets()
    .filter(s => s.getName().startsWith('Backup_'))
    .map(s => s.getName())
    .sort()
    .reverse();

  if (backupSheets.length === 0) {
    SpreadsheetApp.getUi().alert(
      '❌ バックアップが見つかりません。\n' +
      '先に「💾 現在の設定をバックアップする」を実行してください。'
    );
    return;
  }

  const backupList = backupSheets
    .map((name, index) => `${index + 1}. ${name}`)
    .join('\n');

  const ui       = SpreadsheetApp.getUi();
  const response = ui.prompt(
    '↩️  ロールバック',
    `復元するバックアップの番号を入力してください：\n\n${backupList}`,
    ui.ButtonSet.OK_CANCEL
  );

  if (response.getSelectedButton() !== ui.Button.OK) {
    ui.alert('❌ キャンセルしました。');
    return;
  }

  const selectedIndex = Number(response.getResponseText()) - 1;

  if (isNaN(selectedIndex) ||
      selectedIndex < 0   ||
      selectedIndex >= backupSheets.length) {
    ui.alert('❌ 無効な番号です。もう一度やり直してください。');
    return;
  }

  const selectedSheetName = backupSheets[selectedIndex];

  if (!showConfirmDialog(
    '⚠️ ロールバック最終確認',
    `以下のバックアップから設定を復元します。\n\n` +
    `復元元：${selectedSheetName}\n\n` +
    `⚠️ 現在の設定は上書きされます。\n` +
    `よろしいですか？`
  )) {
    ui.alert('❌ キャンセルしました。');
    return;
  }

  const config    = getConfig();
  const apiKey    = config['API_KEY'];
  const networkId = config['NETWORK_ID'];

  const backupSheet = ss.getSheetByName(selectedSheetName);
  const rows        = backupSheet.getDataRange().getValues();

  let vlanErrors = 0;
  let ssidErrors = 0;

  rows.forEach(row => {
    const section = row[0];

    // ── MX VLAN ロールバック ───────────────────────
    if (section === '【MX VLAN】' &&
        row[1] !== 'VLAN ID'     &&
        row[1] !== '') {

      const vlanId   = row[1];
      const vlanName = row[2];
      const subnet   = row[3];
      const mxIp     = row[4];
      const dns      = row[5];

      const payload  = { name: vlanName, subnet: subnet, applianceIp: mxIp };
      if (dns !== '') payload.dnsNameservers = dns;

      try {
        merakiRequest(
          'PUT',
          `/v1/networks/${networkId}/appliance/vlans/${vlanId}`,
          payload, apiKey
        );
        writeLog('ロールバック MX VLAN', `VLAN ${vlanId} - ${vlanName}`, '✅ 成功');
      } catch (e) {
        writeLog('ロールバック MX VLAN', `VLAN ${vlanId} - ${vlanName}`,
          `❌ エラー: ${e.message}`);
        vlanErrors++;
      }
      Utilities.sleep(300);
    }

    // ── MR SSID ロールバック ───────────────────────
    if (section === '【MR SSID】' &&
        row[1] !== 'SSID番号'    &&
        row[1] !== '') {

      const ssidNumber = row[1];
      const ssidName   = row[2];
      const enabled    = row[3];
      const authMode   = row[4];
      const vlanId     = row[5];
      const ipMode     = row[6];

      const payload = {
        name             : ssidName,
        enabled          : enabled === true || enabled === 'TRUE',
        authMode         : authMode,
        ipAssignmentMode : ipMode || 'Bridge mode'
      };

      if (vlanId !== '' && vlanId !== null) {
        payload.useVlanTagging = true;
        payload.defaultVlanId  = Number(vlanId);
      }

      try {
        merakiRequest(
          'PUT',
          `/v1/networks/${networkId}/wireless/ssids/${ssidNumber}`,
          payload, apiKey
        );
        writeLog('ロールバック MR SSID', `SSID ${ssidNumber} - ${ssidName}`, '✅ 成功');
      } catch (e) {
        writeLog('ロールバック MR SSID', `SSID ${ssidNumber} - ${ssidName}`,
          `❌ エラー: ${e.message}`);
        ssidErrors++;
      }
      Utilities.sleep(300);
    }
  });

  const errorCount = vlanErrors + ssidErrors;
  if (errorCount === 0) {
    SpreadsheetApp.getUi().alert(
      `✅ ロールバックが完了しました！\n\n` +
      `復元元：${selectedSheetName}\n` +
      `Logシートで詳細を確認してください。`
    );
  } else {
    SpreadsheetApp.getUi().alert(
      `⚠️ ロールバックが完了しましたが、エラーがありました。\n\n` +
      `VLANエラー：${vlanErrors}件\n` +
      `SSIDエラー：${ssidErrors}件\n\n` +
      `Logシートで詳細を確認してください。`
    );
  }
}

// ============================================================
// MX：VLANの有効化
// ============================================================
function enableMxVlans(apiKey, networkId) {
  const endpoint = `/v1/networks/${networkId}/appliance/vlans/settings`;
  const payload  = { vlansEnabled: true };

  try {
    merakiRequest('PUT', endpoint, payload, apiKey);
    Logger.log('✅ MX VLANs 有効化完了');
    writeLog('MX VLAN有効化', networkId, '✅ 成功');
  } catch (e) {
    Logger.log(`❌ MX VLAN有効化エラー: ${e.message}`);
    writeLog('MX VLAN有効化', networkId, `❌ エラー: ${e.message}`);
    throw e;
  }
}

// ============================================================
// MX：VLAN設定を反映（差分チェック追加）
// ============================================================
function applyVlanSettings() {

  if (!showConfirmDialog(
    '⚠️ 確認',
    'MX に VLAN設定を反映します。\n\n' +
    '対象：\n' +
    '・VLAN 10：Corp-WiFi\n' +
    '・VLAN 20：Guest-WiFi\n' +
    '・VLAN 30：IoT-WiFi\n\n' +
    'よろしいですか？'
  )) {
    SpreadsheetApp.getUi().alert('❌ キャンセルしました。');
    return;
  }

  const config    = getConfig();
  const apiKey    = config['API_KEY'];
  const networkId = config['NETWORK_ID'];

  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_VLAN);
  const rows  = sheet.getDataRange().getValues();

  enableMxVlans(apiKey, networkId);
  Utilities.sleep(1000);

  const existingVlans = merakiRequest(
    'GET', `/v1/networks/${networkId}/appliance/vlans`, null, apiKey
  );
  const existingIds = existingVlans.map(v => Number(v.id));

  for (let i = 1; i < rows.length; i++) {
    const row      = rows[i];
    const vlanId   = row[0];
    const vlanName = row[1];
    const subnet   = row[2];
    const mxIp     = row[3];
    const dns      = row[5];

    if (vlanId === '' || vlanId === null) continue;

    const payload = {
      id          : Number(vlanId),
      name        : vlanName,
      subnet      : subnet,
      applianceIp : mxIp
    };
    if (dns !== '' && dns !== null) payload.dnsNameservers = dns;

    try {
      if (existingIds.includes(Number(vlanId))) {
        merakiRequest('PUT',
          `/v1/networks/${networkId}/appliance/vlans/${vlanId}`, payload, apiKey);
      } else {
        merakiRequest('POST',
          `/v1/networks/${networkId}/appliance/vlans`, payload, apiKey);
      }
      updateStatus(sheet, i + 1, 7, '✅ 成功');
      writeLog('MX VLAN設定', `VLAN ${vlanId} - ${vlanName}`, '✅ 成功');

      // ── MX VLAN 差分チェック（新規追加）──────────
      Utilities.sleep(500);
      const diffs = checkVlanDiff(
        sheet, i + 1, vlanId, payload, apiKey, networkId
      );
      if (diffs.length > 0) {
        writeLog('差分チェック MX VLAN', `VLAN ${vlanId} - ${vlanName}`,
          `⚠️ 不一致: ${diffs.join(' / ')}`);
      } else {
        writeLog('差分チェック MX VLAN', `VLAN ${vlanId} - ${vlanName}`, '✅ 一致');
      }

    } catch (e) {
      updateStatus(sheet, i + 1, 7, `❌ エラー: ${e.message}`);
      writeLog('MX VLAN設定', `VLAN ${vlanId} - ${vlanName}`, `❌ エラー: ${e.message}`);
    }
    Utilities.sleep(300);
  }

  SpreadsheetApp.getUi().alert('✅ MX VLAN設定の反映が完了しました！');
}

// ============================================================
// MS：スイッチポート（Trunk）設定を反映（差分チェック追加）
// ============================================================
function applyMsSettings() {

  if (!showConfirmDialog(
    '⚠️ 確認',
    'MS に トランクポート設定を反映します。\n\n' +
    '対象：\n' +
    '・許可VLAN：10, 20, 30\n' +
    '・ポートタイプ：Trunk\n\n' +
    'よろしいですか？'
  )) {
    SpreadsheetApp.getUi().alert('❌ キャンセルしました。');
    return;
  }

  const config    = getConfig();
  const apiKey    = config['API_KEY'];
  const networkId = config['NETWORK_ID'];

  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_MS);
  const rows  = sheet.getDataRange().getValues();

  const devices  = merakiRequest(
    'GET', `/v1/networks/${networkId}/devices`, null, apiKey
  );
  const switches = devices.filter(d => d.model && d.model.startsWith('MS'));

  if (switches.length === 0) {
    SpreadsheetApp.getUi().alert('❌ MSデバイスが見つかりません。');
    return;
  }

  for (let i = 1; i < rows.length; i++) {
    const row          = rows[i];
    const portId       = row[0];
    const portName     = row[1];
    const portType     = row[2];
    const nativeVlan   = row[3];
    const allowedVlans = row[4];
    const poeEnabled   = row[5];

    if (portId === '' || portId === null) continue;

    const payload = {
      name       : portName,
      type       : portType,
      poeEnabled : poeEnabled === true || poeEnabled === 'TRUE'
    };
    if (portType === 'trunk') {
      payload.vlan         = Number(nativeVlan);
      payload.allowedVlans = String(allowedVlans);
    }

    switches.forEach(sw => {
      try {
        merakiRequest('PUT',
          `/v1/devices/${sw.serial}/switch/ports/${portId}`, payload, apiKey);
        updateStatus(sheet, i + 1, 7, '✅ 成功');
        writeLog('MSポート設定', `${sw.serial} ポート ${portId}`, '✅ 成功');

        // ── MS ポート 差分チェック（新規追加）────────
        Utilities.sleep(500);
        const diffs = checkMsDiff(
          sheet, i + 1, sw.serial, portId, payload, apiKey
        );
        if (diffs.length > 0) {
          writeLog('差分チェック MSポート',
            `${sw.serial} ポート ${portId}`,
            `⚠️ 不一致: ${diffs.join(' / ')}`);
        } else {
          writeLog('差分チェック MSポート',
            `${sw.serial} ポート ${portId}`, '✅ 一致');
        }

      } catch (e) {
        updateStatus(sheet, i + 1, 7, `❌ エラー: ${e.message}`);
        writeLog('MSポート設定', `${sw.serial} ポート ${portId}`,
          `❌ エラー: ${e.message}`);
      }
      Utilities.sleep(300);
    });
  }

  SpreadsheetApp.getUi().alert('✅ MSトランク設定の反映が完了しました！');
}

// ============================================================
// MR：SSID 設定を一括反映
// ============================================================
function applySSIDSettings() {

  if (!showConfirmDialog(
    '⚠️ 確認',
    'MR に SSID設定を反映します。\n\n' +
    '対象：\n' +
    '・SSID 0：Corp-WiFi（VLAN 10）\n' +
    '・SSID 1：Guest-WiFi（VLAN 20）\n' +
    '・SSID 2：IoT-WiFi（VLAN 30）\n\n' +
    'よろしいですか？'
  )) {
    SpreadsheetApp.getUi().alert('❌ キャンセルしました。');
    return;
  }

  const config    = getConfig();
  const apiKey    = config['API_KEY'];
  const networkId = config['NETWORK_ID'];

  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_SSID);
  const rows  = sheet.getDataRange().getValues();

  for (let i = 1; i < rows.length; i++) {
    const row           = rows[i];
    const ssidNumber    = row[0];
    const ssidName      = row[1];
    const enabled       = row[2];
    const authMode      = row[3];
    const psk           = row[4];
    const radiusIP      = row[5];
    const radiusPort    = row[6];
    const radiusSecret  = row[7];
    const vlanId        = row[8];
    const bandwidthKbps = row[9];
    const isolation     = row[10];
    const ipMode        = row[11];

    if (ssidNumber === '' || ssidNumber === null) continue;

    const payload = {
      name    : ssidName,
      enabled : enabled === true || enabled === 'TRUE'
    };

    switch (authMode) {
      case 'open':
        payload.authMode = 'open'; break;
      case 'WPA2 Personal':
        payload.authMode          = 'psk';
        payload.encryptionMode    = 'wpa';
        payload.wpaEncryptionMode = 'WPA2 only';
        payload.psk               = psk; break;
      case 'WPA3 Personal':
        payload.authMode          = 'psk';
        payload.encryptionMode    = 'wpa';
        payload.wpaEncryptionMode = 'WPA3 Transition Mode';
        payload.psk               = psk; break;
      case 'WPA2 Enterprise':
        payload.authMode          = '8021x-radius';
        payload.encryptionMode    = 'wpa-eap';
        payload.wpaEncryptionMode = 'WPA2 only';
        payload.radiusServers     = [{
          host: radiusIP, port: Number(radiusPort), secret: radiusSecret
        }]; break;
      case 'WPA3 Enterprise':
        payload.authMode          = '8021x-radius';
        payload.encryptionMode    = 'wpa-eap';
        payload.wpaEncryptionMode = 'WPA3 192-bit Security';
        payload.radiusServers     = [{
          host: radiusIP, port: Number(radiusPort), secret: radiusSecret
        }]; break;
    }

    if (vlanId !== '' && vlanId !== null) {
      payload.useVlanTagging = true;
      payload.defaultVlanId  = Number(vlanId);
    }
    if (bandwidthKbps !== '' && bandwidthKbps !== null) {
      payload.perClientBandwidthLimitUp   = Number(bandwidthKbps);
      payload.perClientBandwidthLimitDown = Number(bandwidthKbps);
    }

    payload.ipAssignmentMode = (ipMode !== '' && ipMode !== null)
      ? ipMode
      : (isolation === true || isolation === 'TRUE') ? 'NAT mode' : 'Bridge mode';

    try {
      merakiRequest('PUT',
        `/v1/networks/${networkId}/wireless/ssids/${ssidNumber}`, payload, apiKey);
      updateStatus(sheet, i + 1, 13, '✅ 成功');
      writeLog('SSID設定反映', `SSID ${ssidNumber} - ${ssidName}`, '✅ 成功');

      Utilities.sleep(500);
      const diffs = checkDiff(sheet, i + 1, ssidNumber, payload, apiKey, networkId);
      if (diffs.length > 0) {
        writeLog('差分チェック MR SSID', `SSID ${ssidNumber} - ${ssidName}`,
          `⚠️ 不一致: ${diffs.join(' / ')}`);
      } else {
        writeLog('差分チェック MR SSID', `SSID ${ssidNumber} - ${ssidName}`, '✅ 一致');
      }
    } catch (e) {
      updateStatus(sheet, i + 1, 13, `❌ エラー: ${e.message}`);
      writeLog('SSID設定反映', `SSID ${ssidNumber} - ${ssidName}`,
        `❌ エラー: ${e.message}`);
    }
  }

  SpreadsheetApp.getUi().alert('✅ SSID設定の反映と差分チェックが完了しました！');
}

// ============================================================
// RF Profile 設定を反映（差分チェック追加）
// ============================================================
function applyRFSettings() {

  if (!showConfirmDialog(
    '⚠️ 確認',
    'RF Profile設定を反映します。\n\n' +
    '対象：\n' +
    '・2.4GHz / 5GHz の送信電力・チャンネル幅\n\n' +
    'よろしいですか？'
  )) {
    SpreadsheetApp.getUi().alert('❌ キャンセルしました。');
    return;
  }

  const config    = getConfig();
  const apiKey    = config['API_KEY'];
  const networkId = config['NETWORK_ID'];

  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_RF);
  const rows  = sheet.getDataRange().getValues();

  const rfData = {};
  rows.forEach(row => {
    if (row[0]) rfData[row[0]] = { '2.4': row[1], '5': row[2] };
  });

  const payload = {
    name              : 'Demo-RF-Profile',
    bandSelectionType : 'ap',
    twoFourGhzSettings : {
      maxPower     : Number(rfData['最大送信電力(dBm)']['2.4']),
      minPower     : Number(rfData['最小送信電力(dBm)']['2.4']),
      minBitrate   : Number(rfData['最小ビットレート(Mbps)']['2.4']),
      channelWidth : String(rfData['チャンネル幅']['2.4']),
      rxsop        : Number(rfData['RXSOPしきい値']['2.4'])
    },
    fiveGhzSettings : {
      maxPower     : Number(rfData['最大送信電力(dBm)']['5']),
      minPower     : Number(rfData['最小送信電力(dBm)']['5']),
      minBitrate   : Number(rfData['最小ビットレート(Mbps)']['5']),
      channelWidth : String(rfData['チャンネル幅']['5']),
      rxsop        : Number(rfData['RXSOPしきい値']['5'])
    }
  };

  try {
    // ── RF Profile 新規作成 ───────────────────────
    const endpoint = `/v1/networks/${networkId}/wireless/rfProfiles`;
    const result   = merakiRequest('POST', endpoint, payload, apiKey);
    Logger.log(`✅ RF Profile作成完了: ID = ${result.id}`);
    updateStatus(sheet, 2, 4, '✅ 成功');
    writeLog('RF Profile作成', 'Demo-RF-Profile', `✅ 成功 ID: ${result.id}`);

    // ── RF Profile 差分チェック（新規追加）──────────
    Utilities.sleep(500);
    const created = merakiRequest(
      'GET',
      `/v1/networks/${networkId}/wireless/rfProfiles/${result.id}`,
      null,
      apiKey
    );

    const rfDiffs = [];

    // 2.4GHz チェック
    if (created.twoFourGhzSettings.maxPower !==
        payload.twoFourGhzSettings.maxPower) {
      rfDiffs.push(
        `2.4GHz maxPower: 期待値「${payload.twoFourGhzSettings.maxPower}」` +
        `→ 実際「${created.twoFourGhzSettings.maxPower}」`
      );
    }
    if (created.twoFourGhzSettings.minPower !==
        payload.twoFourGhzSettings.minPower) {
      rfDiffs.push(
        `2.4GHz minPower: 期待値「${payload.twoFourGhzSettings.minPower}」` +
        `→ 実際「${created.twoFourGhzSettings.minPower}」`
      );
    }

    // 5GHz チェック
    if (created.fiveGhzSettings.maxPower !==
        payload.fiveGhzSettings.maxPower) {
      rfDiffs.push(
        `5GHz maxPower: 期待値「${payload.fiveGhzSettings.maxPower}」` +
        `→ 実際「${created.fiveGhzSettings.maxPower}」`
      );
    }
    if (created.fiveGhzSettings.minPower !==
        payload.fiveGhzSettings.minPower) {
      rfDiffs.push(
        `5GHz minPower: 期待値「${payload.fiveGhzSettings.minPower}」` +
        `→ 実際「${created.fiveGhzSettings.minPower}」`
      );
    }

    if (rfDiffs.length === 0) {
      updateStatus(sheet, 2, 5, '✅ 一致');
      writeLog('差分チェック RF Profile', 'Demo-RF-Profile', '✅ 一致');
    } else {
      updateStatus(sheet, 2, 5, `⚠️ 不一致:\n${rfDiffs.join('\n')}`);
      writeLog('差分チェック RF Profile', 'Demo-RF-Profile',
        `⚠️ 不一致: ${rfDiffs.join(' / ')}`);
    }

    SpreadsheetApp.getUi().alert(
      `✅ RF Profile設定完了！\nProfile ID: ${result.id}`
    );

  } catch (e) {
    Logger.log(`❌ RF Profile エラー: ${e.message}`);
    updateStatus(sheet, 2, 4, `❌ エラー: ${e.message}`);
    writeLog('RF Profile作成', 'Demo-RF-Profile', `❌ エラー: ${e.message}`);
    SpreadsheetApp.getUi().alert(`❌ エラーが発生しました:\n${e.message}`);
  }
}

// ============================================================
// 全設定を一括反映（MX → MS → MR → RF の順番で実行）
// ============================================================
function applyAllSettings() {

  if (!showConfirmDialog(
    '⚠️ 確認',
    '全デバイスに設定を一括反映します。\n\n' +
    '実行順序：\n' +
    'Step 1：🌐 MX VLAN設定（VLAN 10・20・30）\n' +
    'Step 2：🔌 MS トランクポート設定\n' +
    'Step 3：📶 MR SSID設定（差分チェックあり）\n' +
    'Step 4：📡 RF Profile設定（差分チェックあり）\n\n' +
    'よろしいですか？'
  )) {
    SpreadsheetApp.getUi().alert('❌ キャンセルしました。');
    return;
  }

  const ui = SpreadsheetApp.getUi();

  // ── Step 1：MX VLAN設定 ───────────────────────
  ui.alert('⏳ Step 1/4：MX VLAN設定を反映中...');
  applyVlanSettingsWithoutConfirm();
  Utilities.sleep(1000);

  // ── Step 2：MS トランク設定 ───────────────────
  ui.alert('⏳ Step 2/4：MSトランク設定を反映中...');
  applyMsSettingsWithoutConfirm();
  Utilities.sleep(1000);

  // ── Step 3：MR SSID設定 ───────────────────────
  ui.alert('⏳ Step 3/4：MR SSID設定を反映中...');
  applySSIDSettingsWithoutConfirm();
  Utilities.sleep(1000);

  // ── Step 4：RF Profile設定 ────────────────────
  ui.alert('⏳ Step 4/4：RF Profile設定を反映中...');
  applyRFSettingsWithoutConfirm();

  ui.alert('🎉 全設定の反映が完了しました！\nLogシートで結果を確認してください。');
}

// ============================================================
// 内部処理用：確認ダイアログなしの各設定関数
// ============================================================
function applyVlanSettingsWithoutConfirm() {
  const config    = getConfig();
  const apiKey    = config['API_KEY'];
  const networkId = config['NETWORK_ID'];
  const ss        = SpreadsheetApp.getActiveSpreadsheet();
  const sheet     = ss.getSheetByName(SHEET_VLAN);
  const rows      = sheet.getDataRange().getValues();

  enableMxVlans(apiKey, networkId);
  Utilities.sleep(1000);

  const existingVlans = merakiRequest(
    'GET', `/v1/networks/${networkId}/appliance/vlans`, null, apiKey
  );
  const existingIds = existingVlans.map(v => Number(v.id));

  for (let i = 1; i < rows.length; i++) {
    const row      = rows[i];
    const vlanId   = row[0];
    const vlanName = row[1];
    const subnet   = row[2];
    const mxIp     = row[3];
    const dns      = row[5];

    if (vlanId === '' || vlanId === null) continue;

    const payload = {
      id: Number(vlanId), name: vlanName,
      subnet: subnet, applianceIp: mxIp
    };
    if (dns !== '' && dns !== null) payload.dnsNameservers = dns;

    try {
      if (existingIds.includes(Number(vlanId))) {
        merakiRequest('PUT',
          `/v1/networks/${networkId}/appliance/vlans/${vlanId}`, payload, apiKey);
      } else {
        merakiRequest('POST',
          `/v1/networks/${networkId}/appliance/vlans`, payload, apiKey);
      }
      updateStatus(sheet, i + 1, 7, '✅ 成功');
      writeLog('MX VLAN設定', `VLAN ${vlanId} - ${vlanName}`, '✅ 成功');

      Utilities.sleep(500);
      const diffs = checkVlanDiff(sheet, i + 1, vlanId, payload, apiKey, networkId);
      if (diffs.length > 0) {
        writeLog('差分チェック MX VLAN', `VLAN ${vlanId} - ${vlanName}`,
          `⚠️ 不一致: ${diffs.join(' / ')}`);
      } else {
        writeLog('差分チェック MX VLAN', `VLAN ${vlanId} - ${vlanName}`, '✅ 一致');
      }
    } catch (e) {
      updateStatus(sheet, i + 1, 7, `❌ エラー: ${e.message}`);
      writeLog('MX VLAN設定', `VLAN ${vlanId} - ${vlanName}`, `❌ エラー: ${e.message}`);
    }
    Utilities.sleep(300);
  }
}

function applyMsSettingsWithoutConfirm() {
  const config    = getConfig();
  const apiKey    = config['API_KEY'];
  const networkId = config['NETWORK_ID'];
  const ss        = SpreadsheetApp.getActiveSpreadsheet();
  const sheet     = ss.getSheetByName(SHEET_MS);
  const rows      = sheet.getDataRange().getValues();
  const devices   = merakiRequest(
    'GET', `/v1/networks/${networkId}/devices`, null, apiKey
  );
  const switches  = devices.filter(d => d.model && d.model.startsWith('MS'));

  if (switches.length === 0) return;

  for (let i = 1; i < rows.length; i++) {
    const row          = rows[i];
    const portId       = row[0];
    const portName     = row[1];
    const portType     = row[2];
    const nativeVlan   = row[3];
    const allowedVlans = row[4];
    const poeEnabled   = row[5];

    if (portId === '' || portId === null) continue;

    const payload = {
      name: portName, type: portType,
      poeEnabled: poeEnabled === true || poeEnabled === 'TRUE'
    };
    if (portType === 'trunk') {
      payload.vlan         = Number(nativeVlan);
      payload.allowedVlans = String(allowedVlans);
    }

    switches.forEach(sw => {
      try {
        merakiRequest('PUT',
          `/v1/devices/${sw.serial}/switch/ports/${portId}`, payload, apiKey);
        updateStatus(sheet, i + 1, 7, '✅ 成功');
        writeLog('MSポート設定', `${sw.serial} ポート ${portId}`, '✅ 成功');

        Utilities.sleep(500);
        const diffs = checkMsDiff(sheet, i + 1, sw.serial, portId, payload, apiKey);
        if (diffs.length > 0) {
          writeLog('差分チェック MSポート', `${sw.serial} ポート ${portId}`,
            `⚠️ 不一致: ${diffs.join(' / ')}`);
        } else {
          writeLog('差分チェック MSポート', `${sw.serial} ポート ${portId}`, '✅ 一致');
        }
      } catch (e) {
        updateStatus(sheet, i + 1, 7, `❌ エラー: ${e.message}`);
        writeLog('MSポート設定', `${sw.serial} ポート ${portId}`,
          `❌ エラー: ${e.message}`);
      }
      Utilities.sleep(300);
    });
  }
}

function applySSIDSettingsWithoutConfirm() {
  const config    = getConfig();
  const apiKey    = config['API_KEY'];
  const networkId = config['NETWORK_ID'];
  const ss        = SpreadsheetApp.getActiveSpreadsheet();
  const sheet     = ss.getSheetByName(SHEET_SSID);
  const rows      = sheet.getDataRange().getValues();

  for (let i = 1; i < rows.length; i++) {
    const row           = rows[i];
    const ssidNumber    = row[0];
    const ssidName      = row[1];
    const enabled       = row[2];
    const authMode      = row[3];
    const psk           = row[4];
    const radiusIP      = row[5];
    const radiusPort    = row[6];
    const radiusSecret  = row[7];
    const vlanId        = row[8];
    const bandwidthKbps = row[9];
    const isolation     = row[10];
    const ipMode        = row[11];

    if (ssidNumber === '' || ssidNumber === null) continue;

    const payload = {
      name    : ssidName,
      enabled : enabled === true || enabled === 'TRUE'
    };

    switch (authMode) {
      case 'open':
        payload.authMode = 'open'; break;
      case 'WPA2 Personal':
        payload.authMode = 'psk'; payload.encryptionMode = 'wpa';
        payload.wpaEncryptionMode = 'WPA2 only'; payload.psk = psk; break;
      case 'WPA3 Personal':
        payload.authMode = 'psk'; payload.encryptionMode = 'wpa';
        payload.wpaEncryptionMode = 'WPA3 Transition Mode'; payload.psk = psk; break;
      case 'WPA2 Enterprise':
        payload.authMode = '8021x-radius'; payload.encryptionMode = 'wpa-eap';
        payload.wpaEncryptionMode = 'WPA2 only';
        payload.radiusServers = [{
          host: radiusIP, port: Number(radiusPort), secret: radiusSecret
        }]; break;
      case 'WPA3 Enterprise':
        payload.authMode = '8021x-radius'; payload.encryptionMode = 'wpa-eap';
        payload.wpaEncryptionMode = 'WPA3 192-bit Security';
        payload.radiusServers = [{
          host: radiusIP, port: Number(radiusPort), secret: radiusSecret
        }]; break;
    }

    if (vlanId !== '' && vlanId !== null) {
      payload.useVlanTagging = true;
      payload.defaultVlanId  = Number(vlanId);
    }
    if (bandwidthKbps !== '' && bandwidthKbps !== null) {
      payload.perClientBandwidthLimitUp   = Number(bandwidthKbps);
      payload.perClientBandwidthLimitDown = Number(bandwidthKbps);
    }

    payload.ipAssignmentMode = (ipMode !== '' && ipMode !== null)
      ? ipMode
      : (isolation === true || isolation === 'TRUE') ? 'NAT mode' : 'Bridge mode';

    try {
      merakiRequest('PUT',
        `/v1/networks/${networkId}/wireless/ssids/${ssidNumber}`, payload, apiKey);
      updateStatus(sheet, i + 1, 13, '✅ 成功');
      writeLog('SSID設定反映', `SSID ${ssidNumber} - ${ssidName}`, '✅ 成功');

      Utilities.sleep(500);
      const diffs = checkDiff(sheet, i + 1, ssidNumber, payload, apiKey, networkId);
      if (diffs.length > 0) {
        writeLog('差分チェック MR SSID', `SSID ${ssidNumber} - ${ssidName}`,
          `⚠️ 不一致: ${diffs.join(' / ')}`);
      } else {
        writeLog('差分チェック MR SSID', `SSID ${ssidNumber} - ${ssidName}`, '✅ 一致');
      }
    } catch (e) {
      updateStatus(sheet, i + 1, 13, `❌ エラー: ${e.message}`);
      writeLog('SSID設定反映', `SSID ${ssidNumber} - ${ssidName}`,
        `❌ エラー: ${e.message}`);
    }
  }
}

function applyRFSettingsWithoutConfirm() {
  const config    = getConfig();
  const apiKey    = config['API_KEY'];
  const networkId = config['NETWORK_ID'];
  const ss        = SpreadsheetApp.getActiveSpreadsheet();
  const sheet     = ss.getSheetByName(SHEET_RF);
  const rows      = sheet.getDataRange().getValues();

  const rfData = {};
  rows.forEach(row => {
    if (row[0]) rfData[row[0]] = { '2.4': row[1], '5': row[2] };
  });

  const payload = {
    name              : 'Demo-RF-Profile',
    bandSelectionType : 'ap',
    twoFourGhzSettings : {
      maxPower     : Number(rfData['最大送信電力(dBm)']['2.4']),
      minPower     : Number(rfData['最小送信電力(dBm)']['2.4']),
      minBitrate   : Number(rfData['最小ビットレート(Mbps)']['2.4']),
      channelWidth : String(rfData['チャンネル幅']['2.4']),
      rxsop        : Number(rfData['RXSOPしきい値']['2.4'])
    },
    fiveGhzSettings : {
      maxPower     : Number(rfData['最大送信電力(dBm)']['5']),
      minPower     : Number(rfData['最小送信電力(dBm)']['5']),
      minBitrate   : Number(rfData['最小ビットレート(Mbps)']['5']),
      channelWidth : String(rfData['チャンネル幅']['5']),
      rxsop        : Number(rfData['RXSOPしきい値']['5'])
    }
  };

  try {
    const endpoint = `/v1/networks/${networkId}/wireless/rfProfiles`;
    const result   = merakiRequest('POST', endpoint, payload, apiKey);
    updateStatus(sheet, 2, 4, '✅ 成功');
    writeLog('RF Profile作成', 'Demo-RF-Profile', `✅ 成功 ID: ${result.id}`);

    Utilities.sleep(500);
    const created = merakiRequest(
      'GET',
      `/v1/networks/${networkId}/wireless/rfProfiles/${result.id}`,
      null,
      apiKey
    );

    const rfDiffs = [];
    if (created.twoFourGhzSettings.maxPower !== payload.twoFourGhzSettings.maxPower) {
      rfDiffs.push(
        `2.4GHz maxPower: 期待値「${payload.twoFourGhzSettings.maxPower}」` +
        `→ 実際「${created.twoFourGhzSettings.maxPower}」`
      );
    }
    if (created.fiveGhzSettings.maxPower !== payload.fiveGhzSettings.maxPower) {
      rfDiffs.push(
        `5GHz maxPower: 期待値「${payload.fiveGhzSettings.maxPower}」` +
        `→ 実際「${created.fiveGhzSettings.maxPower}」`
      );
    }

    if (rfDiffs.length === 0) {
      updateStatus(sheet, 2, 5, '✅ 一致');
      writeLog('差分チェック RF Profile', 'Demo-RF-Profile', '✅ 一致');
    } else {
      updateStatus(sheet, 2, 5, `⚠️ 不一致:\n${rfDiffs.join('\n')}`);
      writeLog('差分チェック RF Profile', 'Demo-RF-Profile',
        `⚠️ 不一致: ${rfDiffs.join(' / ')}`);
    }
  } catch (e) {
    updateStatus(sheet, 2, 4, `❌ エラー: ${e.message}`);
    writeLog('RF Profile作成', 'Demo-RF-Profile', `❌ エラー: ${e.message}`);
  }
}

// ============================================================
// 確認用：現在のSSID設定をログに出力
// ============================================================
function verifySSIDSettings() {
  const config    = getConfig();
  const apiKey    = config['API_KEY'];
  const networkId = config['NETWORK_ID'];

  try {
    const endpoint = `/v1/networks/${networkId}/wireless/ssids`;
    const result   = merakiRequest('GET', endpoint, null, apiKey);
    result.forEach(ssid => {
      Logger.log(
        `SSID ${ssid.number}: ${ssid.name} | ` +
        `Enabled: ${ssid.enabled} | ` +
        `Auth: ${ssid.authMode} | ` +
        `IPMode: ${ssid.ipAssignmentMode}`
      );
    });
    writeLog('SSID確認', networkId, '✅ 成功');
    SpreadsheetApp.getUi().alert(
      '✅ 確認完了！詳細はApps ScriptのログをConfirmしてください。'
    );
  } catch (e) {
    writeLog('SSID確認', networkId, `❌ エラー: ${e.message}`);
    SpreadsheetApp.getUi().alert(`❌ エラー: ${e.message}`);
  }
}

// ============================================================
// カスタムメニュー：Spreadsheet起動時に表示
// ============================================================
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🚀 Meraki 初期設定')
    .addItem('🎉 全設定を一括反映する（MX→MS→MR→RF）', 'applyAllSettings')
    .addSeparator()
    .addItem('🌐 MX VLAN設定を反映する',               'applyVlanSettings')
    .addItem('🔌 MSトランク設定を反映する',              'applyMsSettings')
    .addItem('📶 MR SSID設定を反映する',                'applySSIDSettings')
    .addItem('📡 RF Profile設定を反映する',             'applyRFSettings')
    .addSeparator()
    .addItem('💾 現在の設定をバックアップする',           'backupCurrentSettings')
    .addItem('↩️  設定をロールバックする',                'rollbackSettings')
    .addSeparator()
    .addItem('🔍 SSID設定を確認する',                   'verifySSIDSettings')
    .addToUi();
}
