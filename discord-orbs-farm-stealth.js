/*
 * 🔥 DisOrbsFarm v5.3
 * Created by KDStudio
 * Функции: выбор квестов, минимизация, оценка орбов, уведомления (вкл/выкл), мега-риск режим
 */

(async () => {
    "use strict";

    const CONFIG = {
        LANG: "ru",
        STEALTH_LEVEL: 2,
        AUTO_ENROLL: true,
        AUTO_CLAIM: false,
        VIDEO_BASE_SPEED: 4,
        VIDEO_MAX_FUTURE: 6,
        VIDEO_MIN_DELAY: 1400,
        PAUSE_BETWEEN_QUESTS: [45, 120],
        DISABLE_PAUSES: false,
        NOTIFICATIONS_ENABLED: true, // v5.3
        EXTREME_MODE: false,         // Мега-риск
        SHOW_UI: true
    };

    function applyStealthPreset(level) {
        CONFIG.STEALTH_LEVEL = level;
        if (level === 1) {
            CONFIG.VIDEO_BASE_SPEED = 9; CONFIG.VIDEO_MAX_FUTURE = 14; CONFIG.VIDEO_MIN_DELAY = 500;
            CONFIG.PAUSE_BETWEEN_QUESTS = [5, 15];
        } else if (level === 2) {
            CONFIG.VIDEO_BASE_SPEED = 4; CONFIG.VIDEO_MAX_FUTURE = 6; CONFIG.VIDEO_MIN_DELAY = 1400;
            CONFIG.PAUSE_BETWEEN_QUESTS = [45, 120];
        } else {
            CONFIG.VIDEO_BASE_SPEED = 2; CONFIG.VIDEO_MAX_FUTURE = 3; CONFIG.VIDEO_MIN_DELAY = 2200;
            CONFIG.PAUSE_BETWEEN_QUESTS = [90, 240];
        }
    }
    applyStealthPreset(CONFIG.STEALTH_LEVEL);

    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const rnd = (a, b) => Math.random() * (b - a) + a;
    const now = () => Date.now();

    function playBeep(f = 880, d = 200) {
        try {
            const a = new (window.AudioContext || window.webkitAudioContext)();
            const o = a.createOscillator(); const g = a.createGain();
            o.frequency.value = f; g.gain.value = 0.4; o.connect(g); g.connect(a.destination); o.start();
            setTimeout(() => { g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + 0.1); setTimeout(() => o.stop(), 100); }, d);
        } catch {}
    }

    function showNotification(title, body) {
        if (!CONFIG.NOTIFICATIONS_ENABLED) return;
        try {
            if (Notification.permission === "granted") {
                new Notification(title, { body, icon: "https://discord.com/assets/5c6a5f2e5e5e5e5e5e5e5e5e5e5e5e5e.png" });
            } else if (Notification.permission !== "denied") {
                Notification.requestPermission().then(p => { if (p === "granted") new Notification(title, { body }); });
            }
        } catch {}
        playBeep(660, 400);
    }

    const t = { ru: { title: "DisOrbsFarm", completed: "Сессия завершена" } };

    const log = (msg, type = "info") => { const c = { info: "#0A84FF", success: "#30D158", warn: "#FF9F0A", error: "#FF453A" }; console.log(`%c${msg}`, `color:${c[type]||c.info};font-weight:bold`); };

    // MODULES
    delete window.$;
    let wpRequire; try { wpRequire = webpackChunkdiscord_app.push([[Symbol()], {}, r => r]); webpackChunkdiscord_app.pop(); } catch { return; }
    const find = p => { try { for (const m of Object.values(wpRequire.c)) { const e = m?.exports; if (!e) continue; for (const c of [e.A, e.Ay, e.Z, e.default, e.Bo, e.h, e]) if (c && p(c)) return c; } } catch {} return null; };

    let QuestsStore = Object.values(wpRequire.c).find(x => x?.exports?.A?.__proto__?.getQuest)?.exports?.A || find(m => m.getQuest && m.quests);
    let api = Object.values(wpRequire.c).find(x => x?.exports?.Bo?.get)?.exports?.Bo || find(m => m.get && m.post);
    if (!QuestsStore || !api) return;

    // STATE
    let allAvailable = [];
    let selectedQuestIds = new Set();
    let running = false, stopRequested = false, cleanups = [], completedCount = 0, sessionOrbs = 0, sessionStartTime = null;
    let currentFilter = "video";
    let isMinimized = false;

    function loadQuests() {
        allAvailable = [];
        let raw = [];
        try { raw = QuestsStore.quests instanceof Map ? [...QuestsStore.quests.values()] : Object.values(QuestsStore.quests || {}); } catch {}
        raw.forEach(q => {
            try {
                if (q.userStatus?.completedAt) return;
                const tc = q.config?.taskConfig ?? q.config?.taskConfigV2;
                const task = tc?.tasks;
                if (!task) return;
                const type = Object.keys(task).find(k => k.includes("VIDEO") || k === "PLAY_ON_DESKTOP");
                if (!type) return;
                const needed = task[type].target || 0;
                allAvailable.push({
                    raw: q, id: q.id, name: q.config?.messages?.questName || q.config?.application?.name || "Quest",
                    secondsNeeded: needed, secondsDone: q.userStatus?.progress?.[type]?.value || 0,
                    isVideo: type.includes("VIDEO"), isGame: type === "PLAY_ON_DESKTOP", enrolled: !!q.userStatus?.enrolledAt,
                    estimatedOrbs: Math.max(15, Math.floor(needed / 18)) // простая оценка
                });
            } catch {}
        });
        allAvailable.sort((a,b) => (b.enrolled - a.enrolled) || (b.isVideo - a.isVideo));
    }
    loadQuests();
    if (!allAvailable.length) return;

    const addCleanup = fn => cleanups.push(fn);
    const runCleanups = () => { cleanups.forEach(f => { try{f()}catch{} }); cleanups = []; };

    async function enrollQuest(q) {
        if (q.enrolled) return true;
        if (!CONFIG.AUTO_ENROLL) return false;
        for (const loc of [0,1,2,11]) {
            try { const r = await api.post({url: `/quests/${q.id}/enroll`, body:{location:loc}}); if (r?.body) { q.enrolled = true; return true; } } catch {}
            await sleep(250);
        }
        return false;
    }

    // UI
    let ui = null, miniUi = null;

    function createMainUI() {
        if (ui) ui.remove();
        ui = document.createElement("div");
        ui.id = "orbs-stealth-ui";
        ui.innerHTML = `
            <div style="background:rgba(28,28,30,0.93);backdrop-filter:blur(40px)saturate(180%);border:1px solid rgba(255,255,255,0.1);border-radius:18px;padding:14px 16px;width:355px;color:#F5F5F7;font-family:-apple-system,BlinkMacSystemFont,sans-serif;box-shadow:0 20px 60px rgba(0,0,0,0.5);">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;" id="orbs-drag">
                    <div style="display:flex;align-items:center;gap:8px;">
                        <div style="width:24px;height:24px;background:linear-gradient(#5E5CE6,#0A84FF);border-radius:7px;display:flex;align-items:center;justify-content:center;font-size:13px;">👓</div>
                        <div><div style="font-weight:700;font-size:15px;">DisOrbsFarm</div><div style="font-size:9px;color:#8E8E93;">v5.3 • KDStudio</div></div>
                    </div>
                    <div style="display:flex;gap:4px;align-items:center;">
                        <div style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.12);border-radius:999px;padding:2px 9px;font-size:11px;display:flex;align-items:center;gap:3px;">
                            <span style="color:#30D158;">💎</span><span id="orbs-count" style="font-weight:600;">0</span>
                        </div>
                        <button id="orbs-minimize" style="background:rgba(255,255,255,0.1);border:none;border-radius:6px;width:22px;height:22px;font-size:13px;cursor:pointer;color:#8E8E93;">−</button>
                        <button id="orbs-settings-btn" style="background:rgba(255,255,255,0.1);border:none;border-radius:6px;width:22px;height:22px;font-size:12px;cursor:pointer;">⚙</button>
                        <button id="orbs-close" style="background:rgba(255,69,58,0.2);color:#FF453A;border:none;border-radius:50%;width:20px;height:20px;font-size:12px;font-weight:700;cursor:pointer;">✕</button>
                    </div>
                </div>

                <div style="display:flex;gap:5px;margin-bottom:8px;">
                    <div style="flex:1;background:rgba(255,255,255,0.06);border-radius:9px;padding:5px 7px;font-size:10px;"><div style="color:#8E8E93;">КВЕСТОВ</div><div id="stat-quests" style="font-weight:700;font-size:14px;">0</div></div>
                    <div style="flex:1;background:rgba(255,255,255,0.06);border-radius:9px;padding:5px 7px;font-size:10px;"><div style="color:#8E8E93;">ВРЕМЯ</div><div id="stat-time" style="font-weight:700;font-size:14px;">00:00</div></div>
                    <div style="flex:1;background:rgba(255,255,255,0.06);border-radius:9px;padding:5px 7px;font-size:10px;"><div style="color:#8E8E93;">ОРБЫ/ЧАС</div><div id="stat-orbsrate" style="font-weight:700;font-size:14px;">—</div></div>
                </div>

                <div id="orbs-settings" style="display:none;background:rgba(20,20,22,0.95);border-radius:10px;padding:10px;margin-bottom:8px;font-size:11px;border:1px solid rgba(255,255,255,0.1);">
                    <div style="margin-bottom:6px;"><div style="color:#8E8E93;margin-bottom:2px;">Режим</div>
                        <select id="cfg-stealth" style="width:100%;padding:4px;border-radius:5px;background:#2b2d31;color:#fff;border:1px solid #3f4147;">
                            <option value="1">⚡ Макс. скорость</option><option value="2" selected>⚖ Баланс</option><option value="3">🛡 Безопасность</option>
                        </select>
                    </div>
                    <label style="display:flex;align-items:center;gap:5px;margin:3px 0;"><input type="checkbox" id="cfg-enroll" checked> Авто-принятие</label>
                    <label style="display:flex;align-items:center;gap:5px;margin:3px 0;"><input type="checkbox" id="cfg-claim"> Auto-claim <span style="color:#FF453A;font-size:9px;">(риск)</span></label>
                    <label style="display:flex;align-items:center;gap:5px;margin:3px 0;"><input type="checkbox" id="cfg-no-pause"> Убрать паузы <span style="color:#FF9F0A;font-size:9px;">(риск)</span></label>
                    <label style="display:flex;align-items:center;gap:5px;margin:3px 0;"><input type="checkbox" id="cfg-notifications" checked> Уведомления при завершении</label>
                    <div style="margin-top:6px;"><div style="color:#8E8E93;margin-bottom:2px;">Скорость видео</div>
                        <input type="range" id="cfg-speed" min="1.5" max="12" step="0.5" value="4" style="width:100%;"><div style="font-size:9px;color:#8E8E93;display:flex;justify-content:space-between;"><span>1.5</span><span id="speed-val">4.0</span><span>12</span></div>
                    </div>
                    <div style="margin-top:8px;border-top:1px solid rgba(255,255,255,0.1);padding-top:6px;">
                        <label style="display:flex;align-items:center;gap:5px;color:#FF453A;"><input type="checkbox" id="cfg-extreme"> <span style="font-weight:600;">МЕГА-РИСК РЕЖИМ</span></label>
                        <div style="font-size:9px;color:#FF453A;margin-left:20px;">Максимальная скорость + минимум защиты</div>
                    </div>
                </div>

                <div style="display:flex;gap:4px;margin-bottom:6px;">
                    <button id="filter-video" style="flex:1;padding:5px 0;border-radius:7px;border:none;background:#0A84FF;color:white;font-size:11px;font-weight:600;">🎬 Видео</button>
                    <button id="filter-game" style="flex:1;padding:5px 0;border-radius:7px;border:none;background:rgba(255,255,255,0.1);color:#F5F5F7;font-size:11px;font-weight:500;">🎮 Игры</button>
                    <button id="orbs-refresh" style="padding:5px 8px;border-radius:7px;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.06);color:#F5F5F7;font-size:12px;cursor:pointer;">🔄</button>
                </div>

                <div id="orbs-status" style="font-size:10px;color:#8E8E93;margin-bottom:3px;">Готов</div>
                <div style="background:rgba(255,255,255,0.08);border-radius:999px;height:4px;margin-bottom:6px;"><div id="orbs-bar" style="background:linear-gradient(#0A84FF,#5E5CE6);height:100%;width:0%;transition:width .3s;border-radius:999px;"></div></div>

                <div id="orbs-list" style="max-height:155px;overflow-y:auto;font-size:11px;margin-bottom:8px;"></div>

                <div style="display:flex;gap:8px;">
                    <button id="orbs-start" style="flex:1;background:#0A84FF;color:white;border:none;border-radius:9px;padding:9px 0;font-weight:700;font-size:13px;cursor:pointer;">🚀 СТАРТ</button>
                    <button id="orbs-stop" style="flex:1;background:rgba(255,255,255,0.1);color:#F5F5F7;border:1px solid rgba(255,255,255,0.2);border-radius:9px;padding:9px 0;font-weight:700;font-size:13px;cursor:pointer;display:none;">⏹ СТОП</button>
                </div>
                <div style="margin-top:6px;text-align:center;font-size:8.5px;color:#636366;">Только для образовательных целей • © 2026 KDStudio</div>
            </div>
        `;
        document.body.appendChild(ui);

        // Drag logic
        let dragging=false,ox=0,oy=0;
        ui.querySelector("#orbs-drag").onmousedown = e => { dragging=true; ox=e.clientX-ui.offsetLeft; oy=e.clientY-ui.offsetTop; };
        document.addEventListener("mousemove", e => { if(dragging&&ui){ui.style.left=(e.clientX-ox)+"px";ui.style.top=(e.clientY-oy)+"px";ui.style.right="auto";} });
        document.addEventListener("mouseup", () => dragging=false);

        // Minimize button
        ui.querySelector("#orbs-minimize").onclick = () => minimizeUI();

        setupUIListeners();
    }

    function createMiniUI() {
        if (miniUi) miniUi.remove();
        miniUi = document.createElement("div");
        miniUi.style.cssText = "position:fixed;top:20px;right:20px;background:rgba(28,28,30,0.95);backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,0.15);border-radius:999px;padding:6px 14px 6px 10px;display:flex;align-items:center;gap:8px;z-index:999999;box-shadow:0 8px 30px rgba(0,0,0,0.4);";
        miniUi.innerHTML = `
            <div style="display:flex;align-items:center;gap:6px;">
                <div style="width:18px;height:18px;background:linear-gradient(#5E5CE6,#0A84FF);border-radius:5px;display:flex;align-items:center;justify-content:center;font-size:10px;">👓</div>
                <div style="font-weight:600;font-size:12px;">DisOrbsFarm</div>
                <div style="background:rgba(255,255,255,0.1);border-radius:999px;padding:1px 7px;font-size:10px;display:flex;align-items:center;gap:3px;"><span style="color:#30D158;">💎</span><span id="mini-orbs">0</span></div>
            </div>
            <button id="mini-restore" style="background:#0A84FF;color:white;border:none;border-radius:999px;padding:2px 9px;font-size:10px;font-weight:600;cursor:pointer;">Развернуть</button>
        `;
        document.body.appendChild(miniUi);
        miniUi.querySelector("#mini-restore").onclick = restoreUI;
    }

    function minimizeUI() {
        if (!ui) return;
        isMinimized = true;
        ui.style.display = "none";
        createMiniUI();
        const mo = miniUi.querySelector("#mini-orbs");
        if (mo) mo.textContent = sessionOrbs;
    }

    function restoreUI() {
        if (miniUi) miniUi.remove();
        if (ui) ui.style.display = "block";
        isMinimized = false;
    }

    function setupUIListeners() {
        const list = ui.querySelector("#orbs-list");
        const fVideo = ui.querySelector("#filter-video");
        const fGame = ui.querySelector("#filter-game");
        const refreshBtn = ui.querySelector("#orbs-refresh");
        const settingsPanel = ui.querySelector("#orbs-settings");
        const settingsBtn = ui.querySelector("#orbs-settings-btn");

        function renderList() {
            list.innerHTML = "";
            let filtered = allAvailable;
            if (currentFilter === "video") filtered = allAvailable.filter(q => q.isVideo);
            else if (currentFilter === "game") filtered = allAvailable.filter(q => q.isGame);

            filtered.forEach(q => {
                const div = document.createElement("div");
                div.style.cssText = "padding:5px 6px;border-bottom:1px solid rgba(255,255,255,0.05);display:flex;align-items:center;gap:7px;";
                const checked = selectedQuestIds.has(q.id) ? "checked" : "";
                const pct = q.secondsNeeded > 0 ? Math.floor((q.secondsDone / q.secondsNeeded) * 100) : 0;
                div.innerHTML = `
                    <input type="checkbox" ${checked} style="accent-color:#0A84FF;width:15px;height:15px;">
                    <div style="flex:1;min-width:0;">
                        <div style="font-weight:600;font-size:11px;display:flex;justify-content:space-between;"><span>${q.isVideo?'🎬':'🎮'} ${q.name}</span><span style="color:#30D158;font-size:10px;">+${q.estimatedOrbs}</span></div>
                        <div style="height:2.5px;background:rgba(255,255,255,0.1);border-radius:999px;margin-top:2px;"><div style="height:100%;width:${pct}%;background:linear-gradient(#0A84FF,#5E5CE6);border-radius:999px;"></div></div>
                    </div>
                    <div style="font-size:9px;color:#8E8E93;min-width:42px;text-align:right;">${Math.floor(q.secondsDone)}/${q.secondsNeeded}s</div>
                `;
                const chk = div.querySelector("input");
                chk.onchange = () => chk.checked ? selectedQuestIds.add(q.id) : selectedQuestIds.delete(q.id);
                list.appendChild(div);
            });
        }
        renderList();

        fVideo.onclick = () => { currentFilter="video"; fVideo.style.background="#0A84FF";fVideo.style.color="white"; fGame.style.background="rgba(255,255,255,0.1)";fGame.style.color="#F5F5F7"; renderList(); };
        fGame.onclick = () => { currentFilter="game"; fGame.style.background="#0A84FF";fGame.style.color="white"; fVideo.style.background="rgba(255,255,255,0.1)";fVideo.style.color="#F5F5F7"; renderList(); };
        fVideo.style.background = "#0A84FF"; fVideo.style.color = "white";

        refreshBtn.onclick = () => { loadQuests(); selectedQuestIds.clear(); renderList(); };

        let sOpen = false;
        settingsBtn.onclick = () => { sOpen = !sOpen; settingsPanel.style.display = sOpen ? "block" : "none"; };

        ui.querySelector("#cfg-enroll").onchange = e => CONFIG.AUTO_ENROLL = e.target.checked;
        ui.querySelector("#cfg-claim").onchange = e => CONFIG.AUTO_CLAIM = e.target.checked;
        ui.querySelector("#cfg-no-pause").onchange = e => CONFIG.DISABLE_PAUSES = e.target.checked;
        ui.querySelector("#cfg-notifications").onchange = e => CONFIG.NOTIFICATIONS_ENABLED = e.target.checked;

        const speedS = ui.querySelector("#cfg-speed");
        const speedV = ui.querySelector("#speed-val");
        speedS.oninput = () => { CONFIG.VIDEO_BASE_SPEED = parseFloat(speedS.value); speedV.textContent = CONFIG.VIDEO_BASE_SPEED.toFixed(1); };

        const extremeChk = ui.querySelector("#cfg-extreme");
        extremeChk.onchange = e => {
            CONFIG.EXTREME_MODE = e.target.checked;
            if (e.target.checked) {
                log("⚠️ МЕГА-РИСК РЕЖИМ ВКЛЮЧЁН — максимальная опасность бана!", "error");
                CONFIG.VIDEO_BASE_SPEED = 11;
                CONFIG.DISABLE_PAUSES = true;
                CONFIG.AUTO_CLAIM = true;
                speedS.value = 11;
                speedV.textContent = "11.0";
                ui.querySelector("#cfg-no-pause").checked = true;
                ui.querySelector("#cfg-claim").checked = true;
            }
        };

        ui.querySelector("#orbs-start").onclick = () => { if (!running) startFarm(); };
        ui.querySelector("#orbs-stop").onclick = () => { stopRequested = true; running = false; };
        ui.querySelector("#orbs-close").onclick = () => { if (ui) ui.remove(); if (miniUi) miniUi.remove(); };

        updateOrbsDisplay();
    }

    function updateOrbsDisplay() {
        if (!ui) return;
        const el = ui.querySelector("#orbs-count");
        if (el) el.textContent = sessionOrbs;
        if (miniUi) {
            const mo = miniUi.querySelector("#mini-orbs");
            if (mo) mo.textContent = sessionOrbs;
        }
    }

    function updateStats() {
        if (!ui || !sessionStartTime) return;
        const tEl = ui.querySelector("#stat-time");
        const qEl = ui.querySelector("#stat-quests");
        const rEl = ui.querySelector("#stat-orbsrate");
        if (tEl) { const e = Math.floor((now()-sessionStartTime)/1000); tEl.textContent = `${Math.floor(e/60).toString().padStart(2,"0")}:${(e%60).toString().padStart(2,"0")}`; }
        if (qEl) qEl.textContent = completedCount;
        if (rEl && completedCount > 0) {
            const min = Math.max(1, (now() - sessionStartTime) / 60000);
            rEl.textContent = Math.floor(sessionOrbs / min);
        }
    }

    const updateUI = (status, pct=0) => {
        if (!ui) return;
        const st = ui.querySelector("#orbs-status");
        const br = ui.querySelector("#orbs-bar");
        if (st) st.textContent = status;
        if (br) br.style.width = pct + "%";
        updateStats();
    };

    async function startFarm() {
        if (running) return;
        running = true;
        stopRequested = false;
        completedCount = 0;
        sessionOrbs = 0;
        updateOrbsDisplay();
        sessionStartTime = now();

        let queue = allAvailable.filter(q => selectedQuestIds.has(q.id));
        if (queue.length === 0) queue = allAvailable.slice(0, 5);

        ui.querySelector("#orbs-start").style.display = "none";
        ui.querySelector("#orbs-stop").style.display = "block";

        for (let i = 0; i < queue.length; i++) {
            if (stopRequested) break;
            const q = queue[i];
            await enrollQuest(q);

            try {
                if (q.isVideo) {
                    let done = q.secondsDone;
                    const needed = q.secondsNeeded;
                    while (done < needed && !stopRequested) {
                        const sp = CONFIG.VIDEO_BASE_SPEED + rnd(-0.4, 0.7);
                        await sleep(CONFIG.VIDEO_MIN_DELAY + rnd(0, 300));
                        try { await api.post({url: `/quests/${q.id}/video-progress`, body: {timestamp: done + sp}}); } catch {}
                        done += sp;
                        q.secondsDone = done;
                        updateUI(`🎬 ${q.name}`, Math.floor((done/needed)*100));
                    }
                } else if (q.isGame) {
                    await sleep(Math.min(q.secondsNeeded * 700, 180000));
                }

                completedCount++;
                const earned = q.estimatedOrbs || Math.floor(25 + rnd(5,15));
                sessionOrbs += earned;
                updateOrbsDisplay();
                updateStats();

            } catch(e) { log("Ошибка: " + e.message, "error"); }

            if (!CONFIG.DISABLE_PAUSES && i < queue.length-1 && !stopRequested) {
                const p = CONFIG.EXTREME_MODE ? rndInt(2,8) : rndInt(...CONFIG.PAUSE_BETWEEN_QUESTS);
                for (let s=p; s>0 && !stopRequested; s--) { updateUI(`Пауза ${s}с`, 0); await sleep(1000); }
            }
        }

        running = false;
        ui.querySelector("#orbs-start").style.display = "block";
        ui.querySelector("#orbs-stop").style.display = "none";
        updateUI("Готов", 100);

        const msg = `${t.completed} • ${completedCount} квестов • ${sessionOrbs} орбов`;
        log(msg, "success");
        showNotification("DisOrbsFarm", msg);
    }

    if (CONFIG.SHOW_UI) {
        createMainUI();
        log("DisOrbsFarm v5.3 готова. Выбирай квесты → СТАРТ", "success");
    }

    window.closeOrbsFarmer = () => { if(ui)ui.remove(); if(miniUi)miniUi.remove(); };
})();