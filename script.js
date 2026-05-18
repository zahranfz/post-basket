/* ============================================
   Basketball POST 4.0 — Game Logic
   Pro-Court Broadcast Engine
   ============================================ */

// ============================================
// GAME STATE
// ============================================
const G = {
  sc: { A: 0, B: 0 },
  fouls: { A: 0, B: 0 },
  tos: { A: 0, B: 0 },
  bonus: { A: false, B: false },
  q: 1,
  gsec: 420,        // Game clock seconds (7:00)
  ssec: 24,          // Shot clock seconds
  running: false,
  iv: null,
  ssec_running: true,
  to_active: false,
  to_running: false,
  to_sec: 60,
  to_iv: null,
  jarrow: null,
  minusMode: null    // Track which minus mode is active: 'scoreA', 'scoreB', 'foulA', 'foulB', 'toA', 'toB'
};

// ============================================
// CONSTANTS
// ============================================
const MAXF = 7;       // Max fouls displayed
const MAXT = 7;       // Max timeouts displayed
const QSEC = 420;     // Seconds per quarter (7:00)
const QNAMES = ['Q1', 'Q2', 'Q3', 'Q4', 'OT'];
const BONUS_THRESHOLD = 5; // Auto-bonus when fouls reach 5

// ============================================
// AUDIO — Buzzer
// ============================================
function playBuzzer() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(80, ctx.currentTime + 1);
    gain.gain.setValueAtTime(0.8, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 1.2);
  } catch (e) {
    console.log("Audio not supported or allowed.");
  }
}

// ============================================
// BUILD DOTS — Fouls & Timeouts
// ============================================
function buildDots(t) {
  ['fd', 'td'].forEach(prefix => {
    const isFoul = prefix === 'fd';
    const el = document.getElementById(prefix + t);
    const max = isFoul ? MAXF : MAXT;
    const val = isFoul ? G.fouls[t] : G.tos[t];
    el.innerHTML = '';
    for (let i = 0; i < max; i++) {
      const d = document.createElement('div');
      d.className = (isFoul ? 'fdot' : 'tdot') + (i < val ? ' on' : '');
      const ci = i;
      d.onclick = () => {
        if (isFoul) {
          G.fouls[t] = (G.fouls[t] === ci + 1 ? ci : ci + 1);
          checkAutoBonus(t);
        } else {
          G.tos[t] = (G.tos[t] === ci + 1 ? ci : ci + 1);
        }
        buildDots(t);
      };
      el.appendChild(d);
    }
  });
}

// ============================================
// AUTO BONUS CHECK
// ============================================
function checkAutoBonus(t) {
  if (G.fouls[t] >= BONUS_THRESHOLD && !G.bonus[t]) {
    toggleBonus(t);
  } else if (G.fouls[t] < BONUS_THRESHOLD && G.bonus[t]) {
    toggleBonus(t);
  }
}

// ============================================
// FOULS
// ============================================
function addFoul(t) {
  if (G.fouls[t] < MAXF) {
    G.fouls[t]++;
    checkAutoBonus(t);
    buildDots(t);
  }
}

function removeFoul(t) {
  if (G.fouls[t] > 0) {
    G.fouls[t]--;
    checkAutoBonus(t);
    buildDots(t);
  }
}

// ============================================
// TIMEOUTS
// ============================================
function addTimeout(t) {
  if (G.tos[t] < MAXT) {
    G.tos[t]++;
    buildDots(t);

    // Pause game clock
    if (G.running) toggleClock();

    // Show timeout overlay
    G.to_active = true;
    G.to_sec = 60;
    G.to_running = false;
    document.getElementById('to-timer').textContent = G.to_sec;
    document.getElementById('to-timer').className = 'to-timer';
    document.getElementById('to-overlay').classList.add('active');
    document.getElementById('btn-to-play').textContent = 'Play (Space)';

    const teamName = document.getElementById('name' + t).value || (t === 'A' ? 'HOME' : 'AWAY');
    document.getElementById('to-team-name').textContent = 'TIMEOUT: ' + teamName;
  }
}

function removeTimeout(t) {
  if (G.tos[t] > 0) {
    G.tos[t]--;
    buildDots(t);
  }
}

// ============================================
// TIMEOUT CLOCK
// ============================================
function toggleToClock() {
  if (G.to_running) {
    clearInterval(G.to_iv);
    G.to_running = false;
    document.getElementById('btn-to-play').textContent = 'Play (Space)';
  } else {
    if (G.to_sec <= 0) return;
    G.to_running = true;
    document.getElementById('btn-to-play').textContent = 'Pause (Space)';
    G.to_iv = setInterval(() => {
      G.to_sec--;
      const timerEl = document.getElementById('to-timer');
      timerEl.textContent = G.to_sec;

      // Visual warning states
      if (G.to_sec <= 5) {
        timerEl.className = 'to-timer danger';
      } else if (G.to_sec <= 10) {
        timerEl.className = 'to-timer warn';
      }

      if (G.to_sec <= 0) {
        clearInterval(G.to_iv);
        G.to_running = false;
        document.getElementById('btn-to-play').textContent = 'Play (Space)';
        playBuzzer();
        // Auto close after 2 seconds
        setTimeout(() => {
          if (G.to_active) closeTimeout();
        }, 2000);
      }
    }, 1000);
  }
}

function closeTimeout() {
  clearInterval(G.to_iv);
  G.to_running = false;
  G.to_active = false;
  document.getElementById('to-overlay').classList.remove('active');
}

// ============================================
// BONUS
// ============================================
function toggleBonus(t) {
  G.bonus[t] = !G.bonus[t];
  const el = document.getElementById('bonus' + t);
  if (G.bonus[t]) el.classList.add('on');
  else el.classList.remove('on');
}

// ============================================
// SCORING
// ============================================
function pts(t, n) {
  G.sc[t] = Math.max(0, G.sc[t] + n);
  const el = document.getElementById('s' + t);
  el.textContent = G.sc[t];
  el.classList.remove('flash');
  void el.offsetWidth; // Force reflow
  if (n > 0) el.classList.add('flash');
}

// ============================================
// TIME FORMATTING
// ============================================
function fmt(s) {
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}

// ============================================
// GAME CLOCK UPDATE
// ============================================
function updClock() {
  const el = document.getElementById('gclock');
  if (G.gsec < 60 && G.gsec > 0) {
    el.textContent = (G.gsec).toFixed(1);
  } else {
    el.textContent = fmt(Math.ceil(G.gsec));
  }
  el.className = 'clk-num' + (G.gsec <= 30 ? ' danger' : G.gsec <= 60 ? ' warn' : '');
}

// ============================================
// SHOT CLOCK UPDATE
// ============================================
function updShot() {
  const el = document.getElementById('sclock');
  const box = document.getElementById('shot-box');
  el.textContent = Math.ceil(G.ssec);

  if (!G.ssec_running) {
    el.className = 'shot-num paused';
    box.classList.remove('warning-bg');
  } else {
    if (G.ssec <= 5) {
      el.className = 'shot-num danger';
      box.classList.add('warning-bg');
    } else if (G.ssec <= 8) {
      el.className = 'shot-num warn';
      box.classList.remove('warning-bg');
    } else {
      el.className = 'shot-num';
      box.classList.remove('warning-bg');
    }
  }
}

// ============================================
// SHOT CLOCK PAUSE
// ============================================
function toggleShotClockPause() {
  G.ssec_running = !G.ssec_running;
  updShot();
}

// ============================================
// JUMPBALL ARROW
// ============================================
function setJumpArrow(dir) {
  if (G.jarrow === dir) {
    G.jarrow = null;
  } else {
    G.jarrow = dir;
  }
  document.getElementById('jarrow-left').classList.remove('active');
  document.getElementById('jarrow-right').classList.remove('active');
  if (G.jarrow === 'left') document.getElementById('jarrow-left').classList.add('active');
  if (G.jarrow === 'right') document.getElementById('jarrow-right').classList.add('active');
}

// ============================================
// MAIN GAME CLOCK
// ============================================
function toggleClock() {
  if (G.running) {
    clearInterval(G.iv);
    G.running = false;
    const b = document.getElementById('btnPP');
    b.innerHTML = '<i class="ti ti-player-play" aria-hidden="true" style="font-size:2vh"></i>Play<span class="k">Space</span>';
    b.className = 'ctrl play';
  } else {
    if (G.gsec <= 0) return;
    G.running = true;
    const b = document.getElementById('btnPP');
    b.innerHTML = '<i class="ti ti-player-pause" aria-hidden="true" style="font-size:2vh"></i>Pause<span class="k">Space</span>';
    b.className = 'ctrl paused';

    let lastTime = performance.now();
    // Interval every 100ms for decimal clock under 1 minute
    G.iv = setInterval(() => {
      const now = performance.now();
      const delta = (now - lastTime) / 1000; // in seconds
      lastTime = now;

      if (G.gsec > 0) {
        G.gsec = Math.max(0, G.gsec - delta);
        updClock();
      }
      if (G.ssec > 0 && G.ssec_running) {
        G.ssec = Math.max(0, G.ssec - delta);
        updShot();
      }

      // Game clock expired
      if (G.gsec <= 0 && G.running) {
        G.gsec = 0;
        updClock();
        clearInterval(G.iv);
        G.running = false;
        document.getElementById('btnPP').innerHTML = '<i class="ti ti-player-play" aria-hidden="true" style="font-size:2vh"></i>Play<span class="k">Space</span>';
        document.getElementById('btnPP').className = 'ctrl play';
        playBuzzer();
      }
      // Shot clock expired
      else if (G.ssec <= 0 && G.ssec_running && G.running) {
        G.ssec = 0;
        updShot();
        clearInterval(G.iv);
        G.running = false;
        document.getElementById('btnPP').innerHTML = '<i class="ti ti-player-play" aria-hidden="true" style="font-size:2vh"></i>Play<span class="k">Space</span>';
        document.getElementById('btnPP').className = 'ctrl play';
        playBuzzer();
      }
    }, 50);
  }
}

// ============================================
// SHOT CLOCK CONTROLS
// ============================================
function resetShot(n) {
  G.ssec = n;
  G.ssec_running = true;
  updShot();
}

function adjShot(n) {
  let newVal = Math.ceil(G.ssec) + n;
  if (newVal >= 0 && newVal <= 99) {
    G.ssec = newVal;
    updShot();
  }
}

// ============================================
// QUARTER CHANGE
// ============================================
function changeQ(d) {
  G.q = Math.max(1, Math.min(5, G.q + d));
  document.getElementById('qbadge').textContent = QNAMES[G.q - 1];
  if (!G.running) {
    G.gsec = QSEC;
    updClock();
  }
}

// ============================================
// RESET FUNCTIONS
// ============================================
function resetFoulsTimeouts() {
  G.fouls = { A: 0, B: 0 };
  G.tos = { A: 0, B: 0 };
  G.bonus = { A: false, B: false };
  document.getElementById('bonusA').classList.remove('on');
  document.getElementById('bonusB').classList.remove('on');
  buildDots('A');
  buildDots('B');
}

function fullReset() {
  clearInterval(G.iv);
  G.running = false;
  G.sc = { A: 0, B: 0 };
  resetFoulsTimeouts();
  setJumpArrow(null);
  G.q = 1;
  G.gsec = QSEC;
  G.ssec = 24;
  G.ssec_running = true;
  document.getElementById('sA').textContent = 0;
  document.getElementById('sB').textContent = 0;
  document.getElementById('qbadge').textContent = 'Q1';
  document.getElementById('btnPP').innerHTML = '<i class="ti ti-player-play" aria-hidden="true" style="font-size:2vh"></i>Play<span class="k">Space</span>';
  document.getElementById('btnPP').className = 'ctrl play';
  updClock();
  updShot();
}

// ============================================
// FULLSCREEN
// ============================================
function toggleFullScreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(err => {
      console.log(`Error: ${err.message}`);
    });
  } else {
    document.exitFullscreen();
  }
}

// ============================================
// EDIT CLOCKS (click to set)
// ============================================
function editClock() {
  const wasRunning = G.running;
  if (wasRunning) toggleClock();
  let input = prompt("Set Game Clock (MM:SS or Seconds):", fmt(Math.ceil(G.gsec)));
  if (input) {
    if (input.includes(':')) {
      let parts = input.split(':');
      G.gsec = parseInt(parts[0]) * 60 + parseInt(parts[1]);
    } else {
      G.gsec = parseFloat(input);
    }
    updClock();
  }
}

function editShot() {
  const wasRunning = G.running;
  if (wasRunning) toggleClock();
  let input = prompt("Set Shot Clock (Seconds):", Math.ceil(G.ssec));
  if (input) {
    G.ssec = parseFloat(input);
    updShot();
  }
}

// ============================================
// KEYBOARD SHORTCUTS
// ============================================
document.addEventListener('keydown', e => {
  // Ignore when typing in input fields
  if (e.target.tagName === 'INPUT') return;

  const k = e.key.toLowerCase();

  // Arrow keys for jumpball
  if (e.key === 'ArrowLeft') { setJumpArrow('left'); return; }
  if (e.key === 'ArrowRight') { setJumpArrow('right'); return; }

  // When timeout overlay is active
  if (G.to_active) {
    if (k === ' ') { e.preventDefault(); toggleToClock(); }
    else if (k === 'c') closeTimeout();
    return;
  }

  // Scoring — Home
  if (k === 'q') pts('A', 1);
  else if (k === 'w') pts('A', 2);
  else if (k === 'e') pts('A', 3);
  // Scoring — Away
  else if (k === 'u') pts('B', 1);
  else if (k === 'i') pts('B', 2);
  else if (k === 'o') pts('B', 3);
  // Clock controls
  else if (k === ' ') { e.preventDefault(); toggleClock(); }
  else if (k === 'p') toggleShotClockPause();
  else if (k === 's') resetShot(24);
  else if (k === 'd') resetShot(14);
  // Period
  else if (k === 't') changeQ(1);
  // Fouls
  else if (k === 'f') addFoul('A');
  else if (k === 'g') addFoul('B');
  // Timeouts — triggers timeout view
  else if (k === 'x') addTimeout('A');
  else if (k === 'm') addTimeout('B');
  // Shot clock adjustment
  else if (k === '1') adjShot(1);
  else if (k === '2') adjShot(-1);
  // Full Reset
  else if (k === 'r') fullReset();
  // Minus key — reduce score by 1
  else if (k === '-' || e.key === 'Subtract') {
    // Reduce home score (last touched or default A)
    pts('A', -1);
  }
  // Fullscreen
  else if (e.key === 'F11') {
    e.preventDefault();
    toggleFullScreen();
  }
});

// ============================================
// INITIALIZATION
// ============================================
buildDots('A');
buildDots('B');
updClock();
updShot();
