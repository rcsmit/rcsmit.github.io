# XOX Editor

A browser-based 606-style step sequencer with per-voice tone shaping. Pure synthesis (no samples), persistent channel strips with filter + drive, 59 drum patterns in 8 categories, and 8 kit voicings.

**Current version:** 20260828-184930  
**Status:** MVP + tone module (alpha)

---

## What It Does

- **16-step drum grid** with 7 synthesized voices (BD, SD, LT, HT, CH, OH, CY) + global accent row
- **Per-voice tone module:** tuning, decay scaling, filter type/cutoff/resonance, tanh drive with makeup gain, channel level
- **8 kit presets** (606 dry, 909 wide, 808 boom, lo-fi tape, dub chamber, acid squelch, deep sub, bright pop) as overlays on defaults
- **59 drum patterns** across 8 categories (house, hip-hop, rock, latin, jazz, reggae, afro, electro)
- **Pattern length 1–16 steps** with variable-length support (3/4 jazz waltz, 6/8 afro)
- **JSON export/import** (format v2: includes kit settings)
- **Web Audio API synthesis** with lookahead scheduler for sample-accurate timing
- **Swing/shuffle** per pattern (0–70%)
- **Master volume + limiter**

---

## Getting Started

### Use It
1. Open `index.html` in a modern browser (Chrome, Edge, Firefox, Safari 18+)
2. Click **Play**, click/drag the grid to set steps, adjust controls
3. Select a **preset** or **kit** to change character
4. Edit **channel** tone per voice: tabs at the top of the tone panel
5. **Export** as JSON to save, **Import** to restore

### Sync (Current Limitation)
**The sequencer runs on an internal clock. It does NOT sync to:**
- Ableton Link
- MIDI clock (input or output)
- Other DAWs or hardware
- Another browser instance

This is a known gap — see [Sync & Timing](#sync--timing) below.

---

## Architecture

### Signal Flow (Per Voice)

```
[oscillators / noise] 
    → [channel input]
        → [filter: LP/HP/BP with cutoff + resonance]
            → [drive: tanh waveshaper + makeup gain]
                → [channel level] 
                    → [master] → [limiter] → [audio output]
```

Each voice gets a persistent channel strip (`channels[voiceId]`), built once at `initAudio()`. Per hit, only the sound generator (oscillator/noise) is created and routed into that strip's input.

### Per-Voice State

```js
state.kit[voiceId] = {
  level:  1.0,           // 0..2 output gain
  tune:   1.0,           // 0.5..2 scales every frequency
  decay:  1.0,           // 0.25..3 scales every envelope duration
  ftype:  "lowpass",     // "off" | "lowpass" | "highpass" | "bandpass"
  cutoff: 6000,          // 30..18000 Hz (log scale on UI slider)
  reso:   0.7,           // 0.1..18 filter Q
  drive:  0.15           // 0 (off) to 1 (max tanh saturation)
}
```

Applied to audio nodes via `applyChannel(voiceId)` whenever a parameter changes.

### Scheduler

- **Lookahead:** 25 ms wake interval, schedules 120 ms ahead
- **Swing offset:** per 16th note, skewed by (swing% / 100) × step-duration × 0.66
- **Accent:** stored per step in `state.pattern[ACCENT_ROW]`; multiplies note gain by `ACCENT_GAIN` (1.0) vs. `NORMAL_GAIN` (0.62)

The scheduler is **NOT synced to anything external**. It runs on `ctx.currentTime` and assumes it owns the timeline.

### Pattern Storage

```js
state.pattern = {
  BD:  [1,0,0,0, 1,0,0,0, ...],  // 16-element array, values 0 or 1
  SD:  [...],
  ACC: [...],  // global accent row
  // ... one per voice
}

state.kit = {
  BD: { level, tune, decay, ftype, cutoff, reso, drive },
  SD: { ... },
  // ... one per voice
}
```

### Export Format (v2)

```json
{
  "format": "xox-pattern",
  "version": 2,
  "tempo": 124,
  "swing": 12,
  "length": 16,
  "rows": ["BD", "SD", "LT", "HT", "CH", "OH", "CY", "ACC"],
  "pattern": { "BD": [1,0,0,0,...], ... },
  "kit": { "BD": { "level": 1, ... }, ... }
}
```

v1 files (no `kit` block) load and fall back to `CHANNEL_DEFAULTS`.

---

## Tone Module Details

### Filter (Biquad)

- **Type:** off (bypass), lowpass, highpass, bandpass
- **Cutoff:** 30–18000 Hz, logged on UI (feels more musical)
- **Resonance (Q):** 0.1–18 (higher = more peak)

Cutoff and reso are disabled when `ftype === "off"`.

### Drive (Tanh Waveshaper)

- Maps input through `tanh(k × x) / tanh(k)` where `k = 1 + drive×14` (drive 0→1 = k 1→15)
- Higher drive = softer clipping (not hard clipping)
- **Makeup gain** automatically applied: `1 / (1 + drive×0.9)` so you don't lose perceived level when driving

### Per-Voice Tuning

- **Tune:** scales every oscillator frequency in that voice (0.5×, 1.0×, 2.0×)
- **Decay:** scales every envelope length in that voice (0.25×, 1.0×, 3.0×)

Useful for: layering a voice lower or higher, tightening closed-hat decay, stretching tom-roll sustain, etc.

### Channel Level

Final output gain for that voice (0–2). Applied **after** drive makeup, so it's the true voice fader.

---

## UI: Channel Strip

Tabs at the top of the tone panel show all 7 voices. Click a tab to edit that voice. A filled circle (`•`) appears if that channel differs from the `CHANNEL_DEFAULTS`.

Controls:
- **6 sliders:** Level, Tune, Decay, Cutoff (log), Reso, Drive
- **4 filter buttons:** Off / LP / HP / BP
- **Hit:** Audition the voice with an accent hit (without playing the pattern)
- **Reset:** Restore that voice to defaults
- **Kit dropdown:** Apply a whole-kit voicing overlay

Kits are stored in `KITS` object; each is a partial override (e.g., "909 wide" only tweaks voices that differ from the 606 baseline).

---

## Sync & Timing

### Current State
The scheduler runs on `AudioContext.currentTime` alone. There is **no sync** to:
- Ableton Link (requires a native C++ bridge; Link library cannot run in JS)
- MIDI clock (not implemented)
- External tempo changes
- Other apps or devices

This makes the sequencer **standalone only**. It's the master, nothing else is.

### Why This Matters for Vampbox Integration
When you integrate drums into Vampbox, you have three choices:

1. **Drums follow Vampbox's clock**
   - Vampbox defines `currentStep` and `nextStepTime`
   - Drums read the same `currentStep` and schedule into the same timeline
   - Single source of truth for tempo, swing, start/stop
   - **Recommended approach**

2. **Drums are separate, hope they drift in sync**
   - Both have their own scheduler
   - Over time they **will** drift (even by 5–10 ms)
   - Unlistenable in a duet

3. **Drums as a slave** (future)
   - If Vampbox emits MIDI clock, drums listen and adjust `nextStepTime`
   - Requires a MIDI clock module (not written yet)
   - More complex, but decouples the apps

### If You Add Sync Later

**MIDI clock in/out** is the practical first step:
- Use Web MIDI API (Chrome, Edge, Firefox, Safari 18+; **not iOS**)
- Emit 24 pulses per quarter note from your scheduler
- Accept incoming clock and re-sync `nextStepTime` to the nearest pulse
- Send start/stop/continue as transport messages

**Ableton Link** requires:
- A companion Node.js server running the `abletonlink` library
- WebSocket bridge to browsers
- Distribution (users install a small app)
- Overkill for a browser sequencer unless you're selling it

---

## Presets & Kit Voicings

### 59 Presets
Organised by category (House & Dance, Hip Hop, Rock, Latin, Jazz, Reggae, Afro, Electro, Fills):
- Each stores **tempo**, **swing**, **pattern length**, and **note grid**
- Compact string notation: `"x..x ..x. .x.."` (x=hit, .=rest, spaces for grouping)
- Parser: `pat(str)` converts string → [1,0,0,1,...] array

### 8 Kit Voicings
- **606 dry:** defaults, minimal tweaking
- **909 wide:** longer decay, lower tune on kick, more resonance, some drive
- **808 boom:** very long kick decay, deep resonance, low cutoff
- **Lo-fi tape:** all voices drive ~0.3–0.55 (grungy saturation)
- **Dub echo chamber:** heavy bandpass resonance, long decays, dark
- **Acid squelch:** extreme Q on filters (5–9), short decay
- **Deep sub:** kick freq 0.55×, very low cutoff + resonance
- **Bright pop:** tune up slightly, cutoff high, minimal drive

Each kit is a **partial override**. E.g., "909 wide" only specifies tune/decay/reso for certain voices; others fall back to defaults. This lets you create new kits by tweaking a few parameters instead of respecifying all 7.

---

## Known Limitations

### Audio Latency
- Web Audio schedules at browser refresh rate (~60 Hz on most screens)
- Lookahead mitigates but doesn't eliminate: expect ±10–30 ms latency
- Not suitable for **performance** (live playing), only **composition** and **practice**

### No iOS Web MIDI
- Safari on iOS blocks Web MIDI API (fingerprinting/privacy)
- All iOS browsers inherit WebKit's limitation
- If you need iOS, you're limited to internal clock or a native app

### No Real-Time Constraints
- `setTimeout` / `setInterval` for the scheduler are not real-time on the OS level
- Heavy UI work (grid repaint, etc.) can cause jitter
- Lookahead scheduler partially works around this

### Single Pattern
- One pattern at a time; no pattern chaining or scenes
- No per-voice mute automation
- No step probability or ratcheting

---

## Development & Contributing

### File Structure
- `index.html` — single-file app (HTML + CSS + JS embedded)
- All CSS variables defined in `:root` for theming
- Version history in a JS const and HTML comment (both required per style guide)

### Adding a Preset
1. Add an entry to the `PRESETS` array (line ~300)
2. Use string notation: `BD: "x..x ..x. ..."`
3. Set `tempo`, `swing`, `len`, and a `cat` (category)
4. The `pat()` parser will convert strings to arrays at load time

Example:
```js
{ cat:"House", name:"Peak time", tempo:130, swing:0, len:16, p:{
  BD: "x... x... x... x...",
  SD: ".... x... .... x...",
  CH: ".x.x .x.x .x.x .x.x",
  ACC:"x... x... x... x..." }},
```

### Adding a Kit
1. Add to `KITS` object (line ~320)
2. Specify only the voices that differ from defaults
3. Include only the parameters that change

Example:
```js
"My sound": {
  BD: { tune: 0.8, decay: 1.5, ftype: "lowpass", cutoff: 4000 },
  SD: { drive: 0.2 }
  // omit CH, OH, CY, LT, HT if unchanged
}
```

### Synth Voice Adding
To add a new drum sound:
1. Add to `VOICES` array (line ~228)
2. Implement a generator in `synth` object (line ~650+)
3. Accept `(time, gain, params, dest)` signature
4. Add default channel params to `CHANNEL_DEFAULTS`
5. Add a tab label (auto-generated from `VOICES`)

The params passed to your synth are:
- `params.tune` — multiply all frequencies
- `params.decay` — multiply all envelope lengths
- Scales let you reshape the sound without editing the base algorithm

### Testing
- Open the HTML file locally or on a server (Web Audio requires HTTPS in production)
- Open the browser console to see any errors
- Test in Chrome (best), then Edge, Firefox, Safari (if time)
- iOS: use the "Web MIDI Browser" app if you need MIDI input testing

---

## TODO / Future Work

### High Priority (Breaks Integrability)
- [ ] Extract scheduler into standalone module (not tied to UI state)
- [ ] Add MIDI clock out (emit 24 PPQ to `navigator.requestMIDIAccess()`)
- [ ] Add MIDI clock in (listen, re-sync `nextStepTime`)
- [ ] Vampbox integration layer (share transport, kit, pattern)

### Medium Priority (Quality)
- [ ] Undo/redo (maintain a pattern history stack)
- [ ] Keyboard shortcuts (number keys = drum select, arrow keys = step nav)
- [ ] Step probability / ratcheting per step
- [ ] Clone / duplicate patterns
- [ ] Dark mode toggle
- [ ] Accessibility (ARIA labels, keyboard-only nav, screen reader support)

### Nice-to-Have
- [ ] Pattern chaining / scene mode (8 patterns, one playing at a time)
- [ ] Per-voice mute automation (mute curve over time)
- [ ] Microtuning support (not 12-TET)
- [ ] Polyrhythm (different lengths per voice)
- [ ] Visual peak meter per voice
- [ ] Tap tempo from mouse/keyboard
- [ ] Audio file import (turn 1-shot samples into custom kits)
- [ ] Search / filter presets by name or category
- [ ] Collaborative editing (WebSocket, multiple users)
- [ ] Cloud backup / restore
- [ ] Unit tests (Vitest, jsdom)
- [ ] Ableton Link bridge (Node.js companion app)

### Known Issues
- Cutoff slider is logarithmic but visual sweep is linear (acceptable trade-off)
- On very slow devices, lookahead may still cause clicks (increase `SCHEDULE_AHEAD`)
- Filter resonance > 8 can self-oscillate; not prevented, but documented

### Not in Scope (Deliberate)
- Sample playback (use a 909 sample kit elsewhere; this is synthesis-only)
- Audio file export (route the output to a recording tool)
- DAW plugin (VST/AU; would need a separate architecture)
- iOS native support (Web MIDI blocked; use Web MIDI Browser app as workaround)

---

## Integrating with Vampbox

### Option 1: Shared Transport (Recommended)
```js
// vampbox-transport.js — shared scheduler
export function createTransport(initialTempo) {
  let tempo = initialTempo, step = 0, nextTime = ctx.currentTime;
  
  function scheduleStep(stepIndex, time) {
    scheduleBass(stepIndex, time);
    scheduleChords(stepIndex, time);
    schedulePad(stepIndex, time);
    scheduleDrums(stepIndex, time);  // xox drums feed here
  }
  
  function advance() {
    nextTime += (60 / tempo / 4);  // 16th-note duration
    step = (step + 1) % 16;
  }
  
  return { scheduleStep, advance, setTempo: t => tempo = t, getStep: () => step };
}
```

Pass `transport` to both Vampbox synths and the xox editor's `scheduleDrums()`.

### Option 2: Drums as Separate Slave
Pass the current `state.tempo` and `state.swing` to drums, but let them run their own scheduler. Fragile but simpler to prototype. Drift will occur over 30–60 seconds.

### Option 3: MIDI Clock Bridge (Future)
When MIDI clock is added, Vampbox emits, drums listen. More decoupled. Requires coordination code but survives tempo changes during playback.

---

## License & Attribution

Single-file sequencer, inspired by the TR-606 and TR-909 hardware drum machines.

No external dependencies — pure Web Audio API, vanilla JS, CSS.

---

## Credits

- Biquad filter frequency/Q calculations: Web Audio API spec
- Tanh waveshaper: standard soft-clipping technique
- Lookahead scheduler: Chris Wilson's Web Audio clock pattern
- Presets: combinations of common dance/hip-hop drum breaks

---

**Questions? Issues?** File a bug report with the browser, OS, and steps to reproduce.
