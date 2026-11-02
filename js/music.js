/* ══════════════════════════════════════
   TAPE DASH — Music Engine
   Web Audio API — sem arquivos externos

   Duas faixas:
   · MENU  → loop arcade sci-fi (menu / pontuação)
   · OVER  → jingle curto de game over (toca 1x)
   ══════════════════════════════════════ */

const Music = (() => {
    let ctx         = null;
    let masterGain  = null;
    let loopNodes   = [];   // osciladores/buffers do loop atual
    let loopTimeout = null;
    let playing     = null; // 'menu' | null

    /* ── Contexto ── */
    function getCtx() {
        if (!ctx) {
            ctx = new (window.AudioContext || window.webkitAudioContext)();
            masterGain = ctx.createGain();
            masterGain.gain.value = 0.22;
            masterGain.connect(ctx.destination);
        }
        if (ctx.state === 'suspended') ctx.resume();
        return ctx;
    }

    /* ── Utilitário: nota → frequência ──
       oitava 4 = base (C4 = 261.63 Hz)       */
    const NOTE = {
        C3:130.81, D3:146.83, E3:164.81, F3:174.61,
        G3:196.00, A3:220.00, B3:246.94,
        C4:261.63, D4:293.66, E4:329.63, F4:349.23,
        G4:392.00, A4:440.00, B4:493.88,
        C5:523.25, D5:587.33, E5:659.25, F5:698.46,
        G5:783.99, A5:880.00,
        Cs4:277.18, Ds4:311.13, Fs4:369.99, Gs4:415.30, As4:466.16,
        Cs5:554.37, Ds5:622.25, Fs5:739.99,
    };

    /* ── Agenda um oscilador numa timeline ── */
    function schedOsc({ freq, type = 'square', vol = 0.5,
                         start, dur, ctx: c, dest }) {
        const osc  = c.createOscillator();
        const gain = c.createGain();
        osc.type            = type;
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(vol, start + 0.008);
        gain.gain.setValueAtTime(vol, start + dur - 0.01);
        gain.gain.linearRampToValueAtTime(0,   start + dur);
        osc.connect(gain);
        gain.connect(dest);
        osc.start(start);
        osc.stop(start + dur + 0.02);
        loopNodes.push(osc);
    }

    /* ── Bateria sintetizada ──
       kick: burst de ruído + sine descendente
       snare: burst de ruído curto                */
    function schedKick(t, c, dest) {
        // Sine descendente (corpo do kick)
        const osc  = c.createOscillator();
        const gain = c.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(160, t);
        osc.frequency.exponentialRampToValueAtTime(40, t + 0.15);
        gain.gain.setValueAtTime(0.7, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
        osc.connect(gain); gain.connect(dest);
        osc.start(t); osc.stop(t + 0.2);
        loopNodes.push(osc);
    }

    function schedSnare(t, c, dest) {
        const buf = c.createBuffer(1, c.sampleRate * 0.1, c.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        const src  = c.createBufferSource();
        const gain = c.createGain();
        const filt = c.createBiquadFilter();
        src.buffer       = buf;
        filt.type        = 'highpass';
        filt.frequency.value = 2000;
        gain.gain.setValueAtTime(0.28, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
        src.connect(filt); filt.connect(gain); gain.connect(dest);
        src.start(t); src.stop(t + 0.12);
        loopNodes.push(src);
    }

    function schedHihat(t, c, dest) {
        const buf = c.createBuffer(1, c.sampleRate * 0.04, c.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        const src  = c.createBufferSource();
        const gain = c.createGain();
        const filt = c.createBiquadFilter();
        src.buffer       = buf;
        filt.type        = 'highpass';
        filt.frequency.value = 7000;
        gain.gain.setValueAtTime(0.12, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.035);
        src.connect(filt); filt.connect(gain); gain.connect(dest);
        src.start(t); src.stop(t + 0.05);
        loopNodes.push(src);
    }

    /* ════════════════════════════════
       FAIXA DO MENU
       Estilo: arcade sci-fi 8-bit
       BPM: 138 → beat = ~435ms
       Compasso: 4/4, 4 compassos por loop (≈6.96s)
       ════════════════════════════════ */
    function scheduleMenuLoop(startTime) {
        const c    = getCtx();
        const dest = masterGain;
        const BPM  = 138;
        const beat = 60 / BPM;          // ~0.4348s
        const bar  = beat * 4;          // ~1.739s
        const loop = bar * 4;           // ~6.957s  (4 compassos)

        // ── Melodia principal (lead) ──
        // Escala: Lá menor / estilo arcade sci-fi
        const melody = [
            // compasso 1
            [NOTE.A4,  beat * 0.45], [NOTE.C5,  beat * 0.45],
            [NOTE.E5,  beat * 0.45], [NOTE.A5,  beat * 0.65],
            [NOTE.G5,  beat * 0.45], [NOTE.E5,  beat * 0.45],
            [NOTE.D5,  beat * 0.45], [NOTE.C5,  beat * 0.65],
            // compasso 2
            [NOTE.E5,  beat * 0.45], [NOTE.Fs5, beat * 0.45],
            [NOTE.G5,  beat * 0.45], [NOTE.A5,  beat * 0.65],
            [NOTE.G5,  beat * 0.45], [NOTE.Fs5, beat * 0.45],
            [NOTE.E5,  beat * 0.45], [NOTE.D5,  beat * 0.65],
            // compasso 3
            [NOTE.C5,  beat * 0.45], [NOTE.D5,  beat * 0.45],
            [NOTE.E5,  beat * 0.45], [NOTE.G5,  beat * 0.65],
            [NOTE.Fs5, beat * 0.45], [NOTE.E5,  beat * 0.45],
            [NOTE.D5,  beat * 0.45], [NOTE.C5,  beat * 0.65],
            // compasso 4 (resolução + pickup)
            [NOTE.B4,  beat * 0.45], [NOTE.C5,  beat * 0.45],
            [NOTE.D5,  beat * 0.45], [NOTE.E5,  beat * 0.65],
            [NOTE.A4,  beat * 0.45], [NOTE.C5,  beat * 0.45],
            [NOTE.E5,  beat * 0.45], [NOTE.A4,  beat * 0.65],
        ];

        let t = startTime;
        for (const [freq, dur] of melody) {
            schedOsc({ freq, type: 'square', vol: 0.38, start: t, dur: dur * 0.88, ctx: c, dest });
            t += dur;
        }

        // ── Baixo (bass line) ──
        const bass = [
            // c1
            [NOTE.A3, bar * 0.25], [NOTE.A3, bar * 0.25],
            [NOTE.E3, bar * 0.25], [NOTE.A3, bar * 0.25],
            // c2
            [NOTE.D3, bar * 0.25], [NOTE.D3, bar * 0.25],
            [NOTE.A3, bar * 0.25], [NOTE.D3, bar * 0.25],
            // c3
            [NOTE.C4, bar * 0.25], [NOTE.C4, bar * 0.25],
            [NOTE.G3, bar * 0.25], [NOTE.C4, bar * 0.25],
            // c4
            [NOTE.E3, bar * 0.25], [NOTE.G3, bar * 0.25],
            [NOTE.A3, bar * 0.25], [NOTE.E3, bar * 0.25],
        ];

        t = startTime;
        for (const [freq, dur] of bass) {
            schedOsc({ freq, type: 'triangle', vol: 0.55, start: t, dur: dur * 0.7, ctx: c, dest });
            t += dur;
        }

        // ── Arpejo (chord fill) ──
        const arp = [
            NOTE.A4, NOTE.C5, NOTE.E5, NOTE.A5,
            NOTE.D4, NOTE.Fs4, NOTE.A4, NOTE.D5,
            NOTE.C4, NOTE.E4, NOTE.G4, NOTE.C5,
            NOTE.E4, NOTE.G4, NOTE.B4, NOTE.E5,
        ];
        const arpDur = beat * 0.5;
        t = startTime + beat * 0.5; // começa meio beat depois
        for (const freq of arp) {
            schedOsc({ freq, type: 'sine', vol: 0.18, start: t, dur: arpDur * 0.6, ctx: c, dest });
            t += arpDur;
        }

        // ── Bateria ──
        for (let b = 0; b < 16; b++) {         // 16 semicolcheias
            const bt = startTime + b * (beat / 2);
            // Kick: tempos 1 e 3 de cada compasso
            if (b % 4 === 0) schedKick(bt, c, dest);
            // Snare: tempos 2 e 4
            if (b % 4 === 2) schedSnare(bt, c, dest);
            // Hi-hat: toda semicolcheia
            schedHihat(bt, c, dest);
        }

        return loop;
    }

    /* ── Inicia loop do menu ── */
    function startMenu() {
        if (playing === 'menu') return;
        stopAll();
        playing = 'menu';
        const c = getCtx();

        function doLoop() {
            if (playing !== 'menu') return;
            const loopDur = scheduleMenuLoop(c.currentTime + 0.05);
            loopTimeout = setTimeout(doLoop, (loopDur - 0.1) * 1000);
        }
        doLoop();
    }

    /* ════════════════════════════════
       JINGLE DE GAME OVER
       Toca 1x, desce cromático, fecha dramático
       ════════════════════════════════ */
    function playGameOver() {
        stopAll();
        playing = null;
        const c    = getCtx();
        const dest = masterGain;
        masterGain.gain.setValueAtTime(0.28, c.currentTime);

        const seq = [
            // Acordes descendentes + melodia
            { t: 0.00, freq: NOTE.A4,  dur: 0.22 },
            { t: 0.00, freq: NOTE.E4,  dur: 0.22 },
            { t: 0.00, freq: NOTE.C4,  dur: 0.22 },

            { t: 0.28, freq: NOTE.G4,  dur: 0.22 },
            { t: 0.28, freq: NOTE.D4,  dur: 0.22 },
            { t: 0.28, freq: NOTE.B3,  dur: 0.22 },

            { t: 0.56, freq: NOTE.F4,  dur: 0.22 },
            { t: 0.56, freq: NOTE.C4,  dur: 0.22 },
            { t: 0.56, freq: NOTE.A3,  dur: 0.22 },

            { t: 0.84, freq: NOTE.E4,  dur: 0.30 },
            { t: 0.84, freq: NOTE.B3,  dur: 0.30 },
            { t: 0.84, freq: NOTE.G3,  dur: 0.30 },

            // Nota final longa e grave
            { t: 1.25, freq: NOTE.A3,  dur: 0.80 },
            { t: 1.25, freq: NOTE.E3,  dur: 0.80 },
            { t: 1.35, freq: NOTE.A3 / 2, dur: 0.70 },
        ];

        const base = c.currentTime + 0.05;
        for (const s of seq) {
            schedOsc({ freq: s.freq, type: 'sawtooth', vol: 0.30,
                        start: base + s.t, dur: s.dur, ctx: c, dest });
        }

        // Kicks descendentes
        schedKick(base + 0.00, c, dest);
        schedKick(base + 0.28, c, dest);
        schedKick(base + 0.56, c, dest);
        schedKick(base + 0.84, c, dest);

        // Ruído final
        schedSnare(base + 1.25, c, dest);
    }

    /* ── Para tudo ── */
    function stopAll() {
        playing = null;
        clearTimeout(loopTimeout);
        loopNodes.forEach(n => { try { n.stop(); } catch (_) {} });
        loopNodes = [];
    }

    /* ── Fade out suave (ao entrar no jogo) ── */
    function fadeOut(ms = 400) {
        if (!ctx || !masterGain) return;
        const now = ctx.currentTime;
        masterGain.gain.cancelScheduledValues(now);
        masterGain.gain.setValueAtTime(masterGain.gain.value, now);
        masterGain.gain.linearRampToValueAtTime(0, now + ms / 1000);
        setTimeout(() => stopAll(), ms + 50);
    }

    function fadeIn(ms = 300) {
        if (!ctx || !masterGain) return;
        const now = ctx.currentTime;
        masterGain.gain.cancelScheduledValues(now);
        masterGain.gain.setValueAtTime(0, now);
        masterGain.gain.linearRampToValueAtTime(0.22, now + ms / 1000);
    }

    return { startMenu, playGameOver, stopAll, fadeOut, fadeIn };
})();
