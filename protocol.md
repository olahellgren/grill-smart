# GrillSmart A550 BLE Protocol

Reverse-engineered from the decompiled GrillSmart Android APK (`com.cwb.bleframework`).

---

## UUIDs

| Role | UUID |
|------|------|
| Service | `00006301-0000-0041-4c50-574953450000` |
| Notify (device → app) | `00006302-0000-0041-4c50-574953450000` |
| Write (app → device) | `00006303-0000-0041-4c50-574953450000` |
| CCCD descriptor | `00002902-0000-1000-8000-00805f9b34fb` |

Device advertises as `GS_XXXX` (where XXXX are the last 4 hex digits of the MAC address).

---

## Packet Structure

Every packet follows this layout:

```
[0]  header byte  (identifies packet type)
[1]  length byte  (total packet length including header and checksum)
[2…n-2]  payload bytes
[n-1]  checksum = XOR of all preceding bytes
```

**Checksum** = bitwise XOR of all bytes before the checksum byte.

---

## Handshake (must complete before reading temperature)

Enable CCCD notifications on `0x6302` first (write `01 00` to the descriptor), then follow this sequence:

### Step 1 — Security Key Verification

**App writes to 0x6303:**
```
A0 04 0F AB
```
`AB` = `0xA0 ^ 0x04 ^ 0x0F` (checksum).

---

### Step 2 — Device State Reply

**Device sends on 0x6302:**
```
80 06 <state> <deviceNonce> <appNonce> <checksum>
```

| Byte | Field | Notes |
|------|-------|-------|
| [0] | `0x80` | header |
| [1] | `0x06` | length |
| [2] | state | `0` = has registered token, `!= 0` = unregistered (will issue new token) |
| [3] | deviceNonce | random byte, echo in all subsequent packets |
| [4] | appNonce | ignored by us |
| [5] | checksum | |

Save **deviceNonce** (byte [3]). Use it in every packet you send from here on.

---

### Step 3a — Request Device Token *(only when state != 0, i.e. fresh/unregistered device)*

**App writes to 0x6303:**
```
A1 04 <deviceNonce> <checksum>
```

**Device replies on 0x6302:**
```
81 0A <token[0]> <token[1]> <token[2]> <token[3]> <token[4]> <token[5]> <deviceNonce> <x> <checksum>
```

Save the **6-byte token** (bytes [2..7]). Persist it for future connections.

---

### Step 3b — Verify Stored Token *(when state == 0 and we have a saved token)*

Skip if coming from step 3a — proceed directly to step 4.

---

### Step 4 — Token Verification

**App writes to 0x6303:**
```
AC 0A <token[4]> <token[3]> <token[0]> <token[5]> <token[1]> <token[2]> <deviceNonce> <checksum>
```

Note the shuffled byte order: indices 4, 3, 0, 5, 1, 2.

**Device replies on 0x6302:**
```
8C 05 <ack> <deviceNonce> <checksum>
```

---

### Step 5 — Clock Sync

**App writes to 0x6303:**
```
AA 08 <ts0> <ts1> <ts2> <ts3> <deviceNonce> <checksum>
```

`ts0..ts3` = current Unix timestamp in **little-endian** (LSB first).

Example for timestamp `0x680688B0` (decimal 1745124528):
```
ts0 = 0xB0, ts1 = 0x88, ts2 = 0x06, ts3 = 0x68
```

**Device replies on 0x6302:**
```
8A 05 <ack> <deviceNonce> <checksum>
```

**Handshake complete.** The device is now ready to return temperature data.

---

## Reading Temperature

Send a polling request; the device replies with the current cooking status.

### Request Updated Cooking Status

**App writes to 0x6303:**
```
A4 05 <probeId> <deviceNonce> <checksum>
```

| Field | Value |
|-------|-------|
| probeId | `0x00` = probe 1, `0x01` = probe 2 |

**Device replies on 0x6302:**
```
84 0C <byte2> <byte3> <byte4> <byte5> <byte6> <byte7> <byte8> <byte9> <byte10> <deviceNonce> <checksum>
```

### Decoding the 0x84 response

| Field | Bytes | Formula |
|-------|-------|---------|
| LCD on/off | [2] bit 7 | `(data[2] >> 7) & 1` |
| Battery % | [2] bits 6-0 | `data[2] & 0x7F` |
| Probe ID | [3] bits 7-4 | `(data[3] >> 4) & 0x0F` |
| Cooking status | [3] bits 3-0 | `data[3] & 0x0F` |
| Elapsed time | [4..8] | see below |
| Remaining time | [6..8] | `((data[8] & 0xE0) << 11) \| ((data[7] & 0xFF) << 8) \| (data[6] & 0xFF)` |
| **Temperature** | **[8..9]** | **see below** |

### Temperature formula

```
raw = ((data[9] & 0xFF) << 2) | (data[8] & 0x03)
temperature_celsius = raw - 100
```

Temperature is a 10-bit value offset by 100°C. Examples:
- `raw = 100` → 0°C
- `raw = 200` → 100°C (boiling water)
- `raw = 257` → 157°C

**Always returns °C regardless of any display setting on the device.** Do F↔C conversion in the app.

---

## Set Cooking Settings — `0xA6`

Send this after every successful handshake to push the user's C/F preference and target temperature to the device. The probe's **physical display** uses these values to show the correct unit and to calculate and display time-remaining.

**App writes to 0x6303** (10 bytes):
```
A6 0A <byte2> <byte3> <byte4> <byte5> <byte6> <byte7> <nonce> <checksum>
```

### Bit layout

| Byte | Bits | Field |
|------|------|-------|
| [2] | 7 | mode (0 = normal) |
| [2] | 6–4 | doneness (0–5, see below) |
| [2] | 3–0 | preAlertTempRaw bits [3:0] |
| [3] | 7–1 | foodSelection (0–7, see below) |
| [3] | 0 | **tempUnit** (0 = °C, 1 = °F) |
| [4] | 7–0 | targetTempRaw bits [7:0] |
| [5] | 7 | targetTemp negative flag (always 0 for cooking temps) |
| [5] | 6–5 | targetTempRaw bits [9:8] |
| [5] | 4–0 | preAlertTempRaw bits [8:4] |
| [6] | 7 | preAlertTempRaw bit [9] |
| [6] | 6–0 | preAlertTimeMin bits [6:0] |
| [7] | 7–4 | preAlertTimeMin bits [10:7] |
| [7] | 3–0 | probeId |
| [8] | — | deviceNonce |
| [9] | — | XOR checksum |

Where `targetTempRaw = targetTemp_celsius + 100` (same offset as temperature readings).

### Food selection values

| Value | Food |
|-------|------|
| 0 | Default / none |
| 1 | Beef |
| 2 | Veal |
| 3 | Lamb |
| 4 | Pork |
| 5 | Chicken |
| 6 | Turkey |
| 7 | Fish |

### Doneness values

| Value | Doneness |
|-------|----------|
| 0 | Default |
| 1 | Rare |
| 2 | Medium-rare |
| 3 | Medium |
| 4 | Medium-well |
| 5 | Well-done |

### TypeScript builder

```typescript
function buildSetCookingSettings(
  nonce: number,
  probeId: number,       // 0 or 1
  targetTempC: number,   // e.g. 63 for medium beef
  tempUnit: 'C' | 'F',  // user preference
  foodSelection = 0,     // 0–7, see table above
  doneness = 0,          // 0–5, see table above
  preAlertTempC?: number,     // default = targetTempC
  preAlertTimeMin = 0,
  mode = 0,
): Uint8Array {
  const tRaw = targetTempC + 100;
  const eRaw = (preAlertTempC ?? targetTempC) + 100;
  const iF   = preAlertTimeMin;
  const unit = tempUnit === 'F' ? 1 : 0;

  const pkt = new Uint8Array(10);
  pkt[0] = 0xA6;
  pkt[1] = 10;
  pkt[2] = ((mode & 1) << 7) | ((doneness & 7) << 4) | (eRaw & 0x0F);
  pkt[3] = ((foodSelection & 0x7F) << 1) | unit;
  pkt[4] = tRaw & 0xFF;
  pkt[5] = ((tRaw & 0x300) >> 3) | ((eRaw & 0x1F0) >> 4);
  pkt[6] = ((eRaw & 0x200) >> 2) | (iF & 0x7F);
  pkt[7] = ((iF & 0x780) >> 3) | (probeId & 0x0F);
  pkt[8] = nonce;
  pkt[9] = pkt.slice(0, 9).reduce((a, b) => a ^ b, 0);
  return pkt;
}
```

### Example — 70 °C target, Celsius display, probe 1

```
targetTempRaw = 70 + 100 = 170 = 0xAA
pkt[2] = 0 | 0 | (170 & 0x0F)    = 0x0A
pkt[3] = 0 | 0                    = 0x00   (Celsius)
pkt[4] = 0xAA
pkt[5] = 0 | (170 & 0x1F0)>>4    = 0x0A
pkt[6] = 0 | 0                    = 0x00
pkt[7] = 0 | 0                    = 0x00
→  A6 0A 0A 00 AA 0A 00 00 <nonce> <cs>
```

### When to send

Send once per probe immediately after the handshake completes (step 5 reply received). Send for probe 0 then probe 1.
If the user changes their C/F preference or selects a new target, resend while connected.

---

## Requesting Cooking Settings (optional read)

To read the target temperature currently stored on the device:

**App writes to 0x6303:**
```
A2 05 <probeId> <deviceNonce> <checksum>
```

**Device replies on 0x6302** with header `0x82`, length `0x0B`. Payload includes target temp, food type, doneness, temperature unit, and pre-alert settings (bit-packed).

We can use this on connect to detect the previous unit preference before overwriting it.

---

## Polling Strategy

After handshake, poll every 1–2 seconds:
1. Write `A4 05 00 <nonce> <cs>` → parse probe 1 temperature
2. Write `A4 05 01 <nonce> <cs>` → parse probe 2 temperature

The `deviceNonce` is static for the duration of a connection (received once in the Step 2 reply, echoed forever).

---

## Token Persistence

The 6-byte token issued in step 3a is device-specific. Save it keyed by MAC address (e.g. in `localStorage`). On future connections:
- If device sends `state == 0` → verify using saved token (skip step 3a, go straight to step 4)
- If `state != 0` → request a new token (step 3a)

---

## Error Packets

Header `0xFF`, length `0x07`:
```
FF 07 <errorCode> <subError> <replyCommand> <probeId_nibble> <checksum>
```

Ignore or log; reconnect if frequent.

---

## Quick Reference — All Command Bytes

| Header | Direction | Name |
|--------|-----------|------|
| `0xA0` | app→device | Security Key Verification (wake-up) |
| `0xA1` | app→device | Request Device Token |
| `0xA2` | app→device | Request Current Cooking Settings |
| `0xA4` | app→device | Request Updated Cooking Status (temperature poll) |
| `0xA6` | app→device | Set Cooking Settings (temp unit, target temp, food/doneness) |
| `0xAA` | app→device | Clock Sync |
| `0xAC` | app→device | Verify Stored Token |
| `0x80` | device→app | Reply Device State |
| `0x81` | device→app | Reply App Registration (token) |
| `0x82` | device→app | Reply Current Cooking Settings |
| `0x84` | device→app | Reply Updated Cooking Status (temperature data) |
| `0x8A` | device→app | Reply Clock Sync |
| `0x8C` | device→app | Reply Token Verification |
| `0xFF` | device→app | Error |
