# Probe-gated Target Temperature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent the user from setting a target temperature on a probe that is not physically connected.

**Architecture:** Pass probe connection booleans from `App.tsx` down to `PresetPicker`. The picker disables tabs for unconnected probes and replaces the input area with a message when the active probe is disconnected. A `useEffect` in `App.tsx` auto-switches `activeProbe` to a connected probe if the current selection goes offline.

**Tech Stack:** React 19, TypeScript 6, Vite — no test framework installed; verification is `npm run build` (type-checks + bundles) plus manual dev-server smoke test.

---

### Task 1: Add connection props to `PresetPicker` and gate the input area

**Files:**
- Modify: `src/components/PresetPicker.tsx`

- [ ] **Step 1: Add the two new props to the `Props` interface**

In `src/components/PresetPicker.tsx`, replace the existing `Props` interface (lines 5–13):

```tsx
interface Props {
  unit: TempUnit
  activeProbe: 0 | 1
  activeTempC: number | null
  probe1Connected: boolean
  probe2Connected: boolean
  onProbeChange: (probe: 0 | 1) => void
  onSelect: (preset: MeatPreset) => void
  onCustom: (tempC: number) => void
  onUnitChange: (unit: TempUnit) => void
}
```

- [ ] **Step 2: Destructure the new props in the component signature**

Replace the existing destructure (lines 23–31):

```tsx
export default function PresetPicker({
  unit,
  activeProbe,
  activeTempC,
  probe1Connected,
  probe2Connected,
  onProbeChange,
  onSelect,
  onCustom,
  onUnitChange,
}: Props) {
```

- [ ] **Step 3: Derive a helper and update the probe tab buttons**

Add a derived value just before the `return` statement (after the `isActivePreset` function):

```tsx
  const probeConnected = [probe1Connected, probe2Connected]
```

Replace the two probe tab `<button>` elements (lines 67–78) with disabled-aware versions:

```tsx
          <button
            onClick={() => onProbeChange(0)}
            disabled={!probe1Connected}
            style={{
              ...btn(activeProbe === 0),
              fontSize: '0.85rem',
              opacity: probe1Connected ? 1 : 0.4,
              cursor: probe1Connected ? 'pointer' : 'not-allowed',
            }}
          >
            Probe 1{!probe1Connected ? ' (not connected)' : ''}
          </button>
          <button
            onClick={() => onProbeChange(1)}
            disabled={!probe2Connected}
            style={{
              ...btn(activeProbe === 1),
              fontSize: '0.85rem',
              opacity: probe2Connected ? 1 : 0.4,
              cursor: probe2Connected ? 'pointer' : 'not-allowed',
            }}
          >
            Probe 2{!probe2Connected ? ' (not connected)' : ''}
          </button>
```

- [ ] **Step 4: Gate the meat-type selector, presets, and custom input behind a connection check**

Replace everything from the `{/* Meat type selector */}` comment down to (and including) the closing `</div>` of the custom-temp section — i.e. lines 92–161 — with:

```tsx
      {!probeConnected[activeProbe] ? (
        <div
          style={{
            color: 'var(--muted)',
            fontSize: '0.9rem',
            padding: '1rem 0',
            textAlign: 'center',
          }}
        >
          Probe {activeProbe + 1} is not connected — insert it to set a target temperature.
        </div>
      ) : (
        <>
          {/* Meat type selector */}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
            {MEAT_TYPES.map((m) => (
              <button key={m} onClick={() => setMeat(m)} style={btn(meat === m)}>
                {m}
              </button>
            ))}
          </div>

          {/* Doneness presets */}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {presetsForMeat(meat).map((p) => (
              <button
                key={p.label}
                onClick={() => onSelect(p)}
                style={{
                  ...btn(isActivePreset(p)),
                  border: `1px solid ${isActivePreset(p) ? 'var(--accent)' : 'var(--border)'}`,
                  background: isActivePreset(p) ? 'var(--accent)' : 'transparent',
                }}
              >
                {p.label} · {toDisplay(p.targetTempC, unit)}°{unit}
              </button>
            ))}
          </div>

          {/* Custom temp input */}
          <div
            style={{
              marginTop: '0.75rem',
              paddingTop: '0.75rem',
              borderTop: '1px solid var(--border)',
              display: 'flex',
              gap: '0.5rem',
              alignItems: 'center',
            }}
          >
            <span style={{ color: 'var(--muted)', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
              Custom:
            </span>
            <input
              type="number"
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCustomSet()}
              placeholder={`e.g. ${unit === 'C' ? '65' : '149'}`}
              style={{
                flex: 1,
                minWidth: 0,
                background: 'var(--bg)',
                color: 'var(--text)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                padding: '0.35rem 0.6rem',
                fontSize: '1rem',
              }}
            />
            <span style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>°{unit}</span>
            <button
              onClick={handleCustomSet}
              style={{
                ...btn(false),
                background: 'var(--accent)',
                color: '#fff',
                padding: '0.35rem 0.9rem',
              }}
            >
              Set
            </button>
          </div>
        </>
      )}
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npm run build
```

Expected: build succeeds. If it fails, the error will be a missing prop in App.tsx — that is fixed in Task 2.

- [ ] **Step 6: Commit**

```bash
git add src/components/PresetPicker.tsx
git commit -m "feat: gate target-temp input on probe connection state"
```

---

### Task 2: Pass connection props and add auto-switch logic in `App.tsx`

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Pass the new props to `PresetPicker`**

In `src/App.tsx`, find the `<PresetPicker` block (around line 249) and add the two new props:

```tsx
      <PresetPicker
        unit={unit}
        activeProbe={activeProbe}
        activeTempC={targets[activeProbe]}
        probe1Connected={!!device.probe1}
        probe2Connected={!!device.probe2}
        onProbeChange={setActiveProbe}
        onSelect={handlePreset}
        onCustom={handleCustom}
        onUnitChange={setUnit}
      />
```

- [ ] **Step 2: Add auto-switch useEffect**

Add the following `useEffect` after the existing `useEffect` that clears readings on disconnect (the one at around line 119 that watches `device.status`):

```tsx
  // Auto-switch activeProbe to a connected probe when the selected one disconnects
  useEffect(() => {
    if (activeProbe === 0 && !device.probe1 && device.probe2) setActiveProbe(1)
    if (activeProbe === 1 && !device.probe2 && device.probe1) setActiveProbe(0)
  }, [device.probe1, device.probe2, activeProbe])
```

- [ ] **Step 3: Verify TypeScript compiles and builds cleanly**

```bash
npm run build
```

Expected output ends with something like:
```
✓ built in Xs
```
No type errors.

- [ ] **Step 4: Smoke test in dev server**

```bash
npm run dev
```

Open the app. Verify:
1. Without any BLE connection (both probes null): both tabs show "(not connected)", the input area shows the "not connected" message.
2. (If you have the device handy) With one probe inserted: only that probe's tab is enabled; the other tab is greyed out with "(not connected)"; the active probe auto-switches to the connected one if you had the other selected.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx
git commit -m "feat: pass probe connection state to PresetPicker, auto-switch active probe"
```
