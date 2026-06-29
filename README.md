# Meraki × Google Spreadsheet Network Configuration Automation Tool 🚀

An automated network initial configuration tool that integrates
Cisco Meraki Dashboard API with Google Spreadsheet.

## Overview

Simply enter configuration values into Google Spreadsheet to
automatically apply initial settings for MX, MS, and MR devices.

### Key Features

- ✅ Automated MX VLAN configuration
- ✅ Automated MS trunk port configuration
- ✅ Automated MR SSID configuration
- ✅ Automated RF Profile configuration
- ✅ Automatic diff check after configuration applied
- ✅ Automatic execution log recording
- ✅ Backup and rollback functionality
- ✅ Japanese and English versions available

---

## Requirements

| Item | Details |
|------|---------|
| Google Spreadsheet | Google account required |
| Google Apps Script | Included with Spreadsheet (free) |
| Cisco Meraki | Dashboard API must be enabled |
| Supported Devices | MX, MS, MR |

---

## Setup Instructions

### Step 1: Obtain Meraki API Key

#### 1-1. Log in to Meraki Dashboard

```
https://dashboard.meraki.com
```

#### 1-2. Enable API Access

```
Click your account name (top right)
  → My Profile
  → API access section
  → Check "Enable access to the Cisco Meraki Dashboard API"
  → Save
```

#### 1-3. Generate API Key

```
My Profile
  → API access section
  → Click "Generate new API key"
  → Copy the displayed API key and save it in a secure location

⚠️ The API key is only displayed once.
   Make sure to copy and save it immediately.
```

#### 1-4. Confirm Organization ID and Network ID

**How to find Organization ID:**

```
Meraki Dashboard
  → Scroll down to the bottom of the page
  → Organization ID is displayed
    Ex) Data for "organization name" (organization ID: "your ID") is hosted in Asia-Pacific
```

Or confirm via the following API:

```
GET https://api.meraki.com/api/v1/organizations
```

**How to find Network ID:**

Confirm via the following API:

```
GET https://api.meraki.com/api/v1/organizations/{organizationId}/networks
```

---

### Step 2: Google Spreadsheet Setup

#### 2-1. Create a New Spreadsheet

```
Access Google Drive
  → New (+)
  → Google Sheets
  → Blank spreadsheet
```

#### 2-2. Create Required Sheets

Create sheets with the following names:

| Sheet Name | Purpose |
|-----------|---------|
| `Config` | Manage API key and Network ID |
| `VLAN_Settings` | MX VLAN configuration values |
| `MS_Settings` | MS trunk port configuration values |
| `SSID_Settings` | MR SSID configuration values |
| `RF_Settings` | RF Profile configuration values |

#### 2-3. Enter Headers in Each Sheet

**Config Sheet (Column A & B):**

```
Column A    Column B
─────────────────────────────────────
API_KEY     your_api_key_here
NETWORK_ID  L_123456789
```

**VLAN_Settings Sheet (Row 1):**

```
VLAN ID | VLAN Name | Subnet | MX IP Address | DHCP Enabled | DNS Server | Status | Diff Check
```

**MS_Settings Sheet (Row 1):**

```
Port ID | Port Name | Type | Native VLAN | Allowed VLANs | PoE Enabled | Status | Diff Check
```

**SSID_Settings Sheet (Row 1):**

```
SSID Number | SSID Name | Enabled | Auth Mode | Password | RADIUS Server IP | RADIUS Port | RADIUS Secret | VLAN ID | Bandwidth Limit(Kbps) | Guest Isolation | IP Mode | Status | Diff Check
```

**RF_Settings Sheet:**

```
Parameter              | 2.4GHz | 5GHz  | Status | Diff Check
Max TX Power (dBm)     | 18     | 23    |        |
Min TX Power (dBm)     | 5      | 8     |        |
Min Bitrate (Mbps)     | 11     | 12    |        |
Channel Width          | 20     | 40    |        |
RXSOP Threshold        | -85    | -85   |        |
```

#### 2-4. Configure Dropdown Lists

**Auth Mode (Column D) in SSID_Settings:**
```
open, WPA2 Personal, WPA3 Personal, WPA2 Enterprise, WPA3 Enterprise
```

**IP Mode (Column L) in SSID_Settings:**
```
NAT mode, Bridge mode, Layer 3 roaming
```

**Enabled (Column C) and Guest Isolation (Column K):**
```
TRUE, FALSE
```

---

### Step 3: Google Apps Script Setup

#### 3-1. Open Apps Script Editor

```
Spreadsheet menu bar
  → Extensions
  → Apps Script
```

#### 3-2. Paste the Script

```
Apps Script editor opens
  → Delete all existing code
  → Copy the appropriate file from this repository:
     · Japanese version: gas/meraki_setup_ja.gs
     · English version:  gas/meraki_setup_en.gs
  → Paste into the editor
  → Ctrl + S (Save)
```

#### 3-3. Initial Execution and Permission Authorization

```
Apps Script editor toolbar
  → Select "onOpen" from the function dropdown
  → Click ▶ Run
  → "Authorization required" dialog appears
  → Click "Review permissions"
  → Select your Google account
  → Click "Advanced"
  → Click "Go to [project name] (unsafe)"
  → Click "Allow"
```

#### 3-4. Verify Custom Menu

```
Return to Spreadsheet
  → Verify the following appears in the menu bar:

  Japanese version: "🚀 Meraki 初期設定"
  English version:  "🚀 Meraki Setup"
```

---

### Step 4: Enter API Key in Config Sheet

```
Open Config sheet
  → Cell B1: Enter your Meraki API key
  → Cell B2: Enter your Network ID
```

> ⚠️ **Security Notice**
> Manage your API key carefully.
> Review the Spreadsheet sharing settings and
> restrict access to unauthorized accounts.

---

### Step 5: Verify Operation

#### 5-1. Verify SSID Settings (Connection Test)

```
English version: 🚀 Meraki Setup → 🔍 Verify SSID Settings
```

#### 5-2. Run Backup

```
English version: 🚀 Meraki Setup → 💾 Backup Current Settings
```

#### 5-3. Apply All Settings

```
English version: 🚀 Meraki Setup → 🎉 Apply All Settings (MX→MS→MR→RF)
```

---

## Repository Structure

```
meraki-spreadsheet-automation/
  ├── README.md
  ├── gas/
  │   ├── meraki_setup_ja.gs    # Japanese version script
  │   └── meraki_setup_en.gs    # English version script
  └── docs/
      ├── demo_scenario_ja.md   # Demo scenario (Japanese)
      ├── demo_scenario_en.md   # Demo scenario (English) 
      └── api_endpoints.md      # API endpoints reference
```

---

## Troubleshooting

| Error | Cause | Solution |
|-------|-------|---------|
| `API Error 401` | Invalid API key | Re-check API key in Config sheet |
| `API Error 404` | Incorrect Network ID | Re-check Network ID in Meraki Dashboard |
| `API Error 400` | Invalid configuration value | Check Auth Mode and password in SSID settings |
| `API Error 429` | Rate limit exceeded | Wait a moment and try again |
| `Sheet not found` | Sheet name mismatch | Verify sheet names exactly match the script |
| Menu not displayed | Permission authorization incomplete | Re-check authorization in Step 3-3 |

---

## API Endpoints Used

Base URL: `https://api.meraki.com/api/v1`

| # | Purpose | Method | Endpoint |
|---|---------|--------|---------|
| 1 | Enable VLAN feature | PUT | `/networks/{networkId}/appliance/vlans/settings` |
| 2 | Get VLAN list | GET | `/networks/{networkId}/appliance/vlans` |
| 3 | Create new VLAN | POST | `/networks/{networkId}/appliance/vlans` |
| 4 | Update VLAN settings | PUT | `/networks/{networkId}/appliance/vlans/{vlanId}` |
| 5 | Get device list | GET | `/networks/{networkId}/devices` |
| 6 | Update switch port settings | PUT | `/devices/{serial}/switch/ports/{portId}` |
| 7 | Get switch port settings | GET | `/devices/{serial}/switch/ports/{portId}` |
| 8 | Update SSID settings | PUT | `/networks/{networkId}/wireless/ssids/{number}` |
| 9 | Get SSID settings | GET | `/networks/{networkId}/wireless/ssids/{number}` |
| 10 | Get SSID list | GET | `/networks/{networkId}/wireless/ssids` |
| 11 | Create RF Profile | POST | `/networks/{networkId}/wireless/rfProfiles` |
| 12 | Get RF Profile | GET | `/networks/{networkId}/wireless/rfProfiles/{rfProfileId}` |

---

## References

- [Cisco Meraki Dashboard API Documentation](https://developer.cisco.com/meraki/api-v1/)
- [Google Apps Script Documentation](https://developers.google.com/apps-script)
- [Meraki Developer Hub](https://developer.cisco.com/meraki/)

---

## License

MIT License

---

## ⚠️ Disclaimer

This tool is provided **"as is"** without any warranty,
express or implied.

### General
- The developer assumes no responsibility for any damage
  or loss resulting from the use of this tool.
- Users are responsible for ensuring the proper
  configuration and use of this tool.
- Always **backup your data** before making any changes
  to your network configuration.

### Meraki API
- This tool uses the Cisco Meraki Dashboard API.
  Usage is subject to the
  [Meraki API Terms of Service](https://meraki.cisco.com/support/#api).
- API keys must be managed securely.
  **Do not share or expose your API key** in public repositories.
- This tool is **not officially supported by Cisco or Meraki**.
  It is an independent community tool.

### Network Impact
- Applying configurations via this tool will make
  **real changes to your live network**.
- Always test in a **non-production environment** first.
- The rollback feature restores settings from a backup,
  but **does not guarantee full recovery** in all scenarios.

### Google Spreadsheet & Apps Script
- This tool uses Google Apps Script to interact
  with the Meraki API.
  Usage is subject to
  [Google's Terms of Service](https://policies.google.com/terms).
- Users are responsible for managing access permissions
  to their Google Spreadsheet.

## Author

Cisco Customer Experience - Customer Success Team
