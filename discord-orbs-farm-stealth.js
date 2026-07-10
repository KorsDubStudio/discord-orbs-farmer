/*
 * 🔥 DisOrbsFarm v6.0
 * Полная переработка с нуля
 * Самая стабильная и аккуратная версия
 */

(async () => {
    "use strict";

    // ==================== CONFIG ====================
    const CONFIG = {
        STEALTH_LEVEL: 2,
        AUTO_ENROLL: true,
        AUTO_CLAIM: false,
        VIDEO_SPEED: 4.0,
        PAUSE_BETWEEN_QUESTS: [45, 120],
        DISABLE_PAUSES: false,
        NOTIFICATIONS: true
    };

    function applyPreset(level) {
        CONFIG.STEALTH_LEVEL = level;
        if (level === 1) {
            CONFIG.VIDEO_SPEED = 8.5;
            CONFIG.PAUSE_BETWEEN_QUESTS = [8, 18];
        } else if (level === 2) {
            CONFIG.VIDEO_SPEED = 4.0;
            CONFIG.PAUSE_BETWEEN_QUESTS = [45, 120];
        } else {
            CONFIG.VIDEO_SPEED = 2.3;
            CONFIG.PAUSE_BETWEEN_QUESTS = [90, 240];
        }
    }
    applyPreset(CONFIG.STEALTH_LEVEL);

    // ==================== UTILS ====================
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const rand = (min, max) => Math.random() * (max - min) + min;
    const now = () => Date.now();

    function playSound(freq = 880, duration = 180) {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.value = freq;
            gain.gain.value = 0.3;
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            setTimeout(() => {
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
                setTimeout(() => osc.stop(), 60);
            }, duration);
        } catch {}
    }

    function notify(title, body) {
        if (!CONFIG.NOTIFICATIONS) return;
        try {
            if (Notification.permission === 'granted') {
                new Notification(title, { body });
            } else if (Notification.permission !== 'denied') {
                Notification.requestPermission().then(p => p === 'granted' && new Notification(title, { body }));
            }
        } catch {}
        playSound(720, 280);
    }

    const log = (msg, type = 'info') => {
        const color = { info: '#0A84FF', success: '#30D158', warn: '#FF9F0A', error: '#FF453A' }[type] || '#0A84FF';
        console.log(`%c[DisOrbsFarm] ${msg}`, `color:${color}; font-weight:600`);
    };

    // ==================== DISCORD MODULES ====================
    delete window.$;
    let wpRequire;
    try {
        wpRequire = webpackChunkdiscord_app.push([[Symbol()], {}, r => r]);
        webpackChunkdiscord_app.pop();
    } catch {
        log('Не удалось загрузить модули Discord', 'error');
        return;
    }

    const getModule = (check) => {
        for (const mod of Object.values(wpRequire.c)) {
            const exp = mod?.exports;
            if (!exp) continue;
            for (const val of [exp.A, exp.Ay, exp.Z, exp.default, exp]) {
                try { if (val && check(val)) return val; } catch {}
            }
        }
        return null;
    };

    let QuestsStore = getModule(m => m.getQuest && m.quests) || 
                      Object.values(wpRequire.c).find(x => x?.exports?.A?.__proto__?.getQuest)?.exports?.A;
    let RestAPI = getModule(m => m.get && m.post) || 
                  Object.values(wpRequire.c).find(x => x?.exports?.Bo?.get)?.exports?.Bo;

    if (!QuestsStore || !RestAPI) {
        log('Не найдены необходимые модули', 'error');
        return;
    }

    // ==================== QUESTS ====================
    let quests = [];
    let selected = new Set();

    function refreshQuests() {
        quests = [];
        let raw = [];
        try {
            raw = QuestsStore.quests instanceof Map ? [...QuestsStore.quests.values()] : Object.values(QuestsStore.quests || {});
        } catch {}

        raw.forEach(q => {
            try {
                if (q.userStatus?.completedAt) return;
                const cfg = q.config?.taskConfig ?? q.config?.taskConfigV2;
                if (!cfg?.tasks) return;

                const type = Object.keys(cfg.tasks).find(t => t.includes('VIDEO') || t === 'PLAY_ON_DESKTOP');
                if (!type) return;

                quests.push({
                    id: q.id,
                    name: q.config?.messages?.questName || q.config?.application?.name || 'Quest',
                    needed: cfg.tasks[type].target || 0,
                    done: q.userStatus?.progress?.[type]?.value || 0,
                    isVideo: type.includes('VIDEO'),
                    isGame: type === 'PLAY_ON_DESKTOP',
                    enrolled: !!q.userStatus?.enrolledAt
                });
            } catch {}
        });

        quests.sort((a, b) => (b.enrolled - a.enrolled) || (b.isVideo - a.isVideo));
    }

    refreshQuests();
    if (quests.length === 0) {
        log('Нет доступных квестов', 'warn');
        return;
    }

    // ==================== CORE FUNCTIONS ====================
    async function enroll(q) {
        if (q.enrolled) return true;
        if (!CONFIG.AUTO_ENROLL) return false;

        const locations = [0, 1, 2, 11, 13];
        for (const loc of locations) {
            try {
                const res = await RestAPI.post({ url: `/quests/${q.id}/enroll`, body: { location: loc } });
                if (res?.body) {
                    q.enrolled = true;
                    await sleep(1100);
                    return true;
                }
            } catch {}
            await sleep(300);
        }
        return false;
    }

    async function claim(q) {
        if (!CONFIG.AUTO_CLAIM) return;
        try {
            await RestAPI.post({ url: `/quests/${q.id}/claim-reward`, body: { location: 0 } });
        } catch {}
    }

    async function runVideo(q) {
        let done = q.done;
        const needed = q.needed;

        while (done < needed && !stopRequested) {
            const speed = CONFIG.VIDEO_SPEED + rand(-0.4, 0.7);
            await sleep(CONFIG.VIDEO_MIN_DELAY + rand(0, 350));

            try {
                await RestAPI.post({ url: `/quests/${q.id}/video-progress`, body: { timestamp: done + speed } });
                done += speed;
                q.done = done;
                updateProgress(q.id, Math.floor((done / needed) * 100));
            } catch (e) {
                if (String(e).includes('429') || String(e).includes('captcha')) {
                    log('Защита Discord. Пауза 6-10 минут...', 'warn');
                    await sleep(rand(360000, 600000));
                    break;
                }
            }
        }

        if (done >= needed) await claim(q);
    }

    async function runGame(q) {
        const time = Math.min(q.needed * 820, 200000);
        await sleep(time);
        await claim(q);
    }

    // ==================== UI ====================
    let panel = null;
    let mini = null;
    let stopRequested = false;
    let running = false;
    let currentFilter = 'video';

    function createUI() {
        if (panel) panel.remove();

        panel = document.createElement('div');
        panel.id = 'disorbsfarm';
        panel.style.cssText = 'position:fixed;top:70px;right:18px;z-index:999999;';

        panel.innerHTML = `
            <div style="background:rgba(28,28,30,0.94);backdrop-filter:blur(42px)saturate(180%);border:1px solid rgba(255,255,255,0.1);border-radius:20px;padding:16px 18px;width:360px;color:#F5F5F7;font-family:-apple-system,BlinkMacSystemFont,sans-serif;box-shadow:0 25px 70px rgba(0,0,0,0.55);">
                
                <!-- Header -->
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;cursor:move;" id="df-drag">
                    <div style="display:flex;align-items:center;gap:10px;">
                        <div style="width:28px;height:28px;background:linear-gradient(135deg,#5E5CE6,#0A84FF);border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:15px;box-shadow:0 3px 10px rgba(10,132,255,0.4);">👓</div>
                        <div>
                            <div style="font-weight:700;font-size:17px;letter-spacing:-0.3px;">DisOrbsFarm</div>
                            <div style="font-size:10px;color:#8E8E93;margin-top:-1px;">v6.0 • Stable</div>
                        </div>
                    </div>
                    <div style="display:flex;gap:5px;">
                        <button id="df-min" style="background:rgba(255,255,255,0.1);border:none;border-radius:6px;width:24px;height:24px;font-size:14px;color:#8E8E93;cursor:pointer;">−</button>
                        <button id="df-set" style="background:rgba(255,255,255,0.1);border:none;border-radius:6px;width:24px;height:24px;font-size:13px;cursor:pointer;">⚙</button>
                        <button id="df-close" style="background:rgba(255,69,58,0.18);color:#FF453A;border:none;border-radius:50%;width:22px;height:22px;font-size:13px;font-weight:700;cursor:pointer;">✕</button>
                    </div>
                </div>

                <!-- Stats -->
                <div style="display:flex;gap:6px;margin-bottom:10px;">
                    <div style="flex:1;background:rgba(255,255,255,0.06);border-radius:10px;padding:7px 9px;font-size:10px;">
                        <div style="color:#8E8E93;">КВЕСТОВ</div>
                        <div id="df-stat-quests" style="font-weight:700;font-size:15px;">0</div>
                    </div>
                    <div style="flex:1;background:rgba(255,255,255,0.06);border-radius:10px;padding:7px 9px;font-size:10px;">
                        <div style="color:#8E8E93;">ВРЕМЯ</div>
                        <div id="df-stat-time" style="font-weight:700;font-size:15px;">00:00</div>
                    </div>
                </div>

                <!-- Settings -->
                <div id="df-settings" style="display:none;background:rgba(20,20,22,0.96);border-radius:12px;padding:12px;margin-bottom:10px;font-size:12px;border:1px solid rgba(255,255,255,0.1);">
                    <div style="margin-bottom:8px;">
                        <div style="color:#8E8E93;margin-bottom:3px;font-size:11px;">Режим работы</div>
                        <select id="df-mode" style="width:100%;padding:6px 8px;border-radius:7px;background:#2b2d31;color:#fff;border:1px solid #3f4147;">
                            <option value="1">⚡ Максимальная скорость</option>
                            <option value="2" selected>⚖ Баланс (рекомендуется)</option>
                            <option value="3">🛡 Максимальная безопасность</option>
                        </select>
                    </div>

                    <div style="display:grid;grid-template-columns:1fr;gap:6px;margin-bottom:8px;">
                        <label style="display:flex;align-items:center;gap:6px;"><input type="checkbox" id="df-enroll" checked> Автопринятие квестов</label>
                        <label style="display:flex;align-items:center;gap:6px;"><input type="checkbox" id="df-claim"> Автоклейм <span style="color:#FF453A;font-size:10px;">(риск)</span></label>
                        <label style="display:flex;align-items:center;gap:6px;"><input type="checkbox" id="df-nopause"> Убрать паузы между квестами <span style="color:#FF9F0A;font-size:10px;">(риск)</span></label>
                        <label style="display:flex;align-items:center;gap:6px;"><input type="checkbox" id="df-notify" checked> Уведомления при завершении</label>
                    </div>

                    <div>
                        <div style="color:#8E8E93;margin-bottom:3px;font-size:11px;">Скорость видео</div>
                        <input type="range" id="df-speed" min="1.5" max="12" step="0.5" value="4" style="width:100%;">
                        <div style="display:flex;justify-content:space-between;font-size:9.5px;color:#8E8E93;margin-top:2px;">
                            <span>1.5x</span><span id="df-speed-val">4.0x</span><span>12x</span>
                        </div>
                    </div>
                </div>

                <!-- Filters -->
                <div style="display:flex;gap:5px;margin-bottom:8px;">
                    <button id="df-video" style="flex:1;padding:6px 0;border-radius:8px;border:none;background:#0A84FF;color:white;font-size:11px;font-weight:600;">🎬 Видео</button>
                    <button id="df-game" style="flex:1;padding:6px 0;border-radius:8px;border:none;background:rgba(255,255,255,0.1);color:#F5F5F7;font-size:11px;font-weight:500;">🎮 Игры</button>
                    <button id="df-refresh" style="padding:6px 10px;border-radius:8px;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.06);color:#F5F5F7;font-size:13px;cursor:pointer;">🔄</button>
                </div>

                <div id="df-status" style="font-size:11px;color:#8E8E93;margin-bottom:4px;">Готов к работе</div>
                <div style="background:rgba(255,255,255,0.08);border-radius:999px;height:4px;margin-bottom:8px;"><div id="df-bar" style="background:linear-gradient(#0A84FF,#5E5CE6);height:100%;width:0%;transition:width .35s;border-radius:999px;"></div></div>

                <div id="df-list" style="max-height:160px;overflow-y:auto;font-size:12px;margin-bottom:10px;"></div>

                <div style="display:flex;gap:8px;">
                    <button id="df-start" style="flex:1;background:#0A84FF;color:white;border:none;border-radius:10px;padding:11px 0;font-weight:700;font-size:14px;cursor:pointer;">🚀 СТАРТ</button>
                    <button id="df-stop" style="flex:1;background:rgba(255,255,255,0.1);color:#F5F5F7;border:1px solid rgba(255,255,255,0.2);border-radius:10px;padding:11px 0;font-weight:700;font-size:14px;cursor:pointer;display:none;">⏹ СТОП</button>
                </div>

                <div style="margin-top:10px;text-align:center;font-size:9px;color:#636366;">Только для образовательных целей • © 2026 KDStudio</div>
            </div>
        `;

        document.body.appendChild(panel);

        // Drag
        let dragging = false, ox = 0, oy = 0;
        const drag = panel.querySelector('#df-drag');
        drag.onmousedown = e => {
            dragging = true;
            const r = panel.getBoundingClientRect();
            ox = e.clientX - r.left;
            oy = e.clientY - r.top;
            panel.style.right = 'auto';
            panel.style.left = r.left + 'px';
            panel.style.top = r.top + 'px';
        };
        document.addEventListener('mousemove', e => {
            if (dragging) {
                panel.style.left = (e.clientX - ox) + 'px';
                panel.style.top = (e.clientY - oy) + 'px';
            }
        });
        document.addEventListener('mouseup', () => dragging = false);

        setupUI();
    }

    function setupUI() {
        const list = panel.querySelector('#df-list');
        const fVideo = panel.querySelector('#df-video');
        const fGame = panel.querySelector('#df-game');
        const refresh = panel.querySelector('#df-refresh');
        const settings = panel.querySelector('#df-settings');
        const setBtn = panel.querySelector('#df-set');

        function render() {
            list.innerHTML = '';
            let filtered = quests;
            if (currentFilter === 'video') filtered = quests.filter(q => q.isVideo);
            else if (currentFilter === 'game') filtered = quests.filter(q => q.isGame);

            filtered.forEach(q => {
                const div = document.createElement('div');
                div.style.cssText = 'padding:6px 8px;border-bottom:1px solid rgba(255,255,255,0.06);display:flex;align-items:center;gap:8px;';
                const checked = selected.has(q.id) ? 'checked' : '';
                const pct = q.needed > 0 ? Math.floor((q.done / q.needed) * 100) : 0;

                div.innerHTML = `
                    <input type="checkbox" ${checked} style="accent-color:#0A84FF;width:15px;height:15px;">
                    <div style="flex:1;min-width:0;">
                        <div style="font-weight:600;font-size:12px;">${q.isVideo ? '🎬' : '🎮'} ${q.name}</div>
                        <div style="height:3px;background:rgba(255,255,255,0.1);border-radius:999px;margin-top:3px;"><div style="height:100%;width:${pct}%;background:linear-gradient(#0A84FF,#5E5CE6);border-radius:999px;"></div></div>
                    </div>
                    <div style="font-size:10px;color:#8E8E93;min-width:44px;text-align:right;">${Math.floor(q.done)}/${q.needed}s</div>
                `;

                const chk = div.querySelector('input');
                chk.onchange = () => chk.checked ? selected.add(q.id) : selected.delete(q.id);
                list.appendChild(div);
            });
        }

        render();

        fVideo.onclick = () => { currentFilter = 'video'; fVideo.style.background = '#0A84FF'; fVideo.style.color = 'white'; fGame.style.background = 'rgba(255,255,255,0.1)'; fGame.style.color = '#F5F5F7'; render(); };
        fGame.onclick = () => { currentFilter = 'game'; fGame.style.background = '#0A84FF'; fGame.style.color = 'white'; fVideo.style.background = 'rgba(255,255,255,0.1)'; fVideo.style.color = '#F5F5F7'; render(); };
        fVideo.style.background = '#0A84FF'; fVideo.style.color = 'white';

        refresh.onclick = () => { refreshQuests(); selected.clear(); render(); log('Квесты обновлены', 'info'); };

        let open = false;
        setBtn.onclick = () => { open = !open; settings.style.display = open ? 'block' : 'none'; };

        // Settings bindings
        panel.querySelector('#df-mode').onchange = e => applyPreset(parseInt(e.target.value));
        panel.querySelector('#df-enroll').onchange = e => CONFIG.AUTO_ENROLL = e.target.checked;
        panel.querySelector('#df-claim').onchange = e => CONFIG.AUTO_CLAIM = e.target.checked;
        panel.querySelector('#df-nopause').onchange = e => CONFIG.DISABLE_PAUSES = e.target.checked;
        panel.querySelector('#df-notify').onchange = e => CONFIG.NOTIFICATIONS = e.target.checked;

        const speed = panel.querySelector('#df-speed');
        const speedVal = panel.querySelector('#df-speed-val');
        speed.oninput = () => { CONFIG.VIDEO_SPEED = parseFloat(speed.value); speedVal.textContent = CONFIG.VIDEO_SPEED.toFixed(1) + 'x'; };

        panel.querySelector('#df-start').onclick = start;
        panel.querySelector('#df-stop').onclick = () => { stopRequested = true; running = false; };
        panel.querySelector('#df-close').onclick = () => panel.remove();
        panel.querySelector('#df-min').onclick = minimize;
    }

    function minimize() {
        if (!panel) return;
        panel.style.display = 'none';
        if (!mini) {
            mini = document.createElement('div');
            mini.style.cssText = 'position:fixed;top:22px;right:22px;background:rgba(28,28,30,0.95);backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,0.15);border-radius:999px;padding:5px 12px;display:flex;align-items:center;gap:8px;z-index:999999;';
            mini.innerHTML = `<div style="display:flex;align-items:center;gap:6px;"><div style="width:18px;height:18px;background:linear-gradient(#5E5CE6,#0A84FF);border-radius:5px;display:flex;align-items:center;justify-content:center;font-size:10px;">👓</div><div style="font-weight:600;font-size:12px;">DisOrbsFarm</div></div><button style="background:#0A84FF;color:white;border:none;border-radius:999px;padding:2px 10px;font-size:10px;font-weight:600;cursor:pointer;">Развернуть</button>`;
            document.body.appendChild(mini);
            mini.querySelector('button').onclick = () => { mini.remove(); mini = null; panel.style.display = 'block'; };
        }
    }

    function updateProgress(id, pct) {
        const el = panel?.querySelector(`#df-list > div`);
        // simple update - можно улучшить при необходимости
    }

    async function start() {
        if (running) return;
        running = true;
        stopRequested = false;

        let queue = quests.filter(q => selected.has(q.id));
        if (queue.length === 0) queue = quests.slice(0, 5);

        panel.querySelector('#df-start').style.display = 'none';
        panel.querySelector('#df-stop').style.display = 'block';

        for (let i = 0; i < queue.length; i++) {
            if (stopRequested) break;
            const q = queue[i];

            const ok = await enroll(q);
            if (!ok && !q.enrolled) continue;

            try {
                if (q.isVideo) await runVideo(q);
                else if (q.isGame) await runGame(q);
            } catch (e) {
                log(`Ошибка: ${e.message}`, 'error');
            }

            if (!CONFIG.DISABLE_PAUSES && i < queue.length - 1 && !stopRequested) {
                const p = rand(...CONFIG.PAUSE_BETWEEN_QUESTS);
                for (let s = p; s > 0 && !stopRequested; s--) {
                    panel.querySelector('#df-status').textContent = `Пауза ${s}с...`;
                    await sleep(1000);
                }
            }
        }

        running = false;
        panel.querySelector('#df-start').style.display = 'block';
        panel.querySelector('#df-stop').style.display = 'none';
        panel.querySelector('#df-status').textContent = `Завершено • ${queue.length} квестов`;

        notify('DisOrbsFarm', `Завершено ${queue.length} квестов`);
        log('Сессия завершена', 'success');
    }

    // Start UI
    if (CONFIG.SHOW_UI) {
        createUI();
        log('DisOrbsFarm v6.0 готов', 'success');
    }

    window.closeOrbsFarmer = () => { if (panel) panel.remove(); if (mini) mini.remove(); };
})();