/* ══════════════════════════════════════
   TAPE DASH — Jogo de reflexos
   ══════════════════════════════════════ */

// ── Audio Engine (Web Audio API — sem arquivos externos) ──
const Audio = (() => {
    let ctx = null;

    function getCtx() {
        if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
        // Resume se suspenso (política de autoplay)
        if (ctx.state === 'suspended') ctx.resume();
        return ctx;
    }

    // Utilitário: toca um envelope simples
    function beep({ freq = 440, type = 'square', attack = 0.005, decay = 0.08,
                    sustain = 0, release = 0.1, volume = 0.18, detune = 0 } = {}) {
        const c   = getCtx();
        const now = c.currentTime;

        const osc  = c.createOscillator();
        const gain = c.createGain();

        osc.type            = type;
        osc.frequency.value = freq;
        osc.detune.value    = detune;

        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(volume, now + attack);
        gain.gain.linearRampToValueAtTime(volume * sustain, now + attack + decay);
        gain.gain.linearRampToValueAtTime(0, now + attack + decay + release);

        osc.connect(gain);
        gain.connect(c.destination);
        osc.start(now);
        osc.stop(now + attack + decay + release + 0.05);
    }

    // Som de acerto — clique limpo sci-fi
    function hit(combo = 1) {
        // Pitch sobe levemente com o combo
        const baseFreq = 520 + (combo - 1) * 60;
        beep({ freq: baseFreq,      type: 'square', volume: 0.14, attack: 0.003, decay: 0.04, release: 0.06 });
        beep({ freq: baseFreq * 2,  type: 'sine',   volume: 0.08, attack: 0.005, decay: 0.02, release: 0.08, detune: 5 });
    }

    // Som de combo alto (≥ 4)
    function comboHigh() {
        beep({ freq: 880, type: 'square', volume: 0.12, attack: 0.003, decay: 0.06, release: 0.12 });
        beep({ freq: 1320, type: 'sine',  volume: 0.07, attack: 0.006, decay: 0.04, release: 0.1 });
    }

    // Som de miss (clique fora)
    function miss() {
        beep({ freq: 180, type: 'sawtooth', volume: 0.16, attack: 0.003, decay: 0.12, release: 0.15 });
        beep({ freq: 120, type: 'square',   volume: 0.10, attack: 0.005, decay: 0.10, release: 0.12 });
    }

    // Som de timeout (demorou)
    function timeout() {
        beep({ freq: 220, type: 'sawtooth', volume: 0.14, attack: 0.01, decay: 0.15, release: 0.2 });
        beep({ freq: 160, type: 'square',   volume: 0.09, attack: 0.02, decay: 0.12, release: 0.18 });
    }

    // Som de game over (sequência descendente)
    function gameOver() {
        const c   = getCtx();
        const now = c.currentTime;
        const freqs = [400, 320, 240, 160];
        freqs.forEach((f, i) => {
            const osc  = c.createOscillator();
            const gain = c.createGain();
            const t    = now + i * 0.12;
            osc.type            = 'sawtooth';
            osc.frequency.value = f;
            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(0.13, t + 0.01);
            gain.gain.linearRampToValueAtTime(0, t + 0.18);
            osc.connect(gain);
            gain.connect(c.destination);
            osc.start(t);
            osc.stop(t + 0.25);
        });
    }

    // Som de spawn do quadrado — tick sutil
    function spawn() {
        beep({ freq: 660, type: 'sine', volume: 0.06, attack: 0.002, decay: 0.03, release: 0.04 });
    }

    // Som de start
    function start() {
        const c   = getCtx();
        const now = c.currentTime;
        [300, 450, 600].forEach((f, i) => {
            const osc  = c.createOscillator();
            const gain = c.createGain();
            const t    = now + i * 0.1;
            osc.type            = 'square';
            osc.frequency.value = f;
            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(0.11, t + 0.005);
            gain.gain.linearRampToValueAtTime(0, t + 0.1);
            osc.connect(gain);
            gain.connect(c.destination);
            osc.start(t);
            osc.stop(t + 0.15);
        });
    }

    return { hit, comboHigh, miss, timeout, gameOver, spawn, start };
})();

// ── Configuração base ──
const CONFIG = {
    squareMinSize: 55,          // px mínimo do quadrado
    squareMaxSize: 110,         // px máximo
    timeLimit: 2200,            // ms para clicar no quadrado (inicia aqui)
    timeLimitMin: 600,          // limite mínimo após aceleração
    timeLimitDecay: 40,         // ms que subtrai por acerto
    pointsBase: 100,            // pontos base por acerto
    comboMultiplier: 0.5,       // cada combo += 50% do base
    comboMax: 5,                // combo máximo
    storageKey: 'tapedash_scores',
};

// ── Estado ──
let state = {};

// ── Elementos ──
const screens = {
    start: document.getElementById('screen-start'),
    game:  document.getElementById('screen-game'),
    over:  document.getElementById('screen-over'),
};

const hudTime  = document.getElementById('hud-time');
const hudScore = document.getElementById('hud-score');
const hudCombo = document.getElementById('hud-combo');
const arena    = document.getElementById('arena');
const timerBar = document.getElementById('sq-timer-bar');

// ── Utilitários ──
function pad6(n)  { return String(Math.floor(n)).padStart(6, '0'); }
function pad2(n)  { return String(n).padStart(2, '0'); }

function formatTime(ms) {
    const total = Math.floor(ms / 1000);
    return `${pad2(Math.floor(total / 60))}:${pad2(total % 60)}`;
}

function rand(min, max) {
    return Math.random() * (max - min) + min;
}

function showScreen(name) {
    Object.values(screens).forEach(s => s.classList.add('hidden'));
    screens[name].classList.remove('hidden');
}

// ── Navegação ──
document.getElementById('btn-start').addEventListener('click', startGame);
document.getElementById('btn-restart').addEventListener('click', startGame);

// ── Iniciar jogo ──
function startGame() {
    state = {
        score: 0,
        hits: 0,
        combo: 0,
        startTime: Date.now(),
        elapsed: 0,
        running: true,
        timeLimit: CONFIG.timeLimit,
        tickInterval: null,
        sqTimeout: null,
        sqTimerRaf: null,
        sqSpawnedAt: null,
        currentTarget: null,
    };

    showScreen('game');
    updateHUD();
    Music.stopAll();   // garante silêncio durante o jogo
    Audio.start();
    spawnSquare();

    // Tick a cada 100ms para atualizar cronômetro
    state.tickInterval = setInterval(() => {
        if (!state.running) return;
        state.elapsed = Date.now() - state.startTime;
        hudTime.textContent = formatTime(state.elapsed);
    }, 100);
}

// ── Spawn de quadrado ──
function spawnSquare() {
    if (!state.running) return;

    clearExistingSquare();

    const arenaW = arena.clientWidth;
    const arenaH = arena.clientHeight;
    const size   = Math.floor(rand(CONFIG.squareMinSize, CONFIG.squareMaxSize));
    const x      = rand(8, arenaW - size - 8);
    const y      = rand(8, arenaH - size - 8);

    const sq = document.createElement('div');
    sq.className = 'target spawn';
    sq.style.width  = size + 'px';
    sq.style.height = size + 'px';
    sq.style.left   = x + 'px';
    sq.style.top    = y + 'px';

    arena.appendChild(sq);
    state.currentTarget = sq;
    state.sqSpawnedAt   = Date.now();

    Audio.spawn();

    // Clique no quadrado = acerto
    sq.addEventListener('click', (e) => {
        e.stopPropagation();
        handleHit(sq, x + size / 2, y + size / 2);
    });

    // Animar barra de tempo
    startTimerBar(state.timeLimit);

    // Timeout: demorou demais
    state.sqTimeout = setTimeout(() => {
        if (!state.running) return;
        Audio.timeout();
        arena.classList.add('flash-timeout');
        arena.addEventListener('animationend', () => arena.classList.remove('flash-timeout'), { once: true });
        endGame('// TEMPO ESGOTADO');
    }, state.timeLimit);
}

// ── Acerto ──
function handleHit(sq, cx, cy) {
    if (!state.running) return;

    clearTimeout(state.sqTimeout);
    cancelAnimationFrame(state.sqTimerRaf);

    // Combo
    state.combo = Math.min(state.combo + 1, CONFIG.comboMax);
    state.hits++;

    // Sons de acerto
    if (state.combo >= 4) {
        Audio.comboHigh();
    } else {
        Audio.hit(state.combo);
    }

    // Pontos: base + bônus de combo + bônus de velocidade
    const timeUsed  = Date.now() - state.sqSpawnedAt;
    const speedBonus = Math.floor((1 - timeUsed / state.timeLimit) * CONFIG.pointsBase * 0.5);
    const comboBonus = Math.floor(CONFIG.pointsBase * CONFIG.comboMultiplier * (state.combo - 1));
    const points     = CONFIG.pointsBase + comboBonus + Math.max(0, speedBonus);

    state.score += points;

    // Acelera o próximo quadrado
    state.timeLimit = Math.max(CONFIG.timeLimitMin, state.timeLimit - CONFIG.timeLimitDecay);

    // Efeitos visuais
    sq.removeEventListener('click', handleHit);
    sq.classList.add('hit');
    spawnParticles(cx, cy);
    showScorePop(cx, cy, points);
    sq.addEventListener('animationend', () => sq.remove(), { once: true });

    state.currentTarget = null;
    updateHUD();

    // Próximo quadrado
    setTimeout(spawnSquare, 80);
}

// ── Clique fora (miss) ──
arena.addEventListener('click', () => {
    if (!state.running) return;
    clearTimeout(state.sqTimeout);
    cancelAnimationFrame(state.sqTimerRaf);

    arena.classList.add('flash-miss');
    arena.addEventListener('animationend', () => arena.classList.remove('flash-miss'), { once: true });

    Audio.miss();
    endGame('// CLICOU FORA');
});

// ── Fim de jogo ──
function endGame(reason) {
    state.running = false;
    clearInterval(state.tickInterval);
    clearTimeout(state.sqTimeout);
    cancelAnimationFrame(state.sqTimerRaf);
    clearExistingSquare();

    const finalScore = state.score;
    const finalTime  = formatTime(Date.now() - state.startTime);

    // Salva no localStorage (passa a duração da partida como time)
    const best = saveScore(finalScore, finalTime);

    Audio.gameOver();
    Music.playGameOver();  // jingle dramático de game over

    // Popula tela de game over
    document.getElementById('over-reason').textContent  = reason;
    document.getElementById('over-score').textContent   = pad6(finalScore);
    document.getElementById('over-time').textContent    = finalTime;
    document.getElementById('over-hits').textContent    = state.hits;
    document.getElementById('over-best').textContent    = pad6(best);

    const newRecordEl = document.getElementById('new-record');
    if (finalScore > 0 && finalScore >= best) {
        newRecordEl.classList.remove('hidden');
    } else {
        newRecordEl.classList.add('hidden');
    }

    setTimeout(() => showScreen('over'), 300);
}

// ── Persistência ──
// duration = string "mm:ss" da duração da partida
function saveScore(score, duration) {
    const raw = localStorage.getItem(CONFIG.storageKey);
    let scores = [];
    try { scores = raw ? JSON.parse(raw) : []; } catch (_) {}

    const now  = new Date();
    const date = `${pad2(now.getDate())}/${pad2(now.getMonth() + 1)}/${now.getFullYear()}`;

    scores.push({ score, date, time: duration });
    scores.sort((a, b) => b.score - a.score);
    localStorage.setItem(CONFIG.storageKey, JSON.stringify(scores.slice(0, 50)));

    return scores[0].score; // melhor pontuação
}

// ── HUD ──
function updateHUD() {
    hudScore.textContent = pad6(state.score);
    if (state.combo >= 2) {
        hudCombo.textContent = `x${state.combo} COMBO`;
        hudCombo.style.opacity = '1';
    } else {
        hudCombo.textContent = '';
    }
}

// ── Barra de timer do quadrado ──
function startTimerBar(duration) {
    cancelAnimationFrame(state.sqTimerRaf);

    const start = performance.now();

    function tick(now) {
        const elapsed  = now - start;
        const progress = Math.max(0, 1 - elapsed / duration);

        // Muda cor conforme urgência
        const r = Math.floor(255);
        const g = Math.floor(255 * progress);
        const b = Math.floor(255 * progress);
        timerBar.style.background = `rgba(${r},${g},${b},0.9)`;
        timerBar.style.width      = (progress * 100) + '%';

        if (progress > 0 && state.running) {
            state.sqTimerRaf = requestAnimationFrame(tick);
        }
    }

    state.sqTimerRaf = requestAnimationFrame(tick);
}

// ── Remove quadrado atual ──
function clearExistingSquare() {
    if (state.currentTarget) {
        state.currentTarget.remove();
        state.currentTarget = null;
    }
    // remove qualquer target órfão
    arena.querySelectorAll('.target').forEach(el => el.remove());
}

// ── Partículas ──
function spawnParticles(cx, cy) {
    const count = 8;
    for (let i = 0; i < count; i++) {
        const p   = document.createElement('div');
        p.className = 'hit-particle';
        const angle = (i / count) * Math.PI * 2;
        const dist  = rand(20, 55);
        p.style.left = cx + 'px';
        p.style.top  = cy + 'px';
        p.style.setProperty('--tx', Math.cos(angle) * dist + 'px');
        p.style.setProperty('--ty', Math.sin(angle) * dist + 'px');
        arena.appendChild(p);
        p.addEventListener('animationend', () => p.remove(), { once: true });
    }
}

// ── Pontuação flutuante ──
function showScorePop(cx, cy, points) {
    const el = document.createElement('div');
    el.className     = 'score-pop';
    el.textContent   = `+${points}`;
    el.style.left    = (cx - 20) + 'px';
    el.style.top     = (cy - 10) + 'px';
    arena.appendChild(el);
    el.addEventListener('animationend', () => el.remove(), { once: true });
}
