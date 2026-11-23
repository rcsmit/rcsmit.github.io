// version = "20261123-120700"
// Mini-workout interval timer: 5 s get ready, then 5 × (40 s work + 20 s rest).
// Timestamp-based, so background-tab throttling does not make it drift.
// Pause control is always visible (WCAG 2.2.2); screen wake lock keeps the
// phone display on while the timer runs.

const WORK = 40;
const REST = 20;
const PREP = 5;

export function initTimer() {
  const root = document.getElementById("timer");
  const list = document.getElementById("exercise-list");
  if (!root || !list) return;

  const items = [...list.querySelectorAll("li")];
  const exercises = items.map((li) => ({
    name: li.querySelector("b").textContent.trim(),
    cue: li.dataset.cue,
  }));

  // Build the phase sequence once.
  const phases = [{ type: "prep", duration: PREP, ex: 0 }];
  exercises.forEach((_, i) => {
    phases.push({ type: "work", duration: WORK, ex: i });
    if (i < exercises.length - 1) phases.push({ type: "rest", duration: REST, ex: i + 1 });
  });

  const el = {
    dial: root.querySelector(".dial"),
    phase: document.getElementById("timer-phase"),
    time: document.getElementById("timer-time"),
    step: document.getElementById("timer-step"),
    ex: document.getElementById("timer-ex"),
    cue: document.getElementById("timer-cue"),
    toggle: document.getElementById("timer-toggle"),
    skip: document.getElementById("timer-skip"),
    reset: document.getElementById("timer-reset"),
    sound: document.getElementById("timer-sound"),
    live: document.getElementById("timer-announce"),
  };

  const state = { index: 0, remainingMs: phases[0].duration * 1000, running: false, endAt: 0, done: false, tick: 0 };
  let lastShownSecond = -1;
  let wakeLock = null;
  let audioCtx = null;

  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const setButton = (icon, label) => {
    el.toggle.querySelector("use").setAttribute("href", `#i-${icon}`);
    el.toggle.querySelector("span").textContent = label;
  };

  const beep = (freq = 880, length = 0.18) => {
    if (!el.sound.checked) return;
    try {
      audioCtx ??= new AudioContext();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.25, audioCtx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + length);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + length + 0.02);
    } catch { /* audio unavailable: ignore */ }
  };

  const requestWakeLock = async () => {
    if (!("wakeLock" in navigator) || wakeLock) return;
    try {
      wakeLock = await navigator.wakeLock.request("screen");
      wakeLock.addEventListener("release", () => { wakeLock = null; });
    } catch { /* denied or unsupported: fine */ }
  };
  const releaseWakeLock = () => { wakeLock?.release().catch(() => {}); wakeLock = null; };

  const announce = (text) => {
    el.live.textContent = "";
    // Next frame so repeated identical text is still announced.
    requestAnimationFrame(() => { el.live.textContent = text; });
  };

  const renderPhase = (speak) => {
    const p = phases[state.index];
    const ex = exercises[p.ex];
    root.dataset.phase = p.type;
    el.ex.textContent = ex.name;
    el.cue.textContent = ex.cue;

    if (p.type === "prep") {
      el.phase.textContent = state.running ? "Gleich geht’s los" : "Bereit?";
      el.step.textContent = `${exercises.length} Übungen`;
    } else if (p.type === "work") {
      el.phase.textContent = "Training";
      el.step.textContent = `Übung ${p.ex + 1} von ${exercises.length}`;
    } else {
      el.phase.textContent = "Pause";
      el.step.textContent = `Als Nächstes: ${p.ex + 1} von ${exercises.length}`;
    }

    items.forEach((li, i) => {
      const current = p.type !== "prep" && i === p.ex;
      li.classList.toggle("is-current", current);
      li.classList.toggle("is-done", i < p.ex || (p.type === "rest" && i < p.ex));
      if (current) li.setAttribute("aria-current", "step"); else li.removeAttribute("aria-current");
    });

    if (speak) {
      if (p.type === "work") announce(`Übung ${p.ex + 1} von ${exercises.length}: ${ex.name}, ${WORK} Sekunden.`);
      else if (p.type === "rest") announce(`Pause, ${REST} Sekunden. Als Nächstes: ${ex.name}.`);
    }
  };

  const renderTime = () => {
    const p = phases[state.index];
    const secs = Math.max(0, Math.ceil(state.remainingMs / 1000));
    if (secs !== lastShownSecond) {
      el.time.textContent = fmt(secs);
      lastShownSecond = secs;
    }
    const progress = 1 - state.remainingMs / (p.duration * 1000);
    const clamped = Math.min(1, Math.max(0, progress));
    el.dial.style.setProperty("--progress", clamped.toFixed(4));
    el.dial.toggleAttribute("data-empty", clamped < 0.005);
  };

  const finish = () => {
    stop();
    state.done = true;
    root.dataset.phase = "done";
    el.phase.textContent = "Geschafft!";
    el.time.textContent = "🎉";
    el.step.textContent = "Super gemacht";
    el.ex.textContent = "Mini-Workout beendet";
    el.cue.textContent = "Lust auf mehr? Meine Kurse bauen genau darauf auf – Schritt für Schritt.";
    el.dial.style.setProperty("--progress", "1");
    items.forEach((li) => { li.classList.remove("is-current"); li.classList.add("is-done"); li.removeAttribute("aria-current"); });
    setButton("reset", "Nochmal");
    beep(660, 0.5);
    announce("Geschafft! Das Mini-Workout ist beendet.");
  };

  const goTo = (index, speak = true) => {
    if (index >= phases.length) { finish(); return; }
    state.index = index;
    state.remainingMs = phases[index].duration * 1000;
    state.endAt = performance.now() + state.remainingMs;
    lastShownSecond = -1;
    renderPhase(speak);
    renderTime();
  };

  const loop = () => {
    if (!state.running) return;
    state.remainingMs = state.endAt - performance.now();
    // Catch up if the tab was throttled for longer than a phase.
    while (state.running && state.remainingMs <= 0) {
      const overshoot = -state.remainingMs;
      if (state.index + 1 >= phases.length) { finish(); return; }
      beep(phases[state.index + 1].type === "work" ? 988 : 660);
      goTo(state.index + 1);
      state.endAt -= overshoot;
      state.remainingMs = state.endAt - performance.now();
    }
    // Short countdown beeps in the last 3 seconds.
    const secs = Math.ceil(state.remainingMs / 1000);
    if (secs <= 3 && secs > 0 && secs !== lastShownSecond) beep(523, 0.08);
    renderTime();
  };

  function start() {
    if (state.done) { reset(); }
    state.running = true;
    state.endAt = performance.now() + state.remainingMs;
    setButton("pause", "Pause");
    renderPhase(false);
    state.tick = setInterval(loop, 200);
    requestWakeLock();
    if (audioCtx?.state === "suspended") audioCtx.resume();
  }

  function stop() {
    state.running = false;
    clearInterval(state.tick);
    releaseWakeLock();
  }

  function pause() {
    state.remainingMs = state.endAt - performance.now();
    stop();
    setButton("play", "Weiter");
    el.phase.textContent = "Pausiert";
    announce("Pausiert.");
  }

  function reset() {
    stop();
    state.done = false;
    goTo(0, false);
    setButton("play", "Starten");
    el.phase.textContent = "Bereit?";
  }

  el.toggle.addEventListener("click", () => {
    if (state.running) pause();
    else if (state.done) { reset(); start(); }
    else start();
  });
  el.skip.addEventListener("click", () => {
    if (state.done) return;
    const wasRunning = state.running;
    goTo(state.index + 1);
    if (!state.done && !wasRunning) {
      setButton("play", "Weiter");
    }
  });
  el.reset.addEventListener("click", () => { reset(); announce("Zurückgesetzt."); });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && state.running) { loop(); requestWakeLock(); }
  });

  root.hidden = false;
  reset();
}
