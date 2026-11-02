/* ══════════════════════════════════════
   TAPE DASH — UI Sounds
   Sons de hover e clique em botões/links
   Web Audio API — sem arquivos externos
   ══════════════════════════════════════ */

const UiSound = (() => {
    let ctx = null;

    function getCtx() {
        if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
        if (ctx.state === 'suspended') ctx.resume();
        return ctx;
    }

    // Oscilador simples com envelope
    function tone({ freq, type = 'square', vol = 0.12,
                    attack = 0.004, decay = 0.06, release = 0.07 }) {
        const c    = getCtx();
        const now  = c.currentTime;
        const osc  = c.createOscillator();
        const gain = c.createGain();

        osc.type            = type;
        osc.frequency.value = freq;

        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(vol,  now + attack);
        gain.gain.linearRampToValueAtTime(0,    now + attack + decay + release);

        osc.connect(gain);
        gain.connect(c.destination);
        osc.start(now);
        osc.stop(now + attack + decay + release + 0.02);
    }

    // ── Hover: tick digital suave ──
    function hover() {
        tone({ freq: 880, type: 'square', vol: 0.07, attack: 0.003, decay: 0.03, release: 0.04 });
    }

    // ── Click: confirmação sci-fi ──
    // dois tons sobrepostos → sensação de "beep duplo"
    function click() {
        tone({ freq: 660,  type: 'square', vol: 0.13, attack: 0.003, decay: 0.05, release: 0.06 });
        tone({ freq: 1320, type: 'sine',   vol: 0.07, attack: 0.005, decay: 0.04, release: 0.05 });
    }

    // ── Aplica nos seletores passados ──
    function bind(selector) {
        document.querySelectorAll(selector).forEach(el => {
            el.addEventListener('mouseenter', hover);
            el.addEventListener('touchstart', hover, { passive: true });
            el.addEventListener('click',      click);
        });
    }

    // ── Observa elementos adicionados dinamicamente (modais, etc.) ──
    function observe(selector) {
        const obs = new MutationObserver(() => bind(selector));
        obs.observe(document.body, { childList: true, subtree: true });
    }

    return { hover, click, bind, observe };
})();

// ── Inicialização automática ──
// Seletores que recebem os sons em todas as páginas
const UI_BTN_SELECTOR = [
    'a[href]',
    'button',
    '.menu-link',
    '.btn-primary',
    '.btn-ghost',
    '.btn-clear',
    '.btn-play',
    '.back-btn',
    '.modal-cancel',
    '.modal-confirm',
].join(', ');

document.addEventListener('DOMContentLoaded', () => {
    UiSound.bind(UI_BTN_SELECTOR);
    // Monitora modais que aparecem dinamicamente
    UiSound.observe(UI_BTN_SELECTOR);
});
