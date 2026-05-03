function xorChecksum(bytes: Uint8Array, len: number): number {
  let cs = 0
  for (let i = 0; i < len; i++) cs ^= bytes[i]
  return cs
}

export function buildSecurityKey(): Uint8Array {
  const p = new Uint8Array([0xA0, 0x04, 0x0F, 0x00])
  p[3] = xorChecksum(p, 3)
  return p
}

export function buildRequestToken(nonce: number): Uint8Array {
  const p = new Uint8Array([0xA1, 0x04, nonce, 0x00])
  p[3] = xorChecksum(p, 3)
  return p
}

export function buildVerifyToken(token: Uint8Array, nonce: number): Uint8Array {
  const p = new Uint8Array([
    0xAC, 0x0A,
    token[4], token[3], token[0], token[5], token[1], token[2],
    nonce, 0x00,
  ])
  p[9] = xorChecksum(p, 9)
  return p
}

export function buildClockSync(nonce: number): Uint8Array {
  const ts = Math.floor(Date.now() / 1000)
  const p = new Uint8Array([
    0xAA, 0x08,
    ts & 0xFF, (ts >> 8) & 0xFF, (ts >> 16) & 0xFF, (ts >> 24) & 0xFF,
    nonce, 0x00,
  ])
  p[7] = xorChecksum(p, 7)
  return p
}

export function buildPollStatus(probeId: 0 | 1, nonce: number): Uint8Array {
  const p = new Uint8Array([0xA4, 0x05, probeId, nonce, 0x00])
  p[4] = xorChecksum(p, 4)
  return p
}

export function buildSetCookingSettings(
  nonce: number,
  probeId: 0 | 1,
  targetTempC: number,
  tempUnit: 'C' | 'F',
  foodSelection = 0,
  doneness = 0,
): Uint8Array {
  const tRaw = targetTempC + 100
  const eRaw = tRaw
  const unit = tempUnit === 'F' ? 1 : 0
  const p = new Uint8Array(10)
  p[0] = 0xA6
  p[1] = 10
  p[2] = ((doneness & 7) << 4) | (eRaw & 0x0F)
  p[3] = ((foodSelection & 0x7F) << 1) | unit
  p[4] = tRaw & 0xFF
  p[5] = ((tRaw & 0x300) >> 3) | ((eRaw & 0x1F0) >> 4)
  p[6] = ((eRaw & 0x200) >> 2)
  p[7] = probeId & 0x0F
  p[8] = nonce
  p[9] = xorChecksum(p, 9)
  return p
}

export interface StatusPacket {
  probeId: 0 | 1
  tempC: number
  batteryPct: number
  remainingSecs: number
  elapsedSecs: number
}

export function decodeStatusPacket(data: DataView): StatusPacket | null {
  if (data.byteLength < 12) return null
  if (data.getUint8(0) !== 0x84) return null
  const b2 = data.getUint8(2)
  const b3 = data.getUint8(3)
  const b4 = data.getUint8(4)
  const b5 = data.getUint8(5)
  const b6 = data.getUint8(6)
  const b7 = data.getUint8(7)
  const b8 = data.getUint8(8)
  const b9 = data.getUint8(9)
  const raw = ((b9 & 0xFF) << 2) | (b8 & 0x03)
  const tempC = raw - 100
  const batteryPct = b2 & 0x7F
  const probeId = ((b3 & 0xF0) >> 4) as 0 | 1
  const remainingSecs = ((b8 & 0xE0) << 11) | ((b7 & 0xFF) << 8) | (b6 & 0xFF)
  const elapsedSecs = ((b5 & 0xFF) << 8) | ((b8 & 0x1C) << 14) | (b4 & 0xFF)
  return { probeId, tempC, batteryPct, remainingSecs, elapsedSecs }
}

export function decodeDeviceState(data: DataView): { state: number; nonce: number } | null {
  if (data.byteLength < 6) return null
  if (data.getUint8(0) !== 0x80) return null
  return { state: data.getUint8(2), nonce: data.getUint8(3) }
}

export function decodeTokenReply(data: DataView): { token: Uint8Array } | null {
  if (data.byteLength < 10) return null
  if (data.getUint8(0) !== 0x81) return null
  return {
    token: new Uint8Array([
      data.getUint8(2), data.getUint8(3), data.getUint8(4),
      data.getUint8(5), data.getUint8(6), data.getUint8(7),
    ]),
  }
}
