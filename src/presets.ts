import type { MeatPreset } from './types'

export const PRESETS: MeatPreset[] = [
  { meat: 'Beef', label: 'Rare', targetTempC: 52 },
  { meat: 'Beef', label: 'Medium-rare', targetTempC: 57 },
  { meat: 'Beef', label: 'Medium', targetTempC: 63 },
  { meat: 'Beef', label: 'Medium-well', targetTempC: 68 },
  { meat: 'Beef', label: 'Well-done', targetTempC: 74 },
  { meat: 'Pork', label: 'Medium', targetTempC: 63 },
  { meat: 'Pork', label: 'Well-done', targetTempC: 71 },
  { meat: 'Chicken', label: 'Done', targetTempC: 74 },
  { meat: 'Lamb', label: 'Rare', targetTempC: 55 },
  { meat: 'Lamb', label: 'Medium-rare', targetTempC: 60 },
  { meat: 'Lamb', label: 'Well-done', targetTempC: 72 },
  { meat: 'Bread', label: 'Standard', targetTempC: 93 },
  { meat: 'Bread', label: 'Sourdough', targetTempC: 96 },
]

export const MEAT_TYPES = [...new Set(PRESETS.map((p) => p.meat))]

export function presetsForMeat(meat: string): MeatPreset[] {
  return PRESETS.filter((p) => p.meat === meat)
}
