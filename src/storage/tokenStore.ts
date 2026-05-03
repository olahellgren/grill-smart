const KEY = (mac: string) => `gs_token_${mac.replace(/:/g, '')}`

export function saveToken(mac: string, token: Uint8Array): void {
  localStorage.setItem(KEY(mac), Array.from(token).join(','))
}

export function loadToken(mac: string): Uint8Array | null {
  const raw = localStorage.getItem(KEY(mac))
  if (!raw) return null
  const nums = raw.split(',').map(Number)
  if (nums.length !== 6) return null
  return new Uint8Array(nums)
}
