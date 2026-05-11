/**
 * GeoWell Engineer Messenger
 * A fully functional in-app chat system between engineers.
 */

// ─── State ─────────────────────────────────────────────────────────────────
const MessengerState = {
    currentEngineer: null,
    histories: {
        'GIS Engineer': [
            { from: 'them', text: 'Salut! J\'ai mis à jour les données piézométriques du secteur AD-07.', time: '09:14' },
            { from: 'me',   text: 'Bien reçu. Est-ce que tu as vérifié les niveaux statiques?', time: '09:17' },
            { from: 'them', text: 'Oui, tout est à jour. Le WQI moyen est de 78 — acceptable.', time: '09:18' },
            { from: 'them', text: 'Je t\'envoie le rapport complet ce soir.', time: '09:19' },
        ],
        'DRE Engineer': [
            { from: 'them', text: 'Nouvelle image SAR disponible pour la zone M\'Sila Basin.', time: '08:50' },
            { from: 'me',   text: 'Excellent! Tu peux l\'intégrer dans le dashboard QGIS?', time: '09:02' },
            { from: 'them', text: 'Déjà en cours. Résolution 10m, couverture complète.', time: '09:05' },
        ]
    },
    autoReplies: {
        'GIS Engineer': [
            'Je vais vérifier les données immédiatement.',
            'Les résultats de l\'aquifère Batna sont stables ce mois-ci.',
            'Peux-tu me partager les coordonnées GPS du nouveau puits?',
            'Le modèle MODFLOW est en cours d\'exécution, résultats dans 10 min.',
            'J\'ai détecté une anomalie dans les niveaux dynamiques de AD-04.',
        ],
        'DRE Engineer': [
            'L\'analyse NDVI montre une variation significative dans le secteur nord.',
            'Je télécharge la dernière image Sentinel-1 maintenant.',
            'Les données SAR confirment une subsidence légère près de F-09.',
            'Rapport de télédétection prêt. Je t\'envoie le lien.',
            'La couverture satellitaire est optimale cet après-midi.',
        ]
    }
};

// ─── Engineers config ───────────────────────────────────────────────────────
const Engineers = {
    'GIS Engineer': {
        role: 'Hydrogeology Expert',
        color: '#2ed573',
        bg: 'linear-gradient(135deg, #00b894, #2ed573)',
        initials: 'GIS'
    },
    'DRE Engineer': {
        role: 'Remote Sensing Specialist',
        color: '#00d4ff',
        bg: 'linear-gradient(135deg, #0077b6, #00d4ff)',
        initials: 'DRE'
    }
};

// ─── Open Messenger ─────────────────────────────────────────────────────────
window.openMessenger = function(engineerName) {
    const eng = Engineers[engineerName] || Engineers['GIS Engineer'];
    MessengerState.currentEngineer = engineerName;

    // Populate header
    const avatar = document.getElementById('msgAvatar');
    avatar.textContent = eng.initials;
    avatar.style.background = eng.bg;
    avatar.style.color = '#000';

    document.getElementById('msgName').textContent = engineerName;
    document.getElementById('msgRole').textContent = eng.role;

    // Show panel
    const panel = document.getElementById('messengerPanel');
    const overlay = document.getElementById('messengerOverlay');
    panel.style.display = 'flex';
    overlay.style.display = 'block';
    requestAnimationFrame(() => {
        panel.style.transform = 'translateX(0)';
    });

    // Render messages
    renderMessages(engineerName);

    // Focus input
    setTimeout(() => {
        const inp = document.getElementById('messengerInput');
        if (inp) inp.focus();
    }, 400);
};

// ─── Close Messenger ────────────────────────────────────────────────────────
window.closeMessenger = function() {
    const panel = document.getElementById('messengerPanel');
    const overlay = document.getElementById('messengerOverlay');
    panel.style.transform = 'translateX(100%)';
    setTimeout(() => {
        panel.style.display = 'none';
        overlay.style.display = 'none';
    }, 350);
};

// ─── Render Messages ────────────────────────────────────────────────────────
function renderMessages(engineerName) {
    const container = document.getElementById('messengerMessages');
    const history = MessengerState.histories[engineerName] || [];
    const eng = Engineers[engineerName] || Engineers['GIS Engineer'];

    container.innerHTML = '';

    // Date separator
    const sep = document.createElement('div');
    sep.style.cssText = 'text-align:center;font-size:0.68rem;color:#334155;margin:0.5rem 0;';
    sep.textContent = 'Today';
    container.appendChild(sep);

    history.forEach(msg => appendBubble(msg, eng, false));
    scrollToBottom();
}

// ─── Append a single bubble ─────────────────────────────────────────────────
function appendBubble(msg, eng, animate = true) {
    const container = document.getElementById('messengerMessages');
    const isMe = msg.from === 'me';

    const wrap = document.createElement('div');
    wrap.style.cssText = `
        display:flex; flex-direction:column;
        align-items:${isMe ? 'flex-end' : 'flex-start'};
        ${animate ? 'animation:msgIn 0.25s ease-out;' : ''}
    `;

    const bubble = document.createElement('div');
    bubble.style.cssText = `
        max-width:80%; padding:10px 14px; border-radius:${isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px'};
        font-size:0.85rem; line-height:1.5; word-break:break-word;
        ${isMe
            ? `background:linear-gradient(135deg,${eng.color}22,${eng.color}44); border:1px solid ${eng.color}55; color:#e0e6ed;`
            : 'background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.08); color:#cbd5e1;'
        }
    `;
    bubble.textContent = msg.text;

    const time = document.createElement('div');
    time.style.cssText = 'font-size:0.62rem;color:#475569;margin-top:3px;';
    time.textContent = msg.time + (isMe ? ' ✓✓' : '');

    wrap.appendChild(bubble);
    wrap.appendChild(time);
    container.appendChild(wrap);
}

// ─── Send Message ───────────────────────────────────────────────────────────
window.sendMessage = function() {
    const input = document.getElementById('messengerInput');
    const text = input.value.trim();
    if (!text) return;

    const engineer = MessengerState.currentEngineer;
    const eng = Engineers[engineer] || Engineers['GIS Engineer'];
    const now = new Date();
    const time = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

    // Add my message
    const msg = { from: 'me', text, time };
    if (!MessengerState.histories[engineer]) MessengerState.histories[engineer] = [];
    MessengerState.histories[engineer].push(msg);
    appendBubble(msg, eng, true);
    input.value = '';
    scrollToBottom();

    // Simulate typing + auto reply
    const replies = MessengerState.autoReplies[engineer] || ['Je reviendrai vers toi sous peu.'];
    const reply = replies[Math.floor(Math.random() * replies.length)];
    const delay = 1200 + Math.random() * 1200;

    const indicator = document.getElementById('typingIndicator');
    setTimeout(() => {
        indicator.style.display = 'block';
        scrollToBottom();
    }, 600);

    setTimeout(() => {
        indicator.style.display = 'none';
        const replyTime = new Date();
        const replyMsg = {
            from: 'them',
            text: reply,
            time: `${String(replyTime.getHours()).padStart(2,'0')}:${String(replyTime.getMinutes()).padStart(2,'0')}`
        };
        MessengerState.histories[engineer].push(replyMsg);
        appendBubble(replyMsg, eng, true);
        scrollToBottom();
    }, delay);
};

// ─── Helpers ────────────────────────────────────────────────────────────────
function scrollToBottom() {
    const c = document.getElementById('messengerMessages');
    if (c) setTimeout(() => { c.scrollTop = c.scrollHeight; }, 50);
}

// ─── Inject CSS animation ────────────────────────────────────────────────────
(function injectStyles() {
    const s = document.createElement('style');
    s.textContent = `
        @keyframes msgIn {
            from { opacity: 0; transform: translateY(8px); }
            to   { opacity: 1; transform: translateY(0); }
        }
        #messengerMessages::-webkit-scrollbar { width: 4px; }
        #messengerMessages::-webkit-scrollbar-track { background: transparent; }
        #messengerMessages::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 4px; }
    `;
    document.head.appendChild(s);
})();

// ─── Wire up msg-btn clicks ──────────────────────────────────────────────────
document.addEventListener('click', e => {
    const btn = e.target.closest('.msg-btn');
    if (!btn) return;
    const card = btn.closest('.expert-card');
    if (!card) return;
    const name = card.querySelector('h3')?.textContent?.trim() || 'GIS Engineer';
    openMessenger(name);
});

// ─── Wire up expert-pill clicks ─────────────────────────────────────────────
document.addEventListener('click', e => {
    const pill = e.target.closest('.expert-pill');
    if (!pill) return;
    const name = pill.querySelector('.e-name')?.textContent?.trim() || 'GIS Engineer';
    openMessenger(name);
});
