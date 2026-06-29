# API Endpoints Reference 📡

Base URL: `https://api.meraki.com/api/v1`

---

## MX (Security Appliance)

| # | Purpose | Method | Endpoint |
|---|---------|--------|---------|
| 1 | Enable VLAN feature | PUT | `/networks/{networkId}/appliance/vlans/settings` |
| 2 | Get VLAN list | GET | `/networks/{networkId}/appliance/vlans` |
| 3 | Create new VLAN | POST | `/networks/{networkId}/appliance/vlans` |
| 4 | Update VLAN settings | PUT | `/networks/{networkId}/appliance/vlans/{vlanId}` |

---

## MS (Switch)

| # | Purpose | Method | Endpoint |
|---|---------|--------|---------|
| 5 | Get device list | GET | `/networks/{networkId}/devices` |
| 6 | Update switch port settings | PUT | `/devices/{serial}/switch/ports/{portId}` |
| 7 | Get switch port settings | GET | `/devices/{serial}/switch/ports/{portId}` |

---

## MR (Access Point)

| # | Purpose | Method | Endpoint |
|---|---------|--------|---------|
| 8 | Update SSID settings | PUT | `/networks/{networkId}/wireless/ssids/{number}` |
| 9 | Get SSID settings | GET | `/networks/{networkId}/wireless/ssids/{number}` |
| 10 | Get SSID list | GET | `/networks/{networkId}/wireless/ssids` |
| 11 | Create RF Profile | POST | `/networks/{networkId}/wireless/rfProfiles` |
| 12 | Get RF Profile | GET | `/networks/{networkId}/wireless/rfProfiles/{rfProfileId}` |

---

## Summary

| Method | Count | Purpose |
|--------|-------|---------|
| GET | 5 | Configuration verification and diff check |
| POST | 2 | Create new resources |
| PUT | 5 | Update existing settings |
| **Total** | **12** | |

---

## References

- [Cisco Meraki Dashboard API Documentation](https://developer.cisco.com/meraki/api-v1/)
- [Meraki Developer Hub](https://developer.cisco.com/meraki/)
