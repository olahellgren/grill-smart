import type { MeatPreset } from './types'

// foodCode values come from the device's CookingStatus enum (y.java in the APK):
// 0=Beef, 1=Lamb, 2=Veal, 3=Pork, 4=Hamburg, 5=Chicken, 6=Duck, 7=Turkey, ...
export const PRESETS: MeatPreset[] = [
  { meat: 'Beef', label: 'Rare', targetTempC: 52, foodCode: 0, doneness: 0 },
  { meat: 'Beef', label: 'Medium-rare', targetTempC: 57, foodCode: 0, doneness: 1 },
  { meat: 'Beef', label: 'Medium', targetTempC: 63, foodCode: 0, doneness: 2 },
  { meat: 'Beef', label: 'Medium-well', targetTempC: 68, foodCode: 0, doneness: 3 },
  { meat: 'Beef', label: 'Well-done', targetTempC: 74, foodCode: 0, doneness: 4 },
  { meat: 'Pork', label: 'Medium', targetTempC: 63, foodCode: 3, doneness: 2 },
  { meat: 'Pork', label: 'Well-done', targetTempC: 71, foodCode: 3, doneness: 4 },
  { meat: 'Chicken', label: 'Done', targetTempC: 74, foodCode: 5, doneness: 3 },
  { meat: 'Lamb', label: 'Rare', targetTempC: 55, foodCode: 1, doneness: 0 },
  { meat: 'Lamb', label: 'Medium-rare', targetTempC: 60, foodCode: 1, doneness: 1 },
  { meat: 'Lamb', label: 'Well-done', targetTempC: 72, foodCode: 1, doneness: 4 },
  { meat: 'Bread', label: 'Standard', targetTempC: 93, foodCode: 5, doneness: 3 },
  { meat: 'Bread', label: 'Sourdough', targetTempC: 96, foodCode: 5, doneness: 4 },
]

export const MEAT_TYPES = [...new Set(PRESETS.map((p) => p.meat))]

export function presetsForMeat(meat: string): MeatPreset[] {
  return PRESETS.filter((p) => p.meat === meat)
}
