// Chave no localStorage (mesma usada pelo jogo)
const STORAGE_KEY = 'tapedash_scores';

// Carrega pontuações do localStorage
function loadScores() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
        try {
            const parsed = JSON.parse(raw);
            // Filtra entradas inválidas (sem score numérico real)
            return parsed.filter(e => typeof e.score === 'number' && e.score > 0);
        } catch (_) { /* ignora */ }
    }
    return [];
}

function saveScores(scores) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(scores));
}

// Formata número com zeros à esquerda (6 dígitos)
function pad(n) {
    return String(n).padStart(6, '0');
}

// Renderiza a lista e o recorde
function render() {
    const scores = loadScores()
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);

    const listEl      = document.getElementById('scores-list');
    const emptyEl     = document.getElementById('empty-state');
    const bestScoreEl = document.getElementById('best-score');
    const bestDateEl  = document.getElementById('best-date');

    // Recorde
    if (scores.length > 0) {
        bestScoreEl.textContent = pad(scores[0].score);
        bestDateEl.textContent  = scores[0].date;
    } else {
        bestScoreEl.textContent = '------';
        bestDateEl.textContent  = '--/--/----';
    }

    // Lista
    listEl.innerHTML = '';

    if (scores.length === 0) {
        emptyEl.style.display = 'flex';
        return;
    }

    emptyEl.style.display = 'none';

    scores.forEach((entry, i) => {
        const delay = 0.38 + i * 0.04;
        const rank  = i + 1;
        const li    = document.createElement('li');
        li.className = `score-row rank-${rank}`;
        li.style.animationDelay = `${delay}s`;
        li.innerHTML = `
            <span class="col-rank-val">${rank}</span>
            <span class="col-score-val">${pad(entry.score)}</span>
            <span class="col-date-val">${entry.date}</span>
            <span class="col-time-val">${entry.time}</span>
        `;
        listEl.appendChild(li);
    });
}

// ── Botão limpar ──
document.getElementById('btn-clear').addEventListener('click', () => {
    // Modal de confirmação
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
        <div class="modal-box">
            <div class="corner top-left"></div>
            <div class="corner top-right"></div>
            <div class="corner bottom-left"></div>
            <div class="corner bottom-right"></div>
            <p>// ATENÇÃO</p>
            <h2>APAGAR TODOS OS REGISTROS?</h2>
            <div class="modal-actions">
                <button class="modal-cancel" id="modal-cancel">CANCELAR</button>
                <button class="modal-confirm" id="modal-confirm">CONFIRMAR</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    document.getElementById('modal-cancel').addEventListener('click', () => overlay.remove());
    document.getElementById('modal-confirm').addEventListener('click', () => {
        saveScores([]);
        overlay.remove();
        render();
    });
});

// Inicializa
render();
