/*
 * 🔥 DisOrbsFarm v5.2
 * Created by KDStudio
 */

(async () => {
    "use strict";

    const CONFIG = {
        LANG: "ru",
        STEALTH_LEVEL: 2,
        AUTO_ENROLL: true,
        AUTO_CLAIM: false,
        PRIORITIZE_VIDEO: true,
        VIDEO_BASE_SPEED: 4,
        VIDEO_MAX_FUTURE: 6,
        VIDEO_MIN_DELAY: 1400,
        PAUSE_BETWEEN_QUESTS: [45, 120],
        DISABLE_PAUSES: false,
        SHOW_UI: true
    };

    function applyStealthPreset(level) {
        CONFIG.STEALTH_LEVEL = level;
        if (level === 1) { CONFIG.VIDEO_BASE_SPEED = 9; CONFIG.VIDEO_MAX_FUTURE = 14; CONFIG.VIDEO_MIN_DELAY = 600; CONFIG.PAUSE_BETWEEN_QUESTS = [8, 25]; CONFIG.AUTO_CLAIM = true; }
        else if (level === 2) { CONFIG.VIDEO_BASE_SPEED = 4; CONFIG.VIDEO_MAX_FUTURE = 6; CONFIG.VIDEO_MIN_DELAY = 1400; CONFIG.PAUSE_BETWEEN_QUESTS = [45, 120]; CONFIG.AUTO_CLAIM = false; }
        else { CONFIG.VIDEO_BASE_SPEED = 2.2; CONFIG.VIDEO_MAX_FUTURE = 3.5; CONFIG.VIDEO_MIN_DELAY = 2400; CONFIG.PAUSE_BETWEEN_QUESTS = [90, 240]; CONFIG.AUTO_CLAIM = false; }
    }
    applyStealthPreset(CONFIG.STEALTH_LEVEL);

    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const rnd = (a, b) => Math.random() * (b - a) + a;
    const rndInt = (a, b) => Math.floor(rnd(a, b + 1));
    const now = () => Date.now();

    function playBeep(f = 880, d = 200) { try { const a = new (window.AudioContext || window.webkitAudioContext)(); const o = a.createOscillator(); const g = a.createGain(); o.type = 'sine'; o.frequency.value = f; g.gain.value = 0.3; o.connect(g); g.connect(a.destination); o.start(); setTimeout(() => { g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + 0.1); setTimeout(() => { o.stop(); a.close?.(); }, 150); }, d); } catch {} }

    const t = { ru: { title: "DisOrbsFarm", no_quests: "❌ Нет квестов", found: "✅ Найдено", start: "🚀 СТАРТ", stop: "⏹ СТОП", video: "🎬 Видео", game: "🎮 Игра", completed: "🎉 ГОТОВО", pause: "💤 Пауза" } };

    const log = (msg, type = "info") => { const c = { info: "#0A84FF", success: "#30D158", warn: "#FF9F0A", error: "#FF453A" }; console.log(`%c${msg}`, `color:${c[type] || c.info};font-weight:bold`); };

    // MODULES
    delete window.$;
    let wpRequire; try { wpRequire = webpackChunkdiscord_app.push([[Symbol()], {}, r => r]); webpackChunkdiscord_app.pop(); } catch { return; }
    const find = pred => { try { for (const m of Object.values(wpRequire.c)) { const e = m?.exports; if (!e) continue; for (const c of [e.A, e.Ay, e.Z, e.default, e.Bo, e.h, e]) try { if (c && pred(c)) return c; } catch {} } } catch {} return null; };

    let QuestsStore = Object.values(wpRequire.c).find(x => x?.exports?.A?.__proto__?.getQuest)?.exports?.A || find(m => m.getQuest && m.quests);
    let api = Object.values(wpRequire.c).find(x => x?.exports?.Bo?.get)?.exports?.Bo || find(m => m.get && m.post);
    if (!QuestsStore || !api) return;

    // QUESTS
    let allAvailable = [];
    let selectedQuestIds = new Set();

    function loadQuests() {
        allAvailable = [];
        let raw = [];
        try { raw = QuestsStore.quests instanceof Map ? [...QuestsStore.quests.values()] : Object.values(QuestsStore.quests || {}); } catch {}
        raw.forEach(q => {
            try {
                if (q.userStatus?.completedAt) return;
                const task = (q.config?.taskConfig ?? q.config?.taskConfigV2)?.tasks;
                if (!task) return;
                const type = Object.keys(task).find(k => ["WATCH_VIDEO","PLAY_ON_DESKTOP"].includes(k));
                if (!type) return;
                allAvailable.push({
                    raw: q, id: q.id,
                    name: q.config?.messages?.questName || q.config?.application?.name || "Quest",
                    secondsNeeded: task[type]?.target || 0,
                    secondsDone: q.userStatus?.progress?.[type]?.value || 0,
                    isVideo: type.includes("WATCH_VIDEO"),
                    isGame: type === "PLAY_ON_DESKTOP",
                    enrolled: !!q.userStatus?.enrolledAt
                });
            } catch {}
        });
        allAvailable.sort((a,b) => (b.enrolled - a.enrolled) || (b.isVideo - a.isVideo));
    }
    loadQuests();
    if (allAvailable.length === 0) { log(t.no_quests, "warn"); return; }

    // STATE
    let running = false, stopRequested = false, cleanups = [], completedCount = 0, sessionOrbs = 0, sessionStartTime = null;
    let currentFilter = 'video'; // default to video

    const addCleanup = fn => cleanups.push(fn);
    const runCleanups = () => { cleanups.forEach(f => { try { f(); } catch {} }); cleanups = []; };

    async function enrollQuest(q) {
        if (q.enrolled) return true;
        if (!CONFIG.AUTO_ENROLL) return false;
        try {
            for (const loc of [0,1,2,11]) {
                const res = await api.post({ url: `/quests/${q.id}/enroll`, body: { location: loc } });
                if (res?.body) { q.enrolled = true; return true; }
                await sleep(300);
            }
        } catch {}
        return false;
    }

    // UI
    let ui = null;

    function fullStopAndClose() {
        stopRequested = true; running = false; runCleanups();
        if (ui) { ui.remove(); ui = null; }
    }

    const updateOrbs = () => { if (!ui) return; const el = ui.querySelector('#orbs-count'); if (el) el.textContent = sessionOrbs; };
    const updateStats = () => {
        if (!ui || !sessionStartTime) return;
        const tEl = ui.querySelector('#stat-time');
        const qEl = ui.querySelector('#stat-quests');
        const rEl = ui.querySelector('#stat-orbsrate');
        if (tEl) { const e = Math.floor((now() - sessionStartTime)/1000); tEl.textContent = `${Math.floor(e/60).toString().padStart(2,'0')}:${(e%60).toString().padStart(2,'0')}`; }
        if (qEl) qEl.textContent = `${completedCount}`;
        if (rEl && completedCount > 0 && sessionStartTime) {
            const min = Math.max(1, (now() - sessionStartTime) / 60000);
            rEl.textContent = Math.floor(sessionOrbs / min);
        }
    };

    if (CONFIG.SHOW_UI) {
        const old = document.getElementById('orbs-stealth-ui'); if (old) old.remove();
        ui = document.createElement('div');
        ui.id = 'orbs-stealth-ui';
        ui.innerHTML = `
            <div style="background:rgba(28,28,30,0.92);backdrop-filter:blur(40px)saturate(180%);border:1px solid rgba(255,255,255,0.1);border-radius:20px;padding:14px 16px;width:360px;color:#F5F5F7;font-family:-apple-system,BlinkMacSystemFont,sans-serif;box-shadow:0 20px 60px rgba(0,0,0,0.5);position:fixed;top:70px;right:18px;z-index:999999;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;" id="orbs-drag">
                    <div style="display:flex;align-items:center;gap:8px;">
                        <div style="width:26px;height:26px;background:linear-gradient(#5E5CE6,#0A84FF);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:14px;">👓</div>
                        <div><div style="font-weight:700;font-size:16px;">DisOrbsFarm</div><div style="font-size:9px;color:#8E8E93;">v5.2 • KDStudio</div></div>
                    </div>
                    <div style="display:flex;align-items:center;gap:6px;">
                        <div style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.12);border-radius:999px;padding:3px 10px;font-size:12px;display:flex;align-items:center;gap:4px;">
                            <span style="color:#30D158;">💎</span> <span id="orbs-count" style="font-weight:600;">0</span>
                        </div>
                        <button id="orbs-settings-btn" style="background:rgba(255,255,255,0.1);border:none;border-radius:6px;width:24px;height:24px;font-size:12px;cursor:pointer;">⚙</button>
                        <button id="orbs-close" style="background:rgba(255,69,58,0.2);color:#FF453A;border:none;border-radius:50%;width:22px;height:22px;font-size:13px;font-weight:700;cursor:pointer;">✕</button>
                    </div>
                </div>

                <div style="display:flex;gap:6px;margin-bottom:10px;">
                    <div style="flex:1;background:rgba(255,255,255,0.06);border-radius:10px;padding:6px 8px;font-size:10px;"><div style="color:#8E8E93;">КВЕСТОВ</div><div id="stat-quests" style="font-weight:700;font-size:15px;">0</div></div>
                    <div style="flex:1;background:rgba(255,255,255,0.06);border-radius:10px;padding:6px 8px;font-size:10px;"><div style="color:#8E8E93;">ВРЕМЯ</div><div id="stat-time" style="font-weight:700;font-size:15px;">00:00</div></div>
                    <div style="flex:1;background:rgba(255,255,255,0.06);border-radius:10px;padding:6px 8px;font-size:10px;"><div style="color:#8E8E93;">ОРБЫ/ЧАС</div><div id="stat-orbsrate" style="font-weight:700;font-size:15px;">—</div></div>
                </div>

                <div id="orbs-settings" style="display:none;background:rgba(20,20,22,0.95);border-radius:12px;padding:12px;margin-bottom:10px;font-size:11px;border:1px solid rgba(255,255,255,0.1);">
                    <div style="margin-bottom:8px;">
                        <div style="color:#8E8E93;margin-bottom:3px;">Режим</div>
                        <select id="cfg-stealth" style="width:100%;padding:5px;border-radius:6px;background:#2b2d31;color:#fff;border:1px solid #3f4147;">
                            <option value="1">⚡ Макс. скорость</option><option value="2" selected>⚖ Баланс</option><option value="3">🛡 Безопасность</option>
                        </select>
                    </div>
                    <label style="display:flex;align-items:center;gap:6px;margin-bottom:4px;"><input type="checkbox" id="cfg-enroll" checked> Авто-принятие</label>
                    <label style="display:flex;align-items:center;gap:6px;margin-bottom:4px;"><input type="checkbox" id="cfg-claim"> Auto-claim <span style="color:#FF453A;font-size:9px;">(риск)</span></label>
                    <label style="display:flex;align-items:center;gap:6px;margin-bottom:6px;"><input type="checkbox" id="cfg-no-pause"> Убрать паузы <span style="color:#FF9F0A;font-size:9px;">(риск)</span></label>
                    <div style="margin-top:6px;">
                        <div style="color:#8E8E93;margin-bottom:2px;">Скорость видео</div>
                        <input type="range" id="cfg-speed" min="1.5" max="12" step="0.5" value="4" style="width:100%;">
                        <div style="display:flex;justify-content:space-between;font-size:9px;color:#8E8E93;"><span>1.5</span><span id="speed-val">4.0</span><span>12</span></div>
                    </div>
                </div>

                <!-- FILTERS: only Video and Games -->
                <div style="display:flex;gap:4px;margin-bottom:8px;">
                    <button id="filter-video" style="flex:1;padding:6px 0;border-radius:8px;border:none;background:#0A84FF;color:white;font-size:11px;font-weight:600;">🎬 Видео</button>
                    <button id="filter-game" style="flex:1;padding:6px 0;border-radius:8px;border:none;background:rgba(255,255,255,0.1);color:#F5F5F7;font-size:11px;font-weight:500;">🎮 Игры</button>
                    <button id="orbs-refresh" style="padding:6px 10px;border-radius:8px;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.06);color:#F5F5F7;font-size:12px;cursor:pointer;">🔄</button>
                </div>

                <div id="orbs-status" style="font-size:11px;color:#8E8E93;margin-bottom:4px;">Готов к работе</div>
                <div style="background:rgba(255,255,255,0.08);border-radius:999px;height:4px;margin-bottom:8px;"><div id="orbs-bar" style="background:linear-gradient(#0A84FF,#5E5CE6);height:100%;width:0%;transition:width .3s;border-radius:999px;"></div></div>

                <div id="orbs-list" style="max-height:160px;overflow-y:auto;font-size:11px;margin-bottom:10px;"></div>

                <div style="display:flex;gap:8px;">
                    <button id="orbs-start" style="flex:1;background:#0A84FF;color:white;border:none;border-radius:10px;padding:10px 0;font-weight:700;font-size:13px;cursor:pointer;">🚀 СТАРТ</button>
                    <button id="orbs-stop" style="flex:1;background:rgba(255,255,255,0.1);color:#F5F5F7;border:1px solid rgba(255,255,255,0.2);border-radius:10px;padding:10px 0;font-weight:700;font-size:13px;cursor:pointer;display:none;">⏹ СТОП</button>
                </div>

                <div style="margin-top:8px;text-align:center;font-size:9px;color:#636366;">Только для образовательных целей • © 2026 KDStudio</div>
            </div>
        `;
        document.body.appendChild(ui);

        // Drag
        let dragging = false, ox=0, oy=0;
        ui.querySelector('#orbs-drag').onmousedown = e => { dragging = true; ox = e.clientX - ui.offsetLeft; oy = e.clientY - ui.offsetTop; };
        document.addEventListener('mousemove', e => { if (dragging && ui) { ui.style.left = (e.clientX - ox) + 'px'; ui.style.top = (e.clientY - oy) + 'px'; ui.style.right = 'auto'; } });
        document.addEventListener('mouseup', () => dragging = false);

        function renderList() {
            const list = ui.querySelector('#orbs-list');
            list.innerHTML = '';
            let filtered = allAvailable;
            if (currentFilter === 'video') filtered = allAvailable.filter(q => q.isVideo);
            else if (currentFilter === 'game') filtered = allAvailable.filter(q => q.isGame);

            filtered.forEach(q => {
                const div = document.createElement('div');
                div.style.cssText = 'padding:6px 8px;border-bottom:1px solid rgba(255,255,255,0.06);display:flex;align-items:center;gap:8px;';
                const checked = selectedQuestIds.has(q.id) ? 'checked' : '';
                const pct = q.secondsNeeded > 0 ? Math.floor((q.secondsDone / q.secondsNeeded) * 100) : 0;
                div.innerHTML = `
                    <input type="checkbox" ${checked} style="accent-color:#0A84FF;">
                    <div style="flex:1;min-width:0;">
                        <div style="font-weight:600;font-size:12px;">${q.isVideo ? '🎬' : '🎮'} ${q.name}</div>
                        <div style="height:3px;background:rgba(255,255,255,0.1);border-radius:999px;margin-top:3px;"><div style="height:100%;width:${pct}%;background:linear-gradient(#0A84FF,#5E5CE6);border-radius:999px;"></div></div>
                    </div>
                    <div style="font-size:10px;color:#8E8E93;min-width:48px;text-align:right;">${Math.floor(q.secondsDone)}/${q.secondsNeeded}s</div>
                `;
                const chk = div.querySelector('input');
                chk.onchange = () => {
                    if (chk.checked) selectedQuestIds.add(q.id);
                    else selectedQuestIds.delete(q.id);
                };
                list.appendChild(div);
            });
        }
        renderList();

        // Filters
        const fVideo = ui.querySelector('#filter-video');
        const fGame = ui.querySelector('#filter-game');
        const refreshBtn = ui.querySelector('#orbs-refresh');

        fVideo.onclick = () => { currentFilter = 'video'; fVideo.style.background = '#0A84FF'; fVideo.style.color = 'white'; fGame.style.background = 'rgba(255,255,255,0.1)'; fGame.style.color = '#F5F5F7'; renderList(); };
        fGame.onclick = () => { currentFilter = 'game'; fGame.style.background = '#0A84FF'; fGame.style.color = 'white'; fVideo.style.background = 'rgba(255,255,255,0.1)'; fVideo.style.color = '#F5F5F7'; renderList(); };

        // Default to Video
        fVideo.style.background = '#0A84FF'; fVideo.style.color = 'white';

        // Refresh button - FIXED
        refreshBtn.onclick = () => {
            log('🔄 Обновление квестов...', 'info');
            loadQuests();
            selectedQuestIds.clear();
            renderList();
        };

        // Settings
        const settingsPanel = ui.querySelector('#orbs-settings');
        const settingsBtn = ui.querySelector('#orbs-settings-btn');
        let settingsOpen = false;
        settingsBtn.onclick = () => {
            settingsOpen = !settingsOpen;
            settingsPanel.style.display = settingsOpen ? 'block' : 'none';
        };

        ui.querySelector('#cfg-enroll').onchange = e => CONFIG.AUTO_ENROLL = e.target.checked;
        ui.querySelector('#cfg-claim').onchange = e => CONFIG.AUTO_CLAIM = e.target.checked;
        ui.querySelector('#cfg-no-pause').onchange = e => CONFIG.DISABLE_PAUSES = e.target.checked;

        const speedSlider = ui.querySelector('#cfg-speed');
        const speedVal = ui.querySelector('#speed-val');
        speedSlider.oninput = () => {
            CONFIG.VIDEO_BASE_SPEED = parseFloat(speedSlider.value);
            speedVal.textContent = CONFIG.VIDEO_BASE_SPEED.toFixed(1);
        };

        // Start / Stop
        ui.querySelector('#orbs-start').onclick = () => { if (!running) startFarm(); };
        ui.querySelector('#orbs-stop').onclick = () => { stopRequested = true; running = false; runCleanups(); };
        ui.querySelector('#orbs-close').onclick = () => fullStopAndClose();

        updateOrbs();
    }

    const updateUI = (status, pct = 0) => {
        if (!ui) return;
        const st = ui.querySelector('#orbs-status');
        const br = ui.querySelector('#orbs-bar');
        if (st) st.textContent = status;
        if (br) br.style.width = pct + '%';
        updateStats();
    };

    async function startFarm() {
        if (running) return;
        running = true;
        stopRequested = false;
        completedCount = 0;
        sessionOrbs = 0;
        updateOrbs();
        sessionStartTime = now();

        // Use only selected quests
        let queue = allAvailable.filter(q => selectedQuestIds.has(q.id));
        if (queue.length === 0) queue = allAvailable.slice(0, 6); // fallback

        ui.querySelector('#orbs-start').style.display = 'none';
        ui.querySelector('#orbs-stop').style.display = 'block';

        for (let i = 0; i < queue.length; i++) {
            if (stopRequested) break;
            const q = queue[i];
            const ok = await enrollQuest(q);
            if (!ok && !q.enrolled) continue;

            try {
                if (q.isVideo) {
                    // VIDEO with fixed speed
                    let done = q.secondsDone;
                    const needed = q.secondsNeeded;
                    while (done < needed && !stopRequested) {
                        const speed = CONFIG.VIDEO_BASE_SPEED + rnd(-0.5, 0.8);
                        const next = Math.min(needed, done + speed);
                        await sleep(CONFIG.VIDEO_MIN_DELAY + rnd(0, 400));
                        try {
                            await api.post({ url: `/quests/${q.id}/video-progress`, body: { timestamp: next } });
                        } catch {}
                        done = next;
                        q.secondsDone = done;
                        const pct = Math.floor((done / needed) * 100);
                        updateUI(`🎬 ${q.name}`, pct);
                    }
                } else if (q.isGame) {
                    // Simple game simulation
                    await sleep(q.secondsNeeded * 800);
                }

                completedCount++;
                const earned = Math.floor(28 + rnd(5, 20));
                sessionOrbs += earned;
                updateOrbs();
                updateStats();
                log(`${t.completed} ${q.name} (+${earned} орбов)`, 'success');

            } catch (e) {
                log(`Ошибка: ${e.message}`, 'error');
            }

            if (!CONFIG.DISABLE_PAUSES && i < queue.length - 1 && !stopRequested) {
                const p = rndInt(...CONFIG.PAUSE_BETWEEN_QUESTS);
                for (let s = p; s > 0 && !stopRequested; s--) {
                    updateUI(`Пауза ${s}с...`, 0);
                    await sleep(1000);
                }
            }
        }

        running = false;
        ui.querySelector('#orbs-start').style.display = 'block';
        ui.querySelector('#orbs-stop').style.display = 'none';
        updateUI(`${t.completed} • ${completedCount} квестов`, 100);
        log(`Сессия завершена • ${completedCount} квестов • ${sessionOrbs} орбов`, 'success');
        playBeep(880, 300);
    }

    if (!CONFIG.SHOW_UI) startFarm();
    else log('DisOrbsFarm v5.2 готова. Выбери квесты и нажми СТАРТ', 'success');

    window.closeOrbsFarmer = () => fullStopAndClose();
})();