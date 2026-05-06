# Probe-gated target temperature

**Date:** 2026-05-06

## Problem

The `PresetPicker` component currently allows the user to set a target temperature for either probe regardless of whether that probe is physically inserted. This means a user can configure a target for a probe that will never receive it, leading to silent no-ops and confusing UX.

## Requirements

- If no probe is connected, no target temperature can be set.
- If only Probe 1 is connected, only Probe 1's target can be set.
- If only Probe 2 is connected, only Probe 2's target can be set.
- If both probes are connected, both can be set independently (existing behaviour).

## Probe connection signal

`device.probe1` and `device.probe2` in `useGrillDevice` are `StatusPacket | null`. A `null` value means the probe is not inserted (or the BLE device is not connected). Connection booleans are derived as `!!device.probe1` and `!!device.probe2`.

## Design

### 1. New props on `PresetPicker`

```ts
probe1Connected: boolean
probe2Connected: boolean
```

Passed from `App.tsx` as `!!device.probe1` and `!!device.probe2`.

### 2. Probe tab buttons

Each tab is `disabled` when its probe is not connected.

- Visual: reduced opacity (`0.4`), `cursor: not-allowed`.
- Label: `"Probe 1 (not connected)"` / `"Probe 2 (not connected)"` when disconnected.
- Clicking a disabled tab does nothing (native `disabled` attribute handles this).

### 3. Input area

When `activeProbe` is not connected, the meat-type selector, doneness presets, and custom temp input are replaced with:

> *Probe N is not connected — insert it to set a target temperature.*

The unit toggle remains visible (it applies globally, not per-probe).

### 4. Auto-switch in `App.tsx`

A `useEffect` watches `device.probe1` and `device.probe2`. Rules:

- If `activeProbe === 0` and `!device.probe1` and `!!device.probe2` → switch to `1`.
- If `activeProbe === 1` and `!device.probe2` and `!!device.probe1` → switch to `0`.
- If neither probe is connected, leave `activeProbe` unchanged (the "not connected" message renders for whatever probe was last selected).

## Files changed

| File | Change |
|------|--------|
| `src/components/PresetPicker.tsx` | Add `probe1Connected`/`probe2Connected` props; disable tabs; replace input area with message when active probe not connected |
| `src/App.tsx` | Pass `!!device.probe1`/`!!device.probe2` to `PresetPicker`; add auto-switch `useEffect` |

## Out of scope

- Range validation on the temperature value itself.
- Clearing an existing target when a probe disconnects mid-cook.
