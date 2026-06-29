# Meraki × Google Spreadsheet Configuration Automation Demo Scenario 🎯

---

## Demo Overview

| Item | Details |
|------|---------|
| Demo Title | Meraki × Google Spreadsheet Configuration Automation Demo |
| Duration | Approximately 35-45 minutes |
| Target Audience | Network Administrators, IT Managers |
| Objective | Demonstrate the value of network configuration automation using Meraki API |
| Requirements | PC, Meraki Environment, Google Spreadsheet |

---

## Agenda

```
① What We Built          (5-7 min)
        ↓
② Problem Statement      (3-5 min)
        ↓
③ Solution Overview      (3-5 min)
        ↓
④ Live Demo              (10-15 min)
        ↓
⑤ API Endpoints Review   (3-5 min)
        ↓
⑥ Summary & Benefits     (3-5 min)
        ↓
⑦ Q&A                    (5-10 min)
─────────────────────────────────────
Total: Approximately 35-45 minutes
```

---

## 1. What We Built (5-7 min)

> **Objective:**
> Help the audience understand what was built
> before the demo begins.
> Set the right expectations.

---

### Opening Statement

```
"Before we start the demo, let me walk you through
 what we have built and how it works.
 This will help you better understand
 what you are seeing during the demo."
```

---

### Overall Architecture

```
Google Spreadsheet
  ├── Config Sheet         : Manage API Key & Network ID
  ├── VLAN_Settings Sheet  : MX VLAN configuration values
  ├── MS_Settings Sheet    : MS trunk port configuration values
  ├── SSID_Settings Sheet  : MR SSID configuration values
  ├── RF_Settings Sheet    : RF Profile configuration values
  └── Log Sheet            : Automatic execution history recording
          ↓
  Google Apps Script (GAS)
          ↓
  Cisco Meraki Dashboard API
          ↓
  MX / MS / MR Devices
```

---

### Implemented Features

| Feature | Description |
|---------|-------------|
| Feature ① | Bulk configuration apply (MX → MS → MR → RF) |
| Feature ② | Confirmation dialog before every configuration change |
| Feature ③ | Automatic diff check after configuration is applied |
| Feature ④ | Automatic execution log (timestamp, user, result) |
| Feature ⑤ | Backup before configuration changes |
| Feature ⑥ | Rollback to restore from backup |

---

### Network Architecture

```
MX (Router)
  ├── VLAN 10: Corp-WiFi   (192.168.10.0/24)
  ├── VLAN 20: Guest-WiFi  (192.168.20.0/24)
  └── VLAN 30: IoT-WiFi    (192.168.30.0/24)
        ↓ Tagging
MS (Switch)
  └── Trunk Port (VLAN 10, 20, 30 allowed)
        ↓ Tagging
MR (Access Point)
  ├── Corp-WiFi  → VLAN 10 (WPA3 Personal)
  ├── Guest-WiFi → VLAN 20 (WPA2 Personal)
  └── IoT-WiFi   → VLAN 30 (WPA2 Enterprise)
```

---

### Sheet Overview

| Sheet Name | Role |
|-----------|------|
| `Config` | Store API Key and Network ID |
| `VLAN_Settings` | Input MX VLAN configuration |
| `MS_Settings` | Input MS trunk port configuration |
| `SSID_Settings` | Input MR SSID configuration |
| `RF_Settings` | Input RF Profile configuration |
| `Log` | Automatically records execution history |
| `Backup_YYYYMMDD` | Automatically saves configuration backups |

---

## 2. Problem Statement (3-5 min)

> **Objective:**
> Build empathy by addressing common pain points
> that the audience is likely experiencing.

---

### Opening Questions

```
"Before we get into the demo, let me ask you a few questions."

"How are you currently handling the initial configuration
 of your Meraki devices?"

"Do any of these challenges sound familiar?"
```

---

### Common Challenges

| Challenge | Scenario |
|-----------|---------|
| ⏰ Time-consuming configuration | Manually entering each SSID one by one in the Dashboard |
| ❌ Human errors occur | Typos in configuration values or missed settings |
| 📋 No configuration history | Unable to track who changed what and when |
| 🔁 Repetitive work | Entering the same settings manually across multiple sites |

---

### Discussion Questions

```
"For example, if you need to apply the same SSID settings
 across 10 different sites,
 how long does that currently take?"

"When a configuration error occurs,
 how do you typically detect it?"

"Do you have a record of configuration changes
 and who made them?"
```

---

## 3. Solution Overview (3-5 min)

> **Objective:**
> Clearly explain how the solution addresses the challenges.

---

### Opening Statement

```
"What we are going to show you today is a demo of
 how Google Spreadsheet and the Meraki API
 can be integrated to automate network configuration."
```

---

### 3 Key Points

| Point | Description |
|-------|-------------|
| ① Simple | Enter settings in a spreadsheet-like table. No deep networking expertise required. |
| ② Accurate | One click applies all settings automatically. Diff check runs after every change. |
| ③ Safe | Automatic backup before changes. One-click rollback if something goes wrong. |

---

### How It Works

```
[ Administrator Actions ]        [ Automated Actions ]

Google Spreadsheet               Meraki Dashboard
  Enter config values   ──→     MX: Apply VLAN settings
  Click the button      ──→     MS: Apply trunk settings
                         ──→     MR: Apply SSID settings
                         ──→     RF: Apply Profile settings
                         ──→     Run diff check
                         ──→     Record execution log
```

---

## 4. Live Demo (10-15 min)

> **Objective:**
> Show the actual tool in action.

---

### Step 1: Review Spreadsheet Configuration (approx. 2 min)

```
"Let me start by opening the Spreadsheet
 and walking you through how it is structured."
```

**Sheets to show:**

| Sheet | Key Points to Highlight |
|-------|------------------------|
| `Config` | Where the API key and Network ID are stored |
| `VLAN_Settings` | VLAN ID, subnet, and MX IP address |
| `SSID_Settings` | SSID name, auth mode, VLAN ID, IP mode |

**Talking Points:**

```
"The administrator only needs to fill in
 the values in this table."

"Dropdown menus are used for key fields
 to prevent input errors."

"Once the values are entered,
 everything else is fully automated."
```

---

### Step 2: Take a Backup (approx. 1-2 min)

```
"Before making any changes,
 we always take a backup of the current settings."
```

**Action:**

```
🚀 Meraki Setup
  → 💾 Backup Current Settings
  → Confirmation dialog: Click YES
```

**Key Points to Show:**

```
"A new sheet named Backup_YYYYMMDD_HHMMSS
 has been automatically created."

"All current settings are saved here.
 If anything goes wrong,
 we can restore from this backup instantly."
```

---

### Step 3: Apply All Settings (approx. 3-5 min)

```
"Now let's apply the configuration
 with a single button click."
```

**Action:**

```
🚀 Meraki Setup
  → 🎉 Apply All Settings (MX→MS→MR→RF)
  → Review the confirmation dialog
  → Click YES
```

**Narration During Execution:**

```
"Here is what is happening behind the scenes:"

Step 1: Creating VLANs 10, 20, and 30 on the MX
Step 2: Configuring trunk ports on the MS
Step 3: Applying SSID settings on the MR
Step 4: Creating the RF Profile
Step 5: Running a diff check after each configuration
```

---

### Step 4: Review the Results (approx. 3-5 min)

**① Check SSID_Settings Sheet:**

```
"You can see the results written automatically
 in each row."
```

| Column | What to Show |
|--------|-------------|
| Column M (Status) | ✅ Success is displayed |
| Column N (Diff Check) | ✅ Match is displayed |

**Talking Points:**

```
"The status tells us whether the configuration
 was applied successfully."

"The diff check automatically confirms that
 the actual settings match what we entered
 in the Spreadsheet."
```

**② Check Log Sheet:**

```
"The Log sheet automatically records
 every action taken."

"We can see exactly who ran it,
 when it was executed,
 and whether it was successful."
```

**③ Verify in Meraki Dashboard:**

```
"Let's open the Meraki Dashboard to confirm
 that the settings have been applied correctly."

"As you can see, the SSIDs and VLANs
 we defined in the Spreadsheet
 are now live in the Dashboard."
```

---

### Step 5: Demonstrate Rollback (approx. 2-3 min)

```
"Finally, let me show you what happens
 if you need to undo a change."
```

**Action:**

```
🚀 Meraki Setup
  → ↩️  Rollback Settings
  → Select backup number from the list
  → Final confirmation dialog: Click YES
```

**Key Points to Show:**

```
"A list of available backups is displayed.
 You simply enter the number of the backup
 you want to restore."

"The settings are restored instantly."

"Even if a misconfiguration occurs,
 you can recover in seconds."
```

---

## 5. API Endpoints Review (3-5 min)

> **Objective:**
> Give technical stakeholders visibility into
> what APIs are being used.
> Highlight the extensibility of Meraki API.

---

### Opening Statement

```
"Let me walk you through the API endpoints
 that are being used under the hood.

 Meraki provides a rich set of APIs,
 and today's demo only scratches the surface
 of what is possible."
```

---

### API Endpoints Used

Base URL: `https://api.meraki.com/api/v1`

**MX (Security Appliance)**

| # | Purpose | Method | Endpoint |
|---|---------|--------|---------|
| 1 | Enable VLAN feature | PUT | `/networks/{networkId}/appliance/vlans/settings` |
| 2 | Get VLAN list | GET | `/networks/{networkId}/appliance/vlans` |
| 3 | Create new VLAN | POST | `/networks/{networkId}/appliance/vlans` |
| 4 | Update VLAN settings | PUT | `/networks/{networkId}/appliance/vlans/{vlanId}` |

**MS (Switch)**

| # | Purpose | Method | Endpoint |
|---|---------|--------|---------|
| 5 | Get device list | GET | `/networks/{networkId}/devices` |
| 6 | Update switch port settings | PUT | `/devices/{serial}/switch/ports/{portId}` |
| 7 | Get switch port settings | GET | `/devices/{serial}/switch/ports/{portId}` |

**MR (Access Point)**

| # | Purpose | Method | Endpoint |
|---|---------|--------|---------|
| 8 | Update SSID settings | PUT | `/networks/{networkId}/wireless/ssids/{number}` |
| 9 | Get SSID settings | GET | `/networks/{networkId}/wireless/ssids/{number}` |
| 10 | Get SSID list | GET | `/networks/{networkId}/wireless/ssids` |
| 11 | Create RF Profile | POST | `/networks/{networkId}/wireless/rfProfiles` |
| 12 | Get RF Profile | GET | `/networks/{networkId}/wireless/rfProfiles/{rfProfileId}` |

**Summary: 12 endpoints total**

| Method | Count | Purpose |
|--------|-------|---------|
| GET | 5 | Configuration verification and diff check |
| POST | 2 | Create new resources |
| PUT | 5 | Update existing settings |

---

### Additional Capabilities

```
"Beyond what we showed today,
 the Meraki API supports many more use cases:"
```

| Category | Examples |
|----------|---------|
| MX | Firewall rules, content filtering, VPN settings |
| MS | Port VLAN settings, link aggregation |
| MR | Wireless client management, RF profile assignment |

---

## 6. Summary & Benefits (3-5 min)

> **Objective:**
> Reinforce the value with concrete numbers.

---

### Time Comparison

| Task | Manual (Before) | Automated (After) |
|------|----------------|------------------|
| SSID configuration (x3) | ~15-20 min | ~1-2 min |
| VLAN configuration (x3) | ~10-15 min | Automated |
| Switch port configuration | ~10-15 min | Automated |
| RF Profile configuration | ~5-10 min | Automated |
| Configuration verification | Manual review | Automatic diff check |
| Change history management | Manual logging | Automatic log recording |
| Recovery from misconfiguration | Manual reconfiguration | One-click rollback |

---

### 3 Core Values

```
Value ① Time Savings
─────────────────────────────────────────────
Dramatically reduces configuration time.
Eliminates repetitive manual work.

Value ② Error Prevention
─────────────────────────────────────────────
Dropdown input prevents typos.
Diff check automatically verifies accuracy.

Value ③ Operational Visibility
─────────────────────────────────────────────
All changes are automatically logged.
Instantly see who changed what and when.
```

---

## 7. Q&A (5-10 min)

---

### Frequently Asked Questions

| Question | Answer |
|----------|--------|
| Is it secure? | The API key is managed in the Config sheet. Access is restricted to authorized administrators only. |
| Can it support multiple sites? | Yes. By adding Network IDs to a Networks sheet, you can apply settings to multiple sites at once. |
| Can more configuration items be added? | Yes. Any setting supported by the Meraki API can be added. Firewall rules and content filters are examples. |
| Will it affect existing settings? | A backup is taken before any changes, minimizing the impact on existing settings. |
| Is it difficult to set up? | No. All you need is a Google Spreadsheet and a Meraki API key to get started today. |
| Can it be used with other vendors? | The same approach can be applied to any network device that provides an API. |

---

## Demo Day Checklist ✅

### Pre-Demo Preparation

- [ ] Meraki API key obtained
- [ ] Network ID confirmed
- [ ] API key and Network ID entered in Config sheet
- [ ] SSID_Settings values entered
- [ ] VLAN_Settings values entered
- [ ] MS_Settings values entered
- [ ] RF_Settings values entered
- [ ] Backup functionality verified
- [ ] Configuration apply functionality verified
- [ ] Rollback functionality verified

### On the Day

- [ ] Spreadsheet ready for screen sharing
- [ ] Meraki Dashboard open in browser
- [ ] Confirm demo SSIDs are not yet applied
- [ ] Confirm demo VLANs are not yet applied
- [ ] Confirm Backup sheets are empty
- [ ] Confirm Log sheet is empty
