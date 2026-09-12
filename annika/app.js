/* Annika Timer 2.0 — application logic */
const version = "20260912-143000";

(function () {
  'use strict';

  /* ------------------------------------------------------------------ *
   * Configuration
   * ------------------------------------------------------------------ */

  const AUDIO_DIR = 'audio-numbers';
  const AUDIO_EXT = '.wav';
  const TICK_MS = 100;                 // display/announcement resolution
  const WORD_GAP = 0.04;               // seconds of silence between words
  const MAX_PARALLEL_LOADS = 8;
  const LOAD_ATTEMPTS = 3;
  const FLASH_MS = 170;
  const FINISH_BEEPS = 3;
  const FINISH_BEEP_GAP = 0.45;
  const SETTINGS_KEY = 'annika-timer/settings/v1';
  const FINAL_CALLOUT_FROM = 10;       // countdown speaks every second from here

  const TINTS = ['#181822', '#202336', '#14161f', '#1e2538', '#181b2c'];

  // Core clips: 0-60, the three plural unit words, and the beep. These are
  // retried and they gate the loading overlay.
  const CORE_CLIPS = Array.from({ length: 61 }, (_, i) => String(i))
    .concat(['hours', 'minutes', 'seconds', 'beep']);

  // Fetched once in the background, no retries, never reported as missing.
  // Drop singular recordings named hour.wav / minute.wav / second.wav next to
  // the others and the timer starts saying "one minute" instead of
  // "one minutes".
  const EXTRA_CLIPS = ['hour', 'minute', 'second'];

  const PHASES = {
    IDLE: 'idle',
    PRECOUNT: 'precount',
    RUNNING: 'running',
    PAUSED: 'paused',
    FINISHED: 'finished'
  };

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ------------------------------------------------------------------ *
   * DOM
   * ------------------------------------------------------------------ */

  const el = {
    bgTint: document.getElementById('bgTint'),
    flash: document.getElementById('flash'),
    ring: document.getElementById('progressRing'),
    display: document.getElementById('timerDisplay'),
    subtitle: document.getElementById('timerSubtitle'),
    status: document.getElementById('status'),
    precountBox: document.getElementById('preCountdownDisplay'),
    precountNumber: document.getElementById('preCountdownNumber'),
    mainBtn: document.getElementById('mainControlBtn'),
    mainIcon: document.getElementById('mainControlIcon'),
    resetBtn: document.getElementById('resetMainBtn'),
    menuBtn: document.getElementById('menuToggleBtn'),
    menu: document.getElementById('menu'),
    menuClose: document.getElementById('menuCloseBtn'),
    countingToggle: document.getElementById('countingToggle'),
    countingIndicator: document.getElementById('toggleIndicator'),
    hourInput: document.getElementById('hourInput'),
    minuteInput: document.getElementById('minuteInput'),
    secondInput: document.getElementById('secondInput'),
    intervalInput: document.getElementById('intervalInput'),
    precountToggle: document.getElementById('preCountdownToggle'),
    precountIndicator: document.getElementById('preCountdownIndicator'),
    precountInput: document.getElementById('preCountdownInput'),
    setStartBtn: document.getElementById('setStartTimeBtn'),
    overlay: document.getElementById('loadingOverlay'),
    overlayContent: document.getElementById('overlayContent'),
    message: document.getElementById('message'),
    loadBtn: document.getElementById('loadBtn'),
    progressWrap: document.getElementById('progressBarWrap'),
    progressBar: document.getElementById('progressBar'),
    progressText: document.getElementById('progressText'),
    notice: document.getElementById('audioNotice'),
    noticeText: document.getElementById('audioNoticeText'),
    retryBtn: document.getElementById('audioRetryBtn'),
    year: document.getElementById('year')
  };

  /* ------------------------------------------------------------------ *
   * Settings (persisted)
   * ------------------------------------------------------------------ */

  const settings = {
    mode: 'down',          // 'down' | 'up'
    hours: 0,
    minutes: 1,
    seconds: 0,
    interval: 10,
    precountEnabled: true,
    precountSeconds: 5
  };

  function loadSettings() {
    let raw;
    try {
      raw = window.localStorage.getItem(SETTINGS_KEY);
    } catch (err) {
      return; // private mode / storage disabled
    }
    if (!raw) return;
    let saved;
    try {
      saved = JSON.parse(raw);
    } catch (err) {
      return;
    }
    if (!saved || typeof saved !== 'object') return;

    if (saved.mode === 'up' || saved.mode === 'down') settings.mode = saved.mode;
    settings.hours = clampInt(saved.hours, 0, 23, settings.hours);
    settings.minutes = clampInt(saved.minutes, 0, 59, settings.minutes);
    settings.seconds = clampInt(saved.seconds, 0, 59, settings.seconds);
    settings.interval = clampInt(saved.interval, 0, 3600, settings.interval);
    settings.precountSeconds = clampInt(saved.precountSeconds, 1, 30, settings.precountSeconds);
    if (typeof saved.precountEnabled === 'boolean') settings.precountEnabled = saved.precountEnabled;
  }

  function saveSettings() {
    try {
      window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (err) {
      /* storage unavailable — settings simply stay session-only */
    }
  }

  function clampInt(value, min, max, fallback) {
    const n = parseInt(value, 10);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(Math.max(n, min), max);
  }

  function configuredSeconds() {
    return settings.hours * 3600 + settings.minutes * 60 + settings.seconds;
  }

  /* ------------------------------------------------------------------ *
   * State machine
   *
   * All timing is derived from Date.now(), never from counting ticks, so
   * the clock stays correct after the tab is throttled or the screen is
   * locked. accumMs holds time banked by earlier run segments; runStartedAt
   * marks the start of the current segment.
   * ------------------------------------------------------------------ */

  const state = {
    phase: PHASES.IDLE,
    // The direction in force for the current run. Changing the setting while
    // the clock is moving must not flip the display under the user; the new
    // value is picked up on the next reset.
    mode: settings.mode,
    target: configuredSeconds(),   // countdown length, or count-up goal (0 = open ended)
    accumMs: 0,
    runStartedAt: null,
    lastShownSec: null,
    precountEndsAt: null,
    precountRemainingMs: 0,
    precountShown: null,
    resumeToPrecount: false,
    audioReady: false,
    audioLoading: false,
    audioFailures: []
  };

  function elapsedSeconds(now) {
    let ms = state.accumMs;
    if (state.phase === PHASES.RUNNING && state.runStartedAt !== null) {
      ms += now - state.runStartedAt;
    }
    return ms / 1000;
  }

  function shownSeconds(now) {
    const elapsed = elapsedSeconds(now);
    if (state.mode === 'down') {
      return Math.max(0, Math.ceil(state.target - elapsed - 1e-6));
    }
    if (state.target > 0) {
      return Math.min(state.target, Math.floor(elapsed + 1e-6));
    }
    return Math.floor(elapsed + 1e-6);
  }

  function isComplete(now) {
    if (state.target <= 0) return false;          // open-ended count up
    return elapsedSeconds(now) >= state.target;
  }

  /* ------------------------------------------------------------------ *
   * Audio
   * ------------------------------------------------------------------ */

  let ctx = null;
  let master = null;
  const buffers = Object.create(null);
  let keepAlive = null;

  function ensureContext() {
    if (ctx) return ctx;
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = 1;
    master.connect(ctx.destination);
    return ctx;
  }

  function resumeContext() {
    if (ctx && ctx.state === 'suspended') {
      const p = ctx.resume();
      if (p && typeof p.catch === 'function') p.catch(noop);
    }
  }

  function decodeAudio(arrayBuffer) {
    return new Promise(function (resolve, reject) {
      const maybePromise = ctx.decodeAudioData(arrayBuffer, resolve, reject);
      if (maybePromise && typeof maybePromise.then === 'function') {
        maybePromise.then(resolve, reject);
      }
    });
  }

  function sleep(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  async function loadClip(name, attempts) {
    const tries = attempts || LOAD_ATTEMPTS;
    let lastError = null;
    for (let attempt = 0; attempt < tries; attempt++) {
      try {
        const response = await fetch(AUDIO_DIR + '/' + encodeURIComponent(name) + AUDIO_EXT);
        if (!response.ok) throw new Error('HTTP ' + response.status);
        const arrayBuffer = await response.arrayBuffer();
        buffers[name] = await decodeAudio(arrayBuffer);
        return true;
      } catch (err) {
        lastError = err;
        if (attempt < tries - 1) await sleep(300 * (attempt + 1));
      }
    }
    if (lastError) { /* swallowed: caller records the failure */ }
    return false;
  }

  async function runPool(items, limit, worker) {
    let index = 0;
    const size = Math.min(limit, items.length);
    const runners = [];
    for (let i = 0; i < size; i++) {
      runners.push((async function () {
        while (index < items.length) {
          const item = items[index++];
          await worker(item);
        }
      })());
    }
    await Promise.all(runners);
  }

  /**
   * Loads every clip and resolves once all of them have *settled*, not once
   * all of them have succeeded. A missing file can no longer leave the app
   * stuck behind the loading overlay with a disabled start button.
   */
  async function loadAudio() {
    if (!ensureContext()) {
      state.audioReady = true;
      state.audioFailures = CORE_CLIPS.slice();
      finishLoading();
      return;
    }
    resumeContext();

    state.audioLoading = true;
    state.audioFailures = [];

    let settled = 0;
    const total = CORE_CLIPS.length;
    showProgress(0, total);

    await runPool(CORE_CLIPS, MAX_PARALLEL_LOADS, async function (name) {
      const ok = await loadClip(name);
      if (!ok) state.audioFailures.push(name);
      settled++;
      showProgress(settled, total);
    });

    state.audioLoading = false;
    state.audioReady = true;
    finishLoading();

    // Singular unit words are a nice-to-have; fetching them must never hold
    // up the start button, so this is deliberately not awaited.
    loadExtras();
  }

  async function loadExtras() {
    await runPool(EXTRA_CLIPS, EXTRA_CLIPS.length, async function (name) {
      await loadClip(name, 1);
    });
  }

  function playBuffer(buffer, when) {
    if (!ctx || !buffer) return null;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(master);
    source.start(Math.max(when, ctx.currentTime));
    return source;
  }

  function unitWord(base, count) {
    const singular = base;            // 'hour'
    const plural = base + 's';        // 'hours'
    if (count === 1 && buffers[singular]) return singular;
    return plural;
  }

  /**
   * Turns a number of seconds into the clip names to play.
   * Zero components are skipped, so 2 hours flat is "two hours" rather than
   * "two hours zero minutes zero seconds". With bare set, a sub-minute value
   * is spoken as just the number, which is what makes the closing seconds of
   * a countdown feel tight.
   */
  function wordsForSeconds(total, bare) {
    const safe = Math.max(0, Math.floor(total));
    const hours = Math.floor(safe / 3600);
    const minutes = Math.floor((safe % 3600) / 60);
    const secs = safe % 60;
    const words = [];

    if (hours === 0 && minutes === 0) {
      words.push(String(secs));
      if (!bare) words.push(unitWord('second', secs));
      return words;
    }

    if (hours > 0) {
      words.push(String(hours), unitWord('hour', hours));
    }
    if (minutes > 0) {
      words.push(String(minutes), unitWord('minute', minutes));
    }
    if (secs > 0) {
      words.push(String(secs), unitWord('second', secs));
    }
    return words;
  }

  /**
   * Schedules a phrase on the AudioContext clock. Each clip starts exactly
   * where the previous one ended, so nothing depends on setTimeout accuracy
   * or on every recording being shorter than a fixed slot.
   * Returns the length of the phrase in seconds.
   */
  function speak(words, offset) {
    if (!ctx || !words || !words.length) return 0;
    resumeContext();
    let when = ctx.currentTime + (offset || 0.03);
    const start = when;
    for (let i = 0; i < words.length; i++) {
      const buffer = buffers[words[i]];
      if (!buffer) continue;          // missing clip: skip the word, keep the phrase
      playBuffer(buffer, when);
      when += buffer.duration + WORD_GAP;
    }
    return when - start;
  }

  function announce(totalSeconds, offset, bare) {
    return speak(wordsForSeconds(totalSeconds, bare), offset);
  }

  function playBeep(offset) {
    if (!buffers.beep || !ctx) return 0;
    playBuffer(buffers.beep, ctx.currentTime + (offset || 0.02));
    return buffers.beep.duration;
  }

  function playFinishAlarm() {
    if (!buffers.beep || !ctx) return;
    const base = ctx.currentTime + 0.03;
    for (let i = 0; i < FINISH_BEEPS; i++) {
      playBuffer(buffers.beep, base + i * FINISH_BEEP_GAP);
    }
  }

  /**
   * A near-silent looping source keeps the audio graph active. iOS suspends
   * an idle AudioContext when the screen locks, which is what used to cut
   * the announcements off mid-run.
   */
  function startKeepAlive() {
    if (keepAlive || !ctx) return;
    const frames = Math.max(1, Math.floor(ctx.sampleRate * 0.5));
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) {
      data[i] = (Math.random() * 2 - 1) * 1e-4;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(master);
    source.start(0);
    keepAlive = source;
  }

  function stopKeepAlive() {
    if (!keepAlive) return;
    try { keepAlive.stop(0); } catch (err) { /* already stopped */ }
    try { keepAlive.disconnect(); } catch (err) { /* already disconnected */ }
    keepAlive = null;
  }

  /* ------------------------------------------------------------------ *
   * Screen wake lock
   * ------------------------------------------------------------------ */

  let wakeLock = null;

  async function acquireWakeLock() {
    if (!('wakeLock' in navigator) || wakeLock) return;
    try {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', function () { wakeLock = null; });
    } catch (err) {
      wakeLock = null;            // unsupported or denied; not fatal
    }
  }

  function releaseWakeLock() {
    if (!wakeLock) return;
    const lock = wakeLock;
    wakeLock = null;
    const p = lock.release();
    if (p && typeof p.catch === 'function') p.catch(noop);
  }

  /* ------------------------------------------------------------------ *
   * Visual effects
   * ------------------------------------------------------------------ */

  let flashTimer = null;

  function flash() {
    if (reducedMotion) return;
    el.flash.classList.add('on');
    clearTimeout(flashTimer);
    flashTimer = setTimeout(function () {
      el.flash.classList.remove('on');
    }, FLASH_MS);
  }

  function shiftTint() {
    if (reducedMotion) return;
    el.bgTint.style.backgroundColor = TINTS[Math.floor(Math.random() * TINTS.length)];
  }

  function clearTint() {
    el.bgTint.style.backgroundColor = 'transparent';
  }

  /* ------------------------------------------------------------------ *
   * Transitions
   * ------------------------------------------------------------------ */

  let ticker = null;

  function startTicker() {
    if (ticker === null) ticker = setInterval(tick, TICK_MS);
  }

  function stopTicker() {
    if (ticker !== null) {
      clearInterval(ticker);
      ticker = null;
    }
  }

  function start() {
    if (!state.audioReady) return;

    if (state.mode === 'down' && state.target <= 0) {
      setStatus('Set a time first');
      openMenu();
      return;
    }

    const now = Date.now();

    if (state.phase === PHASES.FINISHED) {
      reset();
      return;
    }

    if (state.phase === PHASES.PAUSED) {
      if (state.resumeToPrecount) {
        state.resumeToPrecount = false;
        state.precountEndsAt = now + state.precountRemainingMs;
        state.precountShown = null;
        state.phase = PHASES.PRECOUNT;
        startKeepAlive();
        acquireWakeLock();
        startTicker();
        setStatus('');
        render();
        return;
      }
      beginRun(now, false);
      return;
    }

    if (state.phase !== PHASES.IDLE) return;

    if (settings.precountEnabled && settings.precountSeconds >= 1) {
      state.phase = PHASES.PRECOUNT;
      state.precountEndsAt = now + settings.precountSeconds * 1000;
      state.precountShown = settings.precountSeconds;
      showPrecount(settings.precountSeconds);
      startKeepAlive();
      acquireWakeLock();
      startTicker();
      setStatus('');
      render();
      return;
    }

    beginRun(now, true);
  }

  function beginRun(now, announceStart) {
    hidePrecount();
    clearTint();
    state.phase = PHASES.RUNNING;
    state.runStartedAt = now;
    state.lastShownSec = shownSeconds(now);
    startKeepAlive();
    acquireWakeLock();
    startTicker();
    setStatus('');

    if (announceStart) {
      const beepLength = playBeep(0.02);
      // A count-up starting from zero gets the beep only; "zero" adds nothing.
      if (state.lastShownSec > 0) {
        announce(state.lastShownSec, beepLength + 0.12, false);
      }
    }
    render();
  }

  function pause() {
    const now = Date.now();

    if (state.phase === PHASES.PRECOUNT) {
      state.precountRemainingMs = Math.max(0, state.precountEndsAt - now);
      state.resumeToPrecount = true;
      state.precountEndsAt = null;
      hidePrecount();
    } else if (state.phase === PHASES.RUNNING) {
      state.accumMs += now - state.runStartedAt;
      state.runStartedAt = null;
    } else {
      return;
    }

    state.phase = PHASES.PAUSED;
    stopTicker();
    stopKeepAlive();
    releaseWakeLock();
    clearTint();
    setStatus('Paused');
    render();
  }

  function reset() {
    stopTicker();
    stopKeepAlive();
    releaseWakeLock();
    hidePrecount();
    clearTint();

    state.phase = PHASES.IDLE;
    state.mode = settings.mode;
    state.target = configuredSeconds();
    state.accumMs = 0;
    state.runStartedAt = null;
    state.lastShownSec = null;
    state.precountEndsAt = null;
    state.precountRemainingMs = 0;
    state.precountShown = null;
    state.resumeToPrecount = false;

    setStatus('');
    render();
  }

  function finish(now) {
    state.accumMs = state.target * 1000;
    state.runStartedAt = null;
    state.phase = PHASES.FINISHED;
    state.lastShownSec = null;
    stopTicker();
    releaseWakeLock();
    clearTint();
    hidePrecount();
    playFinishAlarm();
    setTimeout(stopKeepAlive, 2000);
    setStatus(state.mode === 'down' ? 'Time is up' : 'Target reached');
    render();
  }

  function tick() {
    const now = Date.now();

    if (state.phase === PHASES.PRECOUNT) {
      const left = Math.max(0, Math.ceil((state.precountEndsAt - now) / 1000 - 1e-6));
      if (now >= state.precountEndsAt) {
        beginRun(now, true);
        return;
      }
      if (left !== state.precountShown) {
        state.precountShown = left;
        showPrecount(left);
      }
      render();
      return;
    }

    if (state.phase !== PHASES.RUNNING) return;

    const sec = shownSeconds(now);
    if (sec !== state.lastShownSec) {
      const previous = state.lastShownSec;
      state.lastShownSec = sec;
      // Only the current value is ever spoken. If the tab was frozen and
      // several seconds went by at once, the skipped numbers are dropped
      // instead of firing off as a burst.
      if (previous !== null) maybeAnnounce(sec);
    }

    if (isComplete(now)) {
      finish(now);
      return;
    }

    render();
  }

  function maybeAnnounce(sec) {
    if (sec <= 0) return;                               // the finish alarm covers zero

    const interval = settings.interval;
    const onInterval = interval > 0 && sec % interval === 0;
    const inFinalStretch = state.mode === 'down' && sec <= FINAL_CALLOUT_FROM;

    if (!onInterval && !inFinalStretch) return;

    // Bare numbers only in a countdown's closing seconds; every other
    // callout keeps its unit word, so a count-up says "ten seconds".
    announce(sec, undefined, inFinalStretch);
    shiftTint();
  }

  function showPrecount(n) {
    flash();
    if (buffers[String(n)]) speak([String(n)]);
    el.precountNumber.textContent = String(n);
    el.precountBox.classList.remove('visible');
    void el.precountBox.offsetWidth;      // restart the pulse animation
    el.precountBox.classList.add('visible');
  }

  function hidePrecount() {
    el.precountBox.classList.remove('visible');
  }

  /* ------------------------------------------------------------------ *
   * Rendering — the only place that writes timer state to the DOM
   * ------------------------------------------------------------------ */

  let ringCircumference = 0;

  function initRing() {
    const r = el.ring.r.baseVal.value;
    ringCircumference = 2 * Math.PI * r;
    el.ring.style.strokeDasharray = ringCircumference + ' ' + ringCircumference;
    el.ring.style.strokeDashoffset = String(ringCircumference);
  }

  function setRing(fraction) {
    if (!ringCircumference) return;
    const clamped = Math.min(Math.max(fraction, 0), 1);
    el.ring.style.strokeDashoffset = String(ringCircumference - clamped * ringCircumference);
  }

  function formatTime(total) {
    const hours = String(Math.floor(total / 3600)).padStart(2, '0');
    const minutes = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
    const secs = String(total % 60).padStart(2, '0');
    return hours + ':' + minutes + ':' + secs;
  }

  function render() {
    const now = Date.now();
    const sec = shownSeconds(now);

    el.display.textContent = formatTime(sec);
    el.subtitle.textContent = state.mode === 'down' ? 'REMAINING' : 'ELAPSED';

    let fraction = 0;
    if (state.target > 0) {
      const elapsed = Math.min(elapsedSeconds(now), state.target);
      fraction = elapsed / state.target;
    }
    setRing(fraction);

    renderControls();
  }

  function renderControls() {
    if (!state.audioReady) {
      el.mainBtn.disabled = true;
      el.mainIcon.textContent = '…';
      el.mainBtn.setAttribute('aria-label', 'Loading audio');
      el.resetBtn.disabled = true;
      return;
    }

    el.mainBtn.disabled = false;

    switch (state.phase) {
      case PHASES.RUNNING:
      case PHASES.PRECOUNT:
        el.mainIcon.textContent = '\u23F8';                 // pause
        el.mainBtn.setAttribute('aria-label', 'Pause timer');
        break;
      case PHASES.PAUSED:
        el.mainIcon.textContent = '\u23EF';                 // play/pause
        el.mainBtn.setAttribute('aria-label', 'Resume timer');
        break;
      case PHASES.FINISHED:
        el.mainIcon.textContent = '\u27F3';                 // reset
        el.mainBtn.setAttribute('aria-label', 'Reset timer');
        break;
      default:
        el.mainIcon.textContent = '\u25B6';                 // play
        el.mainBtn.setAttribute('aria-label', 'Start timer');
    }

    el.resetBtn.disabled = state.phase === PHASES.IDLE;
  }

  function setStatus(text) {
    el.status.textContent = text;
  }

  /* ------------------------------------------------------------------ *
   * Settings panel
   * ------------------------------------------------------------------ */

  function openMenu() {
    el.menu.classList.add('open');
    el.menuBtn.setAttribute('aria-expanded', 'true');
    el.menuClose.focus({ preventScroll: true });
  }

  function closeMenu(returnFocus) {
    if (!el.menu.classList.contains('open')) return;
    el.menu.classList.remove('open');
    el.menuBtn.setAttribute('aria-expanded', 'false');
    if (returnFocus) el.menuBtn.focus({ preventScroll: true });
  }

  function toggleMenu() {
    if (el.menu.classList.contains('open')) closeMenu(true);
    else openMenu();
  }

  function syncIndicators() {
    el.countingToggle.checked = settings.mode === 'up';
    el.countingIndicator.style.left = settings.mode === 'up' ? '28px' : '2px';
    el.precountToggle.checked = settings.precountEnabled;
    el.precountIndicator.style.left = settings.precountEnabled ? '28px' : '2px';
  }

  function settingsToInputs() {
    el.hourInput.value = String(settings.hours);
    el.minuteInput.value = String(settings.minutes);
    el.secondInput.value = String(settings.seconds);
    el.intervalInput.value = String(settings.interval);
    el.precountInput.value = String(settings.precountSeconds);
    syncIndicators();
  }

  function inputsToSettings() {
    settings.mode = el.countingToggle.checked ? 'up' : 'down';
    settings.hours = clampInt(el.hourInput.value, 0, 23, 0);
    settings.minutes = clampInt(el.minuteInput.value, 0, 59, 0);
    settings.seconds = clampInt(el.secondInput.value, 0, 59, 0);
    settings.interval = clampInt(el.intervalInput.value, 0, 3600, 0);
    settings.precountEnabled = el.precountToggle.checked;
    settings.precountSeconds = clampInt(el.precountInput.value, 1, 30, 5);
    saveSettings();
  }

  /**
   * A changed duration is applied straight away when the timer is idle or
   * finished. While it is running or paused, the value is stored but the
   * running clock is left alone, and the status line says so.
   */
  function applySettings() {
    inputsToSettings();
    settingsToInputs();

    if (state.phase === PHASES.IDLE || state.phase === PHASES.FINISHED) {
      reset();
    } else {
      setStatus('Saved — applies after reset');
      render();
    }
  }

  /* ------------------------------------------------------------------ *
   * Loading overlay
   * ------------------------------------------------------------------ */

  function beginLoading() {
    if (state.audioLoading || state.audioReady) return;

    ensureContext();
    resumeContext();

    el.loadBtn.disabled = true;
    el.message.textContent = 'Loading voice files…';
    el.progressWrap.hidden = false;
    el.progressText.hidden = false;

    if (!el.overlayContent.querySelector('.spinner')) {
      const spinner = document.createElement('div');
      spinner.className = 'spinner';
      el.overlayContent.insertBefore(spinner, el.overlayContent.firstChild);
    }

    loadAudio();
  }

  function showProgress(loaded, total) {
    const pct = total > 0 ? (loaded / total) * 100 : 0;
    el.progressBar.style.width = pct + '%';
    el.progressText.textContent = loaded + ' / ' + total + ' files loaded';
  }

  function finishLoading() {
    el.overlay.hidden = true;
    el.loadBtn.disabled = false;
    updateNotice();
    render();
  }

  function updateNotice() {
    const failed = state.audioFailures.length;
    if (!failed) {
      el.notice.hidden = true;
      return;
    }
    el.noticeText.textContent = failed + ' of ' + CORE_CLIPS.length +
      ' voice files did not load. The timer works, but some numbers will stay silent.';
    el.notice.hidden = false;
    setStatus('Audio incomplete');
  }

  async function retryFailed() {
    if (!state.audioFailures.length || state.audioLoading) return;
    const pending = state.audioFailures.slice();
    state.audioLoading = true;
    el.retryBtn.disabled = true;
    el.noticeText.textContent = 'Retrying ' + pending.length + ' file(s)…';

    const stillFailing = [];
    await runPool(pending, MAX_PARALLEL_LOADS, async function (name) {
      const ok = await loadClip(name);
      if (!ok) stillFailing.push(name);
    });

    state.audioFailures = stillFailing;
    state.audioLoading = false;
    el.retryBtn.disabled = false;
    updateNotice();
    if (!stillFailing.length) setStatus('All voice files loaded');
  }

  /* ------------------------------------------------------------------ *
   * Events
   * ------------------------------------------------------------------ */

  function onMainControl() {
    if (!state.audioReady) return;
    if (state.phase === PHASES.RUNNING || state.phase === PHASES.PRECOUNT) pause();
    else start();
  }

  function bindEvents() {
    // Pointer events only. The old touchend + click pair could fire the same
    // handler twice whenever preventDefault was not available, which made the
    // settings panel open and close in the same tap.
    el.mainBtn.addEventListener('click', onMainControl);
    el.resetBtn.addEventListener('click', reset);
    el.menuBtn.addEventListener('click', function (event) {
      event.stopPropagation();
      toggleMenu();
    });
    el.menuClose.addEventListener('click', function (event) {
      event.stopPropagation();
      closeMenu(true);
    });
    el.setStartBtn.addEventListener('click', function () {
      applySettings();
      closeMenu(true);
    });
    el.retryBtn.addEventListener('click', retryFailed);

    el.loadBtn.addEventListener('click', function (event) {
      event.stopPropagation();
      beginLoading();
    });
    el.overlay.addEventListener('click', beginLoading);

    el.countingToggle.addEventListener('change', applySettings);
    el.precountToggle.addEventListener('change', function () {
      inputsToSettings();
      syncIndicators();
    });

    [el.hourInput, el.minuteInput, el.secondInput].forEach(function (input) {
      input.addEventListener('change', applySettings);
    });
    el.intervalInput.addEventListener('change', function () {
      inputsToSettings();
      settingsToInputs();
    });
    el.precountInput.addEventListener('change', function () {
      inputsToSettings();
      settingsToInputs();
    });

    // Close the panel on an outside tap.
    document.addEventListener('pointerdown', function (event) {
      if (!el.menu.classList.contains('open')) return;
      if (el.menu.contains(event.target) || el.menuBtn.contains(event.target)) return;
      closeMenu(false);
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') {
        closeMenu(true);
        return;
      }
      const tag = event.target && event.target.tagName;
      if (tag === 'INPUT' || tag === 'BUTTON' || tag === 'TEXTAREA') return;
      if (event.key === ' ' || event.key === 'Spacebar') {
        event.preventDefault();
        onMainControl();
      } else if (event.key === 'r' || event.key === 'R') {
        reset();
      }
    });

    // Any user gesture is a chance to get the audio context out of suspend.
    document.addEventListener('pointerdown', resumeContext, { passive: true });

    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState !== 'visible') return;
      resumeContext();
      if (state.phase === PHASES.RUNNING || state.phase === PHASES.PRECOUNT) {
        acquireWakeLock();
        tick();                 // catch up immediately after a freeze
      } else {
        render();
      }
    });

    window.addEventListener('pageshow', function () {
      resumeContext();
      render();
    });
  }

  function noop() {}

  /* ------------------------------------------------------------------ *
   * Boot
   * ------------------------------------------------------------------ */

  function init() {
    el.year.textContent = String(new Date().getFullYear());
    loadSettings();
    settingsToInputs();
    state.mode = settings.mode;
    state.target = configuredSeconds();
    initRing();
    bindEvents();
    hidePrecount();
    render();

    if ('serviceWorker' in navigator &&
        (location.protocol === 'https:' || location.hostname === 'localhost')) {
      navigator.serviceWorker.register('sw.js').catch(noop);
    }
  }

  init();
})();
