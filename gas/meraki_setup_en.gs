// ============================================================
// Cisco Meraki Initial Setup Demo - Google Apps Script
// MX VLAN + MS Trunk + MR SSID + RF Profile Integration
// English Version
// ============================================================

// ── Constants ─────────────────────────────────────────────
const SHEET_CONFIG  = 'Config';
const SHEET_VLAN    = 'VLAN_Settings';
const SHEET_MS      = 'MS_Settings';
const SHEET_SSID    = 'SSID_Settings';
const SHEET_RF      = 'RF_Settings';
const BASE_URL      = 'https://api.meraki.com/api';

// ============================================================
// Utility: Show Confirmation Dialog
// ============================================================
function showConfirmDialog(title, message) {
  const ui      = SpreadsheetApp.getUi();
  const confirm = ui.alert(title, message, ui.ButtonSet.YES_NO);
  return confirm === ui.Button.YES;
}

// ============================================================
// Utility: Get Config from Config Sheet
// ============================================================
function getConfig() {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_CONFIG);

  if (!sheet) {
    throw new Error(
      `❌ Sheet not found.\n` +
      `Please check that a sheet named "${SHEET_CONFIG}" exists.`
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
// Utility: Meraki API Common Request Function
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
// Utility: Update Status Cell
// ============================================================
function updateStatus(sheet, rowIndex, colIndex, message) {
  sheet.getRange(rowIndex, colIndex).setValue(message);
}

// ============================================================
// Utility: Ensure Log Sheet Header Exists
// ============================================================
function ensureLogHeader() {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  let sheet   = ss.getSheetByName('Log');

  if (!sheet) {
    sheet = ss.insertSheet('Log');
  }

  const firstCell = sheet.getRange(1, 1).getValue();
  if (firstCell === '' || firstCell === null) {
    sheet.getRange(1, 1, 1, 5).setValues([[
      'Timestamp', 'Executed By', 'Action', 'Target', 'Result'
    ]]);
    sheet.getRange(1, 1, 1, 5)
      .setBackground('#4A86E8')
      .setFontColor('#FFFFFF')
      .setFontWeight('bold');

    sheet.setColumnWidth(1, 160);
    sheet.setColumnWidth(2, 200);
    sheet.setColumnWidth(3, 180);
    sheet.setColumnWidth(4, 220);
    sheet.setColumnWidth(5, 300);
  }

  return sheet;
}

// ============================================================
// Utility: Write Execution Log
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
// Diff Check: MX VLAN
// ============================================================
function checkVlanDiff(sheet, rowIndex, vlanId, payload, apiKey, networkId) {

  const endpoint = `/v1/networks/${networkId}/appliance/vlans/${vlanId}`;
  const current  = merakiRequest('GET', endpoint, null, apiKey);

  const diffs = [];

  if (current.name !== payload.name) {
    diffs.push(`name: Expected "${payload.name}" → Actual "${current.name}"`);
  }
  if (current.subnet !== payload.subnet) {
    diffs.push(`subnet: Expected "${payload.subnet}" → Actual "${current.subnet}"`);
  }
  if (current.applianceIp !== payload.applianceIp) {
    diffs.push(
      `applianceIp: Expected "${payload.applianceIp}" → Actual "${current.applianceIp}"`
    );
  }
  if (payload.dnsNameservers &&
      current.dnsNameservers !== payload.dnsNameservers) {
    diffs.push(
      `dns: Expected "${payload.dnsNameservers}" → Actual "${current.dnsNameservers}"`
    );
  }

  if (diffs.length === 0) {
    sheet.getRange(rowIndex, 8).setValue('✅ Match');
  } else {
    sheet.getRange(rowIndex, 8).setValue(`⚠️ Mismatch:\n${diffs.join('\n')}`);
  }

  return diffs;
}

// ============================================================
// Diff Check: MS Switch Port
// ============================================================
function checkMsDiff(sheet, rowIndex, serial, portId, payload, apiKey) {

  const endpoint = `/v1/devices/${serial}/switch/ports/${portId}`;
  const current  = merakiRequest('GET', endpoint, null, apiKey);

  const diffs = [];

  if (current.name !== payload.name) {
    diffs.push(`name: Expected "${payload.name}" → Actual "${current.name}"`);
  }
  if (current.type !== payload.type) {
    diffs.push(`type: Expected "${payload.type}" → Actual "${current.type}"`);
  }
  if (payload.type === 'trunk' && current.vlan !== payload.vlan) {
    diffs.push(`nativeVlan: Expected "${payload.vlan}" → Actual "${current.vlan}"`);
  }
  if (payload.type === 'trunk' &&
      String(current.allowedVlans) !== String(payload.allowedVlans)) {
    diffs.push(
      `allowedVlans: Expected "${payload.allowedVlans}" → Actual "${current.allowedVlans}"`
    );
  }
  if (current.poeEnabled !== payload.poeEnabled) {
    diffs.push(
      `poeEnabled: Expected "${payload.poeEnabled}" → Actual "${current.poeEnabled}"`
    );
  }

  if (diffs.length === 0) {
    sheet.getRange(rowIndex, 8).setValue('✅ Match');
  } else {
    sheet.getRange(rowIndex, 8).setValue(`⚠️ Mismatch:\n${diffs.join('\n')}`);
  }

  return diffs;
}

// ============================================================
// Diff Check: MR SSID
// ============================================================
function checkDiff(sheet, rowIndex, ssidNumber, payload, apiKey, networkId) {

  const endpoint = `/v1/networks/${networkId}/wireless/ssids/${ssidNumber}`;
  const current  = merakiRequest('GET', endpoint, null, apiKey);

  const diffs = [];

  if (current.name !== payload.name) {
    diffs.push(`name: Expected "${payload.name}" → Actual "${current.name}"`);
  }
  if (current.enabled !== payload.enabled) {
    diffs.push(`enabled: Expected "${payload.enabled}" → Actual "${current.enabled}"`);
  }
  if (current.authMode !== payload.authMode) {
    diffs.push(`authMode: Expected "${payload.authMode}" → Actual "${current.authMode}"`);
  }

  if (payload.useVlanTagging) {
    if (payload.ipAssignmentMode === 'NAT mode' ||
        payload.ipAssignmentMode === 'Bridge mode') {
      Logger.log(
        `ℹ️ SSID ${ssidNumber}: Skipping VLAN check for ${payload.ipAssignmentMode}`
      );
    } else {
      const expectedVlan = Number(payload.defaultVlanId);
      const actualVlan   = current.defaultVlanId !== undefined
                         ? Number(current.defaultVlanId)
                         : null;

      if (actualVlan === null) {
        diffs.push(
          `vlanId: VLAN may not be enabled on Meraki Dashboard. ` +
          `(Expected "${expectedVlan}" → Actual "Not Set")`
        );
      } else if (actualVlan !== expectedVlan) {
        diffs.push(
          `vlanId: Expected "${expectedVlan}" → Actual "${actualVlan}"`
        );
      }
    }
  }

  if (current.ipAssignmentMode !== payload.ipAssignmentMode) {
    diffs.push(
      `ipAssignmentMode: Expected "${payload.ipAssignmentMode}" ` +
      `→ Actual "${current.ipAssignmentMode}"`
    );
  }

  if (diffs.length === 0) {
    sheet.getRange(rowIndex, 14).setValue('✅ Match');
  } else {
    sheet.getRange(rowIndex, 14).setValue(`⚠️ Mismatch:\n${diffs.join('\n')}`);
  }

  return diffs;
}

// ============================================================
// 💾 Backup: Save Current Settings to Sheet
// ============================================================
function backupCurrentSettings() {

  if (!showConfirmDialog(
    '💾 Backup Confirmation',
    'Backup current Meraki settings.\n\n' +
    'Targets:\n' +
    '・MX VLAN Settings\n' +
    '・MR SSID Settings\n\n' +
    'Proceed?'
  )) {
    SpreadsheetApp.getUi().alert('❌ Cancelled.');
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

  // ── META Info ─────────────────────────────────
  backupSheet.appendRow(['[META]', 'Backup Timestamp',
    Utilities.formatDate(now, 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss'), '', '', '', '']);
  backupSheet.appendRow(['[META]', 'Executed By',
    Session.getActiveUser().getEmail(), '', '', '', '']);
  backupSheet.appendRow(['[META]', 'Network ID', networkId, '', '', '', '']);
  backupSheet.appendRow(['', '', '', '', '', '', '']);

  try {
    // ── MX VLAN Settings ──────────────────────────
    backupSheet.appendRow([
      '[MX VLAN]', 'VLAN ID', 'VLAN Name', 'Subnet', 'MX IP Address', 'DNS', ''
    ]);
    backupSheet.getRange(backupSheet.getLastRow(), 1, 1, 6)
      .setBackground('#D9EAD3').setFontWeight('bold');

    const vlans = merakiRequest(
      'GET', `/v1/networks/${networkId}/appliance/vlans`, null, apiKey
    );
    vlans.forEach(vlan => {
      backupSheet.appendRow([
        '[MX VLAN]',
        vlan.id,
        vlan.name,
        vlan.subnet,
        vlan.applianceIp,
        vlan.dnsNameservers || '',
        ''
      ]);
    });

    backupSheet.appendRow(['', '', '', '', '', '', '']);

    // ── MR SSID Settings ──────────────────────────
    backupSheet.appendRow([
      '[MR SSID]', 'SSID Number', 'SSID Name', 'Enabled', 'Auth Mode',
      'VLAN ID', 'IP Mode'
    ]);
    backupSheet.getRange(backupSheet.getLastRow(), 1, 1, 7)
      .setBackground('#FCE5CD').setFontWeight('bold');

    const ssids = merakiRequest(
      'GET', `/v1/networks/${networkId}/wireless/ssids`, null, apiKey
    );
    ssids.forEach(ssid => {
      backupSheet.appendRow([
        '[MR SSID]',
        ssid.number,
        ssid.name,
        ssid.enabled,
        ssid.authMode,
        ssid.defaultVlanId    || '',
        ssid.ipAssignmentMode || ''
      ]);
    });

    writeLog('Backup', sheetName, '✅ Success');
    SpreadsheetApp.getUi().alert(
      `✅ Backup completed!\n\n` +
      `Saved to sheet: ${sheetName}\n\n` +
      `Use this sheet name when rolling back.`
    );

  } catch (e) {
    writeLog('Backup', sheetName, `❌ Error: ${e.message}`);
    SpreadsheetApp.getUi().alert(
      `❌ An error occurred during backup:\n${e.message}`
    );
  }
}

// ============================================================
// ↩️  Rollback: Restore Settings from Backup Sheet
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
      '❌ No backup found.\n' +
      'Please run "💾 Backup Current Settings" first.'
    );
    return;
  }

  const backupList = backupSheets
    .map((name, index) => `${index + 1}. ${name}`)
    .join('\n');

  const ui       = SpreadsheetApp.getUi();
  const response = ui.prompt(
    '↩️  Rollback',
    `Enter the number of the backup to restore:\n\n${backupList}`,
    ui.ButtonSet.OK_CANCEL
  );

  if (response.getSelectedButton() !== ui.Button.OK) {
    ui.alert('❌ Cancelled.');
    return;
  }

  const selectedIndex = Number(response.getResponseText()) - 1;

  if (isNaN(selectedIndex) ||
      selectedIndex < 0   ||
      selectedIndex >= backupSheets.length) {
    ui.alert('❌ Invalid number. Please try again.');
    return;
  }

  const selectedSheetName = backupSheets[selectedIndex];

  if (!showConfirmDialog(
    '⚠️ Rollback Confirmation',
    `Restore settings from the following backup.\n\n` +
    `Source: ${selectedSheetName}\n\n` +
    `⚠️ Current settings will be overwritten.\n` +
    `Proceed?`
  )) {
    ui.alert('❌ Cancelled.');
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

    // ── MX VLAN Rollback ──────────────────────────
    if (section === '[MX VLAN]' &&
        row[1] !== 'VLAN ID'   &&
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
        writeLog('Rollback MX VLAN', `VLAN ${vlanId} - ${vlanName}`, '✅ Success');
      } catch (e) {
        writeLog('Rollback MX VLAN', `VLAN ${vlanId} - ${vlanName}`,
          `❌ Error: ${e.message}`);
        vlanErrors++;
      }
      Utilities.sleep(300);
    }

    // ── MR SSID Rollback ──────────────────────────
    if (section === '[MR SSID]'    &&
        row[1] !== 'SSID Number'   &&
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
        writeLog('Rollback MR SSID', `SSID ${ssidNumber} - ${ssidName}`, '✅ Success');
      } catch (e) {
        writeLog('Rollback MR SSID', `SSID ${ssidNumber} - ${ssidName}`,
          `❌ Error: ${e.message}`);
        ssidErrors++;
      }
      Utilities.sleep(300);
    }
  });

  const errorCount = vlanErrors + ssidErrors;
  if (errorCount === 0) {
    SpreadsheetApp.getUi().alert(
      `✅ Rollback completed!\n\n` +
      `Restored from: ${selectedSheetName}\n` +
      `Check the Log sheet for details.`
    );
  } else {
    SpreadsheetApp.getUi().alert(
      `⚠️ Rollback completed with errors.\n\n` +
      `VLAN Errors: ${vlanErrors}\n` +
      `SSID Errors: ${ssidErrors}\n\n` +
      `Check the Log sheet for details.`
    );
  }
}

// ============================================================
// MX: Enable VLANs
// ============================================================
function enableMxVlans(apiKey, networkId) {
  const endpoint = `/v1/networks/${networkId}/appliance/vlans/settings`;
  const payload  = { vlansEnabled: true };

  try {
    merakiRequest('PUT', endpoint, payload, apiKey);
    Logger.log('✅ MX VLANs enabled successfully');
    writeLog('MX VLAN Enable', networkId, '✅ Success');
  } catch (e) {
    Logger.log(`❌ MX VLAN Enable Error: ${e.message}`);
    writeLog('MX VLAN Enable', networkId, `❌ Error: ${e.message}`);
    throw e;
  }
}

// ============================================================
// MX: Apply VLAN Settings
// ============================================================
function applyVlanSettings() {

  if (!showConfirmDialog(
    '⚠️ Confirmation',
    'Apply VLAN settings to MX.\n\n' +
    'Targets:\n' +
    '・VLAN 10: Corp-WiFi\n' +
    '・VLAN 20: Guest-WiFi\n' +
    '・VLAN 30: IoT-WiFi\n\n' +
    'Proceed?'
  )) {
    SpreadsheetApp.getUi().alert('❌ Cancelled.');
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
        Logger.log(`✅ VLAN ${vlanId} (${vlanName}) updated`);
      } else {
        merakiRequest('POST',
          `/v1/networks/${networkId}/appliance/vlans`, payload, apiKey);
        Logger.log(`✅ VLAN ${vlanId} (${vlanName}) created`);
      }
      updateStatus(sheet, i + 1, 7, '✅ Success');
      writeLog('MX VLAN Settings', `VLAN ${vlanId} - ${vlanName}`, '✅ Success');

      Utilities.sleep(500);
      const diffs = checkVlanDiff(sheet, i + 1, vlanId, payload, apiKey, networkId);
      if (diffs.length > 0) {
        writeLog('Diff Check MX VLAN', `VLAN ${vlanId} - ${vlanName}`,
          `⚠️ Mismatch: ${diffs.join(' / ')}`);
      } else {
        writeLog('Diff Check MX VLAN', `VLAN ${vlanId} - ${vlanName}`, '✅ Match');
      }
    } catch (e) {
      updateStatus(sheet, i + 1, 7, `❌ Error: ${e.message}`);
      writeLog('MX VLAN Settings', `VLAN ${vlanId} - ${vlanName}`,
        `❌ Error: ${e.message}`);
    }
    Utilities.sleep(300);
  }

  SpreadsheetApp.getUi().alert('✅ MX VLAN settings applied successfully!');
}

// ============================================================
// MS: Apply Switch Port (Trunk) Settings
// ============================================================
function applyMsSettings() {

  if (!showConfirmDialog(
    '⚠️ Confirmation',
    'Apply trunk port settings to MS.\n\n' +
    'Targets:\n' +
    '・Allowed VLANs: 10, 20, 30\n' +
    '・Port Type: Trunk\n\n' +
    'Proceed?'
  )) {
    SpreadsheetApp.getUi().alert('❌ Cancelled.');
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
    SpreadsheetApp.getUi().alert('❌ No MS devices found.');
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
        updateStatus(sheet, i + 1, 7, '✅ Success');
        writeLog('MS Port Settings', `${sw.serial} Port ${portId}`, '✅ Success');

        Utilities.sleep(500);
        const diffs = checkMsDiff(sheet, i + 1, sw.serial, portId, payload, apiKey);
        if (diffs.length > 0) {
          writeLog('Diff Check MS Port', `${sw.serial} Port ${portId}`,
            `⚠️ Mismatch: ${diffs.join(' / ')}`);
        } else {
          writeLog('Diff Check MS Port', `${sw.serial} Port ${portId}`, '✅ Match');
        }
      } catch (e) {
        updateStatus(sheet, i + 1, 7, `❌ Error: ${e.message}`);
        writeLog('MS Port Settings', `${sw.serial} Port ${portId}`,
          `❌ Error: ${e.message}`);
      }
      Utilities.sleep(300);
    });
  }

  SpreadsheetApp.getUi().alert('✅ MS trunk port settings applied successfully!');
}

// ============================================================
// MR: Apply SSID Settings
// ============================================================
function applySSIDSettings() {

  if (!showConfirmDialog(
    '⚠️ Confirmation',
    'Apply SSID settings to MR.\n\n' +
    'Targets:\n' +
    '・SSID 0: Corp-WiFi (VLAN 10)\n' +
    '・SSID 1: Guest-WiFi (VLAN 20)\n' +
    '・SSID 2: IoT-WiFi (VLAN 30)\n\n' +
    'Proceed?'
  )) {
    SpreadsheetApp.getUi().alert('❌ Cancelled.');
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
      updateStatus(sheet, i + 1, 13, '✅ Success');
      writeLog('SSID Settings', `SSID ${ssidNumber} - ${ssidName}`, '✅ Success');

      Utilities.sleep(500);
      const diffs = checkDiff(sheet, i + 1, ssidNumber, payload, apiKey, networkId);
      if (diffs.length > 0) {
        writeLog('Diff Check MR SSID', `SSID ${ssidNumber} - ${ssidName}`,
          `⚠️ Mismatch: ${diffs.join(' / ')}`);
      } else {
        writeLog('Diff Check MR SSID', `SSID ${ssidNumber} - ${ssidName}`, '✅ Match');
      }
    } catch (e) {
      updateStatus(sheet, i + 1, 13, `❌ Error: ${e.message}`);
      writeLog('SSID Settings', `SSID ${ssidNumber} - ${ssidName}`,
        `❌ Error: ${e.message}`);
    }
  }

  SpreadsheetApp.getUi().alert(
    '✅ SSID settings applied and diff check completed!'
  );
}

// ============================================================
// RF Profile: Apply Settings
// ============================================================
function applyRFSettings() {

  if (!showConfirmDialog(
    '⚠️ Confirmation',
    'Apply RF Profile settings.\n\n' +
    'Targets:\n' +
    '・2.4GHz / 5GHz TX Power & Channel Width\n\n' +
    'Proceed?'
  )) {
    SpreadsheetApp.getUi().alert('❌ Cancelled.');
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
      maxPower     : Number(rfData['Max TX Power (dBm)']['2.4']),
      minPower     : Number(rfData['Min TX Power (dBm)']['2.4']),
      minBitrate   : Number(rfData['Min Bitrate (Mbps)']['2.4']),
      channelWidth : String(rfData['Channel Width']['2.4']),
      rxsop        : Number(rfData['RXSOP Threshold']['2.4'])
    },
    fiveGhzSettings : {
      maxPower     : Number(rfData['Max TX Power (dBm)']['5']),
      minPower     : Number(rfData['Min TX Power (dBm)']['5']),
      minBitrate   : Number(rfData['Min Bitrate (Mbps)']['5']),
      channelWidth : String(rfData['Channel Width']['5']),
      rxsop        : Number(rfData['RXSOP Threshold']['5'])
    }
  };

  try {
    const endpoint = `/v1/networks/${networkId}/wireless/rfProfiles`;
    const result   = merakiRequest('POST', endpoint, payload, apiKey);
    Logger.log(`✅ RF Profile created: ID = ${result.id}`);
    updateStatus(sheet, 2, 4, '✅ Success');
    writeLog('RF Profile', 'Demo-RF-Profile', `✅ Success ID: ${result.id}`);

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
        `2.4GHz maxPower: Expected "${payload.twoFourGhzSettings.maxPower}"` +
        ` → Actual "${created.twoFourGhzSettings.maxPower}"`
      );
    }
    if (created.twoFourGhzSettings.minPower !== payload.twoFourGhzSettings.minPower) {
      rfDiffs.push(
        `2.4GHz minPower: Expected "${payload.twoFourGhzSettings.minPower}"` +
        ` → Actual "${created.twoFourGhzSettings.minPower}"`
      );
    }
    if (created.fiveGhzSettings.maxPower !== payload.fiveGhzSettings.maxPower) {
      rfDiffs.push(
        `5GHz maxPower: Expected "${payload.fiveGhzSettings.maxPower}"` +
        ` → Actual "${created.fiveGhzSettings.maxPower}"`
      );
    }
    if (created.fiveGhzSettings.minPower !== payload.fiveGhzSettings.minPower) {
      rfDiffs.push(
        `5GHz minPower: Expected "${payload.fiveGhzSettings.minPower}"` +
        ` → Actual "${created.fiveGhzSettings.minPower}"`
      );
    }

    if (rfDiffs.length === 0) {
      updateStatus(sheet, 2, 5, '✅ Match');
      writeLog('Diff Check RF Profile', 'Demo-RF-Profile', '✅ Match');
    } else {
      updateStatus(sheet, 2, 5, `⚠️ Mismatch:\n${rfDiffs.join('\n')}`);
      writeLog('Diff Check RF Profile', 'Demo-RF-Profile',
        `⚠️ Mismatch: ${rfDiffs.join(' / ')}`);
    }

    SpreadsheetApp.getUi().alert(
      `✅ RF Profile settings completed!\nProfile ID: ${result.id}`
    );

  } catch (e) {
    Logger.log(`❌ RF Profile Error: ${e.message}`);
    updateStatus(sheet, 2, 4, `❌ Error: ${e.message}`);
    writeLog('RF Profile', 'Demo-RF-Profile', `❌ Error: ${e.message}`);
    SpreadsheetApp.getUi().alert(`❌ An error occurred:\n${e.message}`);
  }
}

// ============================================================
// Apply All Settings (MX → MS → MR → RF)
// ============================================================
function applyAllSettings() {

  if (!showConfirmDialog(
    '⚠️ Confirmation',
    'Apply all settings to all devices.\n\n' +
    'Execution Order:\n' +
    'Step 1：🌐 MX VLAN Settings (VLAN 10, 20, 30)\n' +
    'Step 2：🔌 MS Trunk Port Settings\n' +
    'Step 3：📶 MR SSID Settings (with diff check)\n' +
    'Step 4：📡 RF Profile Settings (with diff check)\n\n' +
    'Proceed?'
  )) {
    SpreadsheetApp.getUi().alert('❌ Cancelled.');
    return;
  }

  const ui = SpreadsheetApp.getUi();

  ui.alert('⏳ Step 1/4: Applying MX VLAN settings...');
  applyVlanSettingsWithoutConfirm();
  Utilities.sleep(1000);

  ui.alert('⏳ Step 2/4: Applying MS trunk port settings...');
  applyMsSettingsWithoutConfirm();
  Utilities.sleep(1000);

  ui.alert('⏳ Step 3/4: Applying MR SSID settings...');
  applySSIDSettingsWithoutConfirm();
  Utilities.sleep(1000);

  ui.alert('⏳ Step 4/4: Applying RF Profile settings...');
  applyRFSettingsWithoutConfirm();

  ui.alert(
    '🎉 All settings applied successfully!\n' +
    'Please check the Log sheet for details.'
  );
}

// ============================================================
// Internal: Apply Settings Without Confirmation Dialog
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
      updateStatus(sheet, i + 1, 7, '✅ Success');
      writeLog('MX VLAN Settings', `VLAN ${vlanId} - ${vlanName}`, '✅ Success');

      Utilities.sleep(500);
      const diffs = checkVlanDiff(sheet, i + 1, vlanId, payload, apiKey, networkId);
      if (diffs.length > 0) {
        writeLog('Diff Check MX VLAN', `VLAN ${vlanId} - ${vlanName}`,
          `⚠️ Mismatch: ${diffs.join(' / ')}`);
      } else {
        writeLog('Diff Check MX VLAN', `VLAN ${vlanId} - ${vlanName}`, '✅ Match');
      }
    } catch (e) {
      updateStatus(sheet, i + 1, 7, `❌ Error: ${e.message}`);
      writeLog('MX VLAN Settings', `VLAN ${vlanId} - ${vlanName}`,
        `❌ Error: ${e.message}`);
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
        updateStatus(sheet, i + 1, 7, '✅ Success');
        writeLog('MS Port Settings', `${sw.serial} Port ${portId}`, '✅ Success');

        Utilities.sleep(500);
        const diffs = checkMsDiff(sheet, i + 1, sw.serial, portId, payload, apiKey);
        if (diffs.length > 0) {
          writeLog('Diff Check MS Port', `${sw.serial} Port ${portId}`,
            `⚠️ Mismatch: ${diffs.join(' / ')}`);
        } else {
          writeLog('Diff Check MS Port', `${sw.serial} Port ${portId}`, '✅ Match');
        }
      } catch (e) {
        updateStatus(sheet, i + 1, 7, `❌ Error: ${e.message}`);
        writeLog('MS Port Settings', `${sw.serial} Port ${portId}`,
          `❌ Error: ${e.message}`);
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
        payload.wpaEncryptionMode = 'WPA3  192-bit Security';
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
      updateStatus(sheet, i + 1, 13, '✅ Success');
      writeLog('SSID Settings', `SSID ${ssidNumber} - ${ssidName}`, '✅ Success');

      Utilities.sleep(500);
      const diffs = checkDiff(sheet, i + 1, ssidNumber, payload, apiKey, networkId);
      if (diffs.length > 0) {
        writeLog('Diff Check MR SSID', `SSID ${ssidNumber} - ${ssidName}`,
          `⚠️ Mismatch: ${diffs.join(' / ')}`);
      } else {
        writeLog('Diff Check MR SSID', `SSID ${ssidNumber} - ${ssidName}`, '✅ Match');
      }
    } catch (e) {
      updateStatus(sheet, i + 1, 13, `❌ Error: ${e.message}`);
      writeLog('SSID Settings', `SSID ${ssidNumber} - ${ssidName}`,
        `❌ Error: ${e.message}`);
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
      maxPower     : Number(rfData['Max TX Power (dBm)']['2.4']),
      minPower     : Number(rfData['Min TX Power (dBm)']['2.4']),
      minBitrate   : Number(rfData['Min Bitrate (Mbps)']['2.4']),
      channelWidth : String(rfData['Channel Width']['2.4']),
      rxsop        : Number(rfData['RXSOP Threshold']['2.4'])
    },
    fiveGhzSettings : {
      maxPower     : Number(rfData['Max TX Power (dBm)']['5']),
      minPower     : Number(rfData['Min TX Power (dBm)']['5']),
      minBitrate   : Number(rfData['Min Bitrate (Mbps)']['5']),
      channelWidth : String(rfData['Channel Width']['5']),
      rxsop        : Number(rfData['RXSOP Threshold']['5'])
    }
  };

  try {
    const endpoint = `/v1/networks/${networkId}/wireless/rfProfiles`;
    const result   = merakiRequest('POST', endpoint, payload, apiKey);
    updateStatus(sheet, 2, 4, '✅ Success');
    writeLog('RF Profile', 'Demo-RF-Profile', `✅ Success ID: ${result.id}`);

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
        `2.4GHz maxPower: Expected "${payload.twoFourGhzSettings.maxPower}"` +
        ` → Actual "${created.twoFourGhzSettings.maxPower}"`
      );
    }
    if (created.fiveGhzSettings.maxPower !== payload.fiveGhzSettings.maxPower) {
      rfDiffs.push(
        `5GHz maxPower: Expected "${payload.fiveGhzSettings.maxPower}"` +
        ` → Actual "${created.fiveGhzSettings.maxPower}"`
      );
    }

    if (rfDiffs.length === 0) {
      updateStatus(sheet, 2, 5, '✅ Match');
      writeLog('Diff Check RF Profile', 'Demo-RF-Profile', '✅ Match');
    } else {
      updateStatus(sheet, 2, 5, `⚠️ Mismatch:\n${rfDiffs.join('\n')}`);
      writeLog('Diff Check RF Profile', 'Demo-RF-Profile',
        `⚠️ Mismatch: ${rfDiffs.join(' / ')}`);
    }
  } catch (e) {
    updateStatus(sheet, 2, 4, `❌ Error: ${e.message}`);
    writeLog('RF Profile', 'Demo-RF-Profile', `❌ Error: ${e.message}`);
  }
}

// ============================================================
// Verify: Get Current SSID Settings
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
    writeLog('Verify SSID', networkId, '✅ Success');
    SpreadsheetApp.getUi().alert(
      '✅ Verification complete!\n' +
      'Please check the Apps Script log for details.'
    );
  } catch (e) {
    writeLog('Verify SSID', networkId, `❌ Error: ${e.message}`);
    SpreadsheetApp.getUi().alert(`❌ Error: ${e.message}`);
  }
}

// ============================================================
// Custom Menu: Display on Spreadsheet Open
// ============================================================
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🚀 Meraki Setup')
    .addItem('🎉 Apply All Settings (MX→MS→MR→RF)', 'applyAllSettings')
    .addSeparator()
    .addItem('🌐 Apply MX VLAN Settings',            'applyVlanSettings')
    .addItem('🔌 Apply MS Trunk Settings',            'applyMsSettings')
    .addItem('📶 Apply MR SSID Settings',             'applySSIDSettings')
    .addItem('📡 Apply RF Profile Settings',          'applyRFSettings')
    .addSeparator()
    .addItem('💾 Backup Current Settings',            'backupCurrentSettings')
    .addItem('↩️  Rollback Settings',                  'rollbackSettings')
    .addSeparator()
    .addItem('🔍 Verify SSID Settings',               'verifySSIDSettings')
    .addToUi();
}
