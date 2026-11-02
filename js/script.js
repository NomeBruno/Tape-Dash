/* ══════════════════════════════════════
   TAPE DASH — Menu principal
   ══════════════════════════════════════ */

const STORAGE_KEY = 'tapedash_scores';

/* ── 1. Efeito de digitação na logo-tag ──────────────────────────
   Cicla entre mensagens de sistema no estilo terminal             */
const tagEl    = document.querySelector('.logo-tag');
const tagLines = [
    '// SYSTEM READY',
    '// TAPE DASH v1.0.0',
    '// PRESS START',
    '// GOOD LUCK, PLAYER',
];
let tagIndex = 0;

function typeText(el, text, onDone) {
    el.textContent = '';
    let i = 0;
    const iv = setInterval(() => {
        el.textContent += text[i++];
        if (i >= text.length) {
            clearInterval(iv);
            if (onDone) setTimeout(onDone, 2200);
        }
    }, 55);
}

function cycleTag() {
    tagIndex = (tagIndex + 1) % tagLines.length;
    typeText(tagEl, tagLines[tagIndex], cycleTag);
}

if (tagEl) {
    // Começa digitando a primeira mensagem, depois cicla
    typeText(tagEl, tagLines[0], cycleTag);
}


/* ── 2. Glitch periódico no logo ─────────────────────────────────
   A cada ~6s aplica uma classe que dispara keyframes de glitch    */
const logoEl = document.querySelector('.logo');

function glitch() {
    if (!logoEl) return;
    logoEl.classList.add('glitch');
    setTimeout(() => logoEl.classList.remove('glitch'), 400);
}

setInterval(glitch, 6000);


/* ── 3. Footer dots mostram se há recorde salvo ──────────────────
   dot 1 = sempre ativo  |  dot 2 = tem ≥1 partida  |  dot 3 = tem recorde alto */
function updateDots() {
    const dots = document.querySelectorAll('.footer-dots .dot');
    if (!dots.length) return;

    const raw = localStorage.getItem(STORAGE_KEY);
    let scores = [];
    try { scores = raw ? JSON.parse(raw) : []; } catch (_) {}

    // dot 2: pelo menos uma partida registrada
    if (scores.length >= 1) dots[1].classList.add('active');

    // dot 3: recorde acima de 1000 pontos
    const best = scores.length ? scores[0].score : 0;
    if (best >= 1000) dots[2].classList.add('active');
}

updateDots();


/* ── 4. Mostrar recorde no rodapé ────────────────────────────────
   Substitui o "2026" pela melhor pontuação salva, se existir      */
function showBestInFooter() {
    const tags = document.querySelectorAll('.footer-tag');
    if (tags.length < 2) return;

    const raw = localStorage.getItem(STORAGE_KEY);
    let scores = [];
    try { scores = raw ? JSON.parse(raw) : []; } catch (_) {}

    if (scores.length > 0) {
        const best = String(Math.floor(scores[0].score)).padStart(6, '0');
        tags[1].textContent      = 'BEST ' + best;
        tags[1].title            = 'Sua melhor pontuação';
    }
}

showBestInFooter();
