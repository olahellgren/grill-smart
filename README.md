# GrillSmart Thermometer

Unofficial Web Bluetooth companion app for the **Claes Ohlson Bluetooth Meat Thermometer** (art. 44-1794, model A550). The original GrillSmart app was discontinued — this app reverse-engineers the BLE protocol to bring it back, running entirely in the browser with no backend.

**Live:** https://grill-smart.hellgren.io

---

## Features

- Connect to the thermometer over Web Bluetooth (Chrome on Windows / Android)
- Dual-probe support — set an independent target temperature per probe
- Meat/doneness presets (Beef, Pork, Chicken, Lamb, Bread) + custom target
- Live temperature history graphs per probe
- Newton's Law ETA — estimates time remaining based on observed heating curve
- °C / °F toggle (global, synced to device display)
- Audio + visual alert when target temperature is reached
- Web Notification (system notification) on target reached
- Screen Wake Lock — keeps display on while connected
- Token persistence — skips re-pairing on reconnect (localStorage)
- PWA manifest — installable on Android home screen
- Deployed as a Cloudflare Worker with auto-deploy from GitHub

---

## Browser Support

| Browser | Works |
|---------|-------|
| Chrome on Windows | ✅ |
| Chrome on Android | ✅ |
| Firefox | ❌ (no Web Bluetooth) |
| Safari / iOS | ❌ (Apple blocks Web Bluetooth) |

The site is served over HTTPS so Web Bluetooth works without any flags.

---

## Development

```bash
npm install
npm run dev        # start dev server at http://localhost:5173
npm run build      # production build → dist/
npm run deploy     # build + deploy to Cloudflare (requires CLOUDFLARE_API_TOKEN)
npm run format     # format all source files with Prettier
npm run lint       # run ESLint
```

### Deploy manually

```bash
CLOUDFLARE_API_TOKEN=your_token npm run deploy
```

### Auto-deploy

Every push to `main` triggers a GitHub Actions workflow that builds and deploys to Cloudflare. Add your token as a repository secret named `CLOUDFLARE_API_TOKEN`.

---

## Stack

- **Vite** + **React 18** + **TypeScript**
- **Web Bluetooth API** — direct BLE communication, no native app needed
- **Recharts** — temperature history graphs
- **Cloudflare Workers** — static asset hosting with custom domain
- No backend, no database, no login

---

## BLE Protocol

Reverse-engineered from the decompiled GrillSmart Android APK (`com.cwb.bleframework`).

### UUIDs

| Role | UUID |
|------|------|
| Service | `00006301-0000-0041-4c50-574953450000` |
| Notify (device → app) | `00006302-0000-0041-4c50-574953450000` |
| Write (app → device) | `00006303-0000-0041-4c50-574953450000` |

The device advertises as `GS_XXXX` (last 4 hex digits of MAC address).

---

### Packet Structure

Every packet:
```
[0]      header byte   — identifies packet type
[1]      length byte   — total packet length
[2…n-2]  payload bytes
[n-1]    checksum      — XOR of all preceding bytes
```

---

### Handshake (5 steps, must complete before reading temperature)

Enable CCCD notifications on `0x6302` first, then:

#### Step 1 — Security Key

App → device:
```
A0 04 0F AB
```
(`AB` = XOR checksum of first 3 bytes)

#### Step 2 — Device State Reply

Device → app:
```
80 06 <state> <deviceNonce> <appNonce> <checksum>
```

- `state = 0` → device has a registered token → skip to step 3b
- `state != 0` → fresh/unregistered → do step 3a

Save **deviceNonce** (byte [3]) — echo it in every subsequent packet.

#### Step 3a — Request Token *(only if state != 0)*

App → device:
```
A1 04 <deviceNonce> <checksum>
```

Device → app:
```
81 0A <token[0..5]> <deviceNonce> <x> <checksum>
```

Save the **6-byte token** (bytes [2..7]). Persist keyed by device ID for future connections.

#### Step 3b — Verify Stored Token *(if state == 0)*

App → device:
```
AC 0A <token[4]> <token[3]> <token[0]> <token[5]> <token[1]> <token[2]> <deviceNonce> <checksum>
```

Note the shuffled byte order: indices **4, 3, 0, 5, 1, 2**.

Device → app:
```
8C 05 <ack> <deviceNonce> <checksum>
```

#### Step 4 — Clock Sync

App → device:
```
AA 08 <ts0> <ts1> <ts2> <ts3> <deviceNonce> <checksum>
```

`ts0..ts3` = current Unix timestamp, **little-endian**.

Device → app:
```
8A 05 <ack> <deviceNonce> <checksum>
```

Handshake complete.

#### Step 5 — Push Unit Preference

Immediately after the handshake, send `0xA6` (Set Cooking Settings) for both probes to sync the C/F unit to the device display. See below.

---

### Temperature Polling

After handshake, poll every ~2 seconds:

App → device:
```
A4 05 <probeId> <deviceNonce> <checksum>
```
`probeId`: `0x00` = probe 1, `0x01` = probe 2

Device → app (`0x84` reply):
```
84 0C <b2> <b3> <b4> <b5> <b6> <b7> <b8> <b9> <b10> <nonce> <checksum>
```

#### Decoding temperature

```
raw = ((data[9] & 0xFF) << 2) | (data[8] & 0x03)
tempF = raw - 100
tempC = (tempF - 32) * 5 / 9
```

The raw value encodes **°F** with a 100-offset. Convert to °C in the app.

Other fields in the `0x84` reply:

| Field | Formula |
|-------|---------|
| Battery % | `data[2] & 0x7F` |
| Probe ID | `(data[3] >> 4) & 0x0F` |
| Remaining secs | `((data[8] & 0xE0) << 11) \| (data[7] << 8) \| data[6]` |

---

### Set Cooking Settings — `0xA6`

Pushes target temperature, unit preference, food type and doneness to the device. The probe's physical display uses these values.

App → device (10 bytes):
```
A6 0A <b2> <b3> <b4> <b5> <b6> <b7> <nonce> <checksum>
```

Bit layout:

| Byte | Bits | Field |
|------|------|-------|
| [2] | 6–4 | doneness (0–5) |
| [2] | 3–0 | preAlertTempRaw[3:0] |
| [3] | 7–1 | foodSelection (0–7) |
| [3] | 0 | **unit** (0 = °C, 1 = °F) |
| [4] | 7–0 | targetTempRaw[7:0] |
| [5] | 6–5 | targetTempRaw[9:8] |
| [5] | 4–0 | preAlertTempRaw[8:4] |
| [6] | 7 | preAlertTempRaw[9] |
| [7] | 3–0 | probeId |
| [8] | — | deviceNonce |
| [9] | — | XOR checksum |

`targetTempRaw = targetTempC + 100`

---

### Command Reference

| Header | Direction | Command |
|--------|-----------|---------|
| `0xA0` | app → device | Security Key (wake-up) |
| `0xA1` | app → device | Request Token |
| `0xA4` | app → device | Poll Temperature |
| `0xA6` | app → device | Set Cooking Settings |
| `0xAA` | app → device | Clock Sync |
| `0xAC` | app → device | Verify Token |
| `0x80` | device → app | Device State |
| `0x81` | device → app | Token Reply |
| `0x84` | device → app | Temperature Data |
| `0x8A` | device → app | Clock Sync Ack |
| `0x8C` | device → app | Token Verify Ack |
| `0xFF` | device → app | Error |

---

## Project Structure

```
src/
  ble/
    constants.ts        # UUIDs and header bytes
    packets.ts          # all packet builders and decoders
    useGrillDevice.ts   # React hook — BLE connection, handshake, polling
  components/
    ConnectButton.tsx
    ProbeDisplay.tsx    # big temperature card with progress bar
    TempGraph.tsx       # Recharts history graph
    PresetPicker.tsx    # meat/doneness presets + custom temp input
    EtaDisplay.tsx
    TempAlert.tsx       # modal + beeps + system notification
    InfoButton.tsx      # about modal
  hooks/
    useEta.ts           # Newton's Law ETA via linear regression
  storage/
    tokenStore.ts       # localStorage token persistence
  types.ts
  presets.ts
```

---

## License

MIT
