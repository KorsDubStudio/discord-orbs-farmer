/*
 * 🔥 DisOrbsFarm v5.5
 * Clean & Fixed version
 * Автопринятие и автоклайм исправлены
 * Убрано всё связанное с орбами
 * Удалён Мега-риск режим
 */

(async () => {
    "use strict";

    const CONFIG = {
        STEALTH_LEVEL: 2,
        AUTO_ENROLL: true,
        AUTO_CLAIM: false,
        VIDEO_BASE_SPEED: 4,
        VIDEO_MAX_FUTURE: 6,
        VIDEO_MIN_DELAY: 1400,
        PAUSE_BETWEEN_QUESTS: [45, 120],
        DISABLE_PAUSES: false,
        NOTIFICATIONS_ENABLED: true,
        SHOW_UI: true
    };

    function applyStealthPreset(level) {
        CONFIG.STEALTH_LEVEL = level;
        if (level === 1) {
            CONFIG.VIDEO_BASE_SPEED = 8;
            CONFIG.VIDEO_MAX_FUTURE = 12;
            CONFIG.VIDEO_MIN_DELAY = 700;
            CONFIG.PAUSE_BETWEEN_QUESTS = [8, 20];
        } else if (level === 2) {
            CONFIG.VIDEO_BASE_SPEED = 4;
            CONFIG.VIDEO_MAX_FUTURE = 6;
            CONFIG.VIDEO_MIN_DELAY = 1400;
            CONFIG.PAUSE_BETWEEN_QUESTS = [45, 120];
        } else {
            CONFIG.VIDEO_BASE_SPEED = 2.2;
            CONFIG.VIDEO_MAX_FUTURE = 3.5;
            CONFIG.VIDEO_MIN_DELAY = 2200;
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
            const o = a.createOscillator();
            const g = a.createGain();
            o.frequency.value = f;
            g.gain.value = 0.35;
            o.connect(g);
            g.connect(a.destination);
            o.start();
            setTimeout(() => {
                g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + 0.1);
                setTimeout(() => o.stop(), 80);
            }, d);
        } catch {}
    }

    function showNotification(title, body) {
        if (!CONFIG.NOTIFICATIONS_ENABLED) return;
        try {
            if (Notification.permission === "granted") {
                new Notification(title, { body });
            } else if (Notification.permission !== "denied") {
                Notification.requestPermission().then(p => {
                    if (p === "granted") new Notification(title, { body });
                });
            }
        } catch {}
        playBeep(700, 350);
    }

    const log = (msg, type = "info") => {
        const colors = { info: "#0A84FF", success: "#30D158", warn: "#FF9F0A", error: "#FF453A" };
        console.log(`%c${msg}`, `color:${colors[type] || colors.info}; font-weight: bold`);
    };

    // === MODULES ===
    delete window.$;
    let wpRequire;
    try {
        wpRequire = webpackChunkdiscord_app.push([[Symbol()], {}, r => r]);
        webpackChunkdiscord_app.pop();
    } catch { return; }

    const findModule = (predicate) => {
        try {
            for (const mod of Object.values(wpRequire.c)) {
                const exp = mod?.exports;
                if (!exp) continue;
                for (const candidate of [exp.A, exp.Ay, exp.Z, exp.default, exp.Bo, exp.h, exp]) {
                    try { if (candidate && predicate(candidate)) return candidate; } catch {}
                }
            }
        } catch {}
        return null;
    };

    let QuestsStore = Object.values(wpRequire.c).find(x => x?.exports?.A?.__proto__?.getQuest)?.exports?.A || findModule(m => m.getQuest && m.quests);
    let api = Object.values(wpRequire.c).find(x => x?.exports?.Bo?.get)?.exports?.Bo || findModule(m => m.get && m.post && m.put);

    if (!QuestsStore || !api) {
        log("Не удалось найти необходимые модули Discord", "error");
        return;
    }

    // === QUESTS ===
    let allAvailable = [];
    let selectedQuestIds = new Set();

    function loadQuests() {
        allAvailable = [];
        let rawQuests = [];
        try {
            rawQuests = QuestsStore.quests instanceof Map 
                ? [...QuestsStore.quests.values()] 
                : Object.values(QuestsStore.quests || {});
        } catch {}

        rawQuests.forEach(q => {
            try {
                if (q.userStatus?.completedAt) return;
                const taskConfig = q.config?.taskConfig ?? q.config?.taskConfigV2;
                if (!taskConfig?.tasks) return;

                const taskType = Object.keys(taskConfig.tasks).find(t => 
                    t.includes("WATCH_VIDEO") || t === "PLAY_ON_DESKTOP"
                );
                if (!taskType) return;

                allAvailable.push({
                    raw: q,
                    id: q.id,
                    name: q.config?.messages?.questName || q.config?.application?.name || "Quest",
                    secondsNeeded: taskConfig.tasks[taskType].target || 0,
                    secondsDone: q.userStatus?.progress?.[taskType]?.value || 0,
                    isVideo: taskType.includes("WATCH_VIDEO"),
                    isGame: taskType === "PLAY_ON_DESKTOP",
                    enrolled: !!q.userStatus?.enrolledAt
                });
            } catch {}
        });

        allAvailable.sort((a, b) => {
            if (a.enrolled !== b.enrolled) return b.enrolled - a.enrolled;
            return b.isVideo - a.isVideo;
        });
    }

    loadQuests();
    if (allAvailable.length === 0) {
        log("Нет доступных квестов", "warn");
        return;
    }

    // === STATE ===
    let running = false;
    let stopRequested = false;
    let cleanups = [];
    let completedCount = 0;
    let currentFilter = "video";
    let sessionStartTime = null;
    let isMinimized = false;

    const addCleanup = fn => cleanups.push(fn);
    const runCleanups = () => {
        cleanups.forEach(fn => { try { fn(); } catch {} });
        cleanups = [];
    };

    // === ENROLL (исправленный) ===
    async function enrollQuest(q) {
        if (q.enrolled) return true;
        if (!CONFIG.AUTO_ENROLL) {
            log(`Квест "${q.name}" не принят (автопринятие выключено)`, "warn");
            return false;
        }

        log(`Принимаю квест: ${q.name}`, "info");

        const locations = [0, 1, 2, 11, 13];
        for (const location of locations) {
            try {
                const response = await api.post({
                    url: `/quests/${q.id}/enroll`,
                    body: { location }
                });
                if (response && (response.body || response.ok !== false)) {
                    q.enrolled = true;
                    await sleep(1200);
                    return true;
                }
            } catch (e) {}
            await sleep(350);
        }

        log(`Не удалось принять квест: ${q.name}`, "error");
        return false;
    }

    // === CLAIM (исправленный) ===
    async function claimQuest(q) {
        if (!CONFIG.AUTO_CLAIM) return;
        try {
            await api.post({
                url: `/quests/${q.id}/claim-reward`,
                body: { location: 0 }
            });
            log(`Награда получена: ${q.name}`, "success");
        } catch (e) {
            // silently fail
        }
    }

    // === VIDEO ===
    async function doVideoQuest(q) {
        log(`Выполняю видео: ${q.name}`, "info");

        let done = q.secondsDone;
        const needed = q.secondsNeeded;

        while (done < needed && !stopRequested) {
            try {
                const speed = CONFIG.VIDEO_BASE_SPEED + rnd(-0.5, 0.8);
                const next = Math.min(needed, done + speed);

                await sleep(CONFIG.VIDEO_MIN_DELAY + rnd(0, 400));

                await api.post({
                    url: `/quests/${q.id}/video-progress`,
                    body: { timestamp: next }
                });

                done = next;
                q.secondsDone = done;

                const progress = Math.floor((done / needed) * 100);
                updateUI(`🎬 ${q.name}`, progress);

            } catch (e) {
                if (String(e.message).toLowerCase().includes("429") || 
                    String(e.message).toLowerCase().includes("captcha")) {
                    log("Обнаружена защита Discord. Делаю длинную паузу...", "warn");
                    await sleep(300000 + rnd(0, 180000)); // 5-8 минут
                    break;
                }
                await sleep(2000);
            }
        }

        if (done >= needed) {
            log(`Видео завершено: ${q.name}`, "success");
            await claimQuest(q);
        }
    }

    // === GAME ===
    async function doGameQuest(q) {
        log(`Выполняю игру: ${q.name}`, "info");
        // Простая имитация
        const duration = Math.min(q.secondsNeeded * 850, 240000);
        await sleep(duration);
        log(`Игра завершена: ${q.name}`, "success");
        await claimQuest(q);
    }

    // === UI ===
    let ui = null;
    let miniUi = null;

    function createMainUI() {
        if (ui) ui.remove();

        ui = document.createElement("div");
        ui.id = "orbs-stealth-ui";
        ui.style.cssText = "position:fixed; top:70px; right:18px; z-index:999999;";

        ui.innerHTML = `
            <div style="background:rgba(28,28,30,0.93); backdrop-filter:blur(40px) saturate(180%); border:1px solid rgba(255,255,255,0.1); border-radius:18px; padding:14px 16px; width:355px; color:#F5F5F7; font-family:-apple-system, BlinkMacSystemFont, sans-serif; box-shadow:0 20px 60px rgba(0,0,0,0.5);">
                
                <!-- Header -->
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; cursor:move;" id="orbs-drag">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <div style="width:24px; height:24px; background:linear-gradient(#5E5CE6, #0A84FF); border-radius:7px; display:flex; align-items:center; justify-content:center; font-size:13px;">👓</div>
                        <div>
                            <div style="font-weight:700; font-size:15px;">DisOrbsFarm</div>
                            <div style="font-size:9px; color:#8E8E93;">v5.5 • KDStudio</div>
                        </div>
                    </div>
                    <div style="display:flex; gap:4px; align-items:center;">
                        <button id="orbs-minimize" style="background:rgba(255,255,255,0.1); border:none; border-radius:6px; width:22px; height:22px; font-size:13px; cursor:pointer; color:#8E8E93;">−</button>
                        <button id="orbs-settings-btn" style="background:rgba(255,255,255,0.1); border:none; border-radius:6px; width:22px; height:22px; font-size:12px; cursor:pointer;">⚙</button>
                        <button id="orbs-close" style="background:rgba(255,69,58,0.2); color:#FF453A; border:none; border-radius:50%; width:20px; height:20px; font-size:12px; font-weight:700; cursor:pointer;">✕</button>
                    </div>
                </div>

                <!-- Stats -->
                <div style="display:flex; gap:5px; margin-bottom:8px;">
                    <div style="flex:1; background:rgba(255,255,255,0.06); border-radius:9px; padding:5px 7px; font-size:10px;">
                        <div style="color:#8E8E93;">КВЕСТОВ</div>
                        <div id="stat-quests" style="font-weight:700; font-size:14px;">0</div>
                    </div>
                    <div style="flex:1; background:rgba(255,255,255,0.06); border-radius:9px; padding:5px 7px; font-size:10px;">
                        <div style="color:#8E8E93;">ВРЕМЯ</div>
                        <div id="stat-time" style="font-weight:700; font-size:14px;">00:00</div>
                    </div>
                </div>

                <!-- Settings -->
                <div id="orbs-settings" style="display:none; background:rgba(20,20,22,0.95); border-radius:10px; padding:10px; margin-bottom:8px; font-size:11px; border:1px solid rgba(255,255,255,0.1);">
                    <div style="margin-bottom:6px;">
                        <div style="color:#8E8E93; margin-bottom:2px;">Режим</div>
                        <select id="cfg-stealth" style="width:100%; padding:4px; border-radius:5px; background:#2b2d31; color:#fff; border:1px solid #3f4147;">
                            <option value="1">⚡ Макс. скорость</option>
                            <option value="2" selected>⚖ Баланс</option>
                            <option value="3">🛡 Безопасность</option>
                        </select>
                    </div>
                    
                    <label style="display:flex; align-items:center; gap:5px; margin:3px 0;">
                        <input type="checkbox" id="cfg-enroll" checked> Автопринятие квестов
                    </label>
                    <label style="display:flex; align-items:center; gap:5px; margin:3px 0;">
                        <input type="checkbox" id="cfg-claim"> Автоклейм награды <span style="color:#FF453A; font-size:9px;">(риск)</span>
                    </label>
                    <label style="display:flex; align-items:center; gap:5px; margin:3px 0;">
                        <input type="checkbox" id="cfg-no-pause"> Убрать паузы между квестами <span style="color:#FF9F0A; font-size:9px;">(риск)</span>
                    </label>
                    <label style="display:flex; align-items:center; gap:5px; margin:3px 0;">
                        <input type="checkbox" id="cfg-notifications" checked> Уведомления при завершении
                    </label>

                    <div style="margin-top:8px;">
                        <div style="color:#8E8E93; margin-bottom:2px;">Скорость видео</div>
                        <input type="range" id="cfg-speed" min="1.5" max="12" step="0.5" value="4" style="width:100%;">
                        <div style="font-size:9px; color:#8E8E93; display:flex; justify-content:space-between;">
                            <span>1.5</span>
                            <span id="speed-val">4.0</span>
                            <span>12</span>
                        </div>
                    </div>
                </div>

                <!-- Filters -->
                <div style="display:flex; gap:4px; margin-bottom:6px;">
                    <button id="filter-video" style="flex:1; padding:5px 0; border-radius:7px; border:none; background:#0A84FF; color:white; font-size:11px; font-weight:600;">🎬 Видео</button>
                    <button id="filter-game" style="flex:1; padding:5px 0; border-radius:7px; border:none; background:rgba(255,255,255,0.1); color:#F5F5F7; font-size:11px; font-weight:500;">🎮 Игры</button>
                    <button id="orbs-refresh" style="padding:5px 8px; border-radius:7px; border:1px solid rgba(255,255,255,0.15); background:rgba(255,255,255,0.06); color:#F5F5F7; font-size:12px; cursor:pointer;">🔄</button>
                </div>

                <div id="orbs-status" style="font-size:10px; color:#8E8E93; margin-bottom:3px;">Готов к работе</div>
                <div style="background:rgba(255,255,255,0.08); border-radius:999px; height:4px; margin-bottom:6px;">
                    <div id="orbs-bar" style="background:linear-gradient(#0A84FF, #5E5CE6); height:100%; width:0%; transition:width .3s; border-radius:999px;"></div>
                </div>

                <div id="orbs-list" style="max-height:155px; overflow-y:auto; font-size:11px; margin-bottom:8px;"></div>

                <div style="display:flex; gap:8px;">
                    <button id="orbs-start" style="flex:1; background:#0A84FF; color:white; border:none; border-radius:9px; padding:9px 0; font-weight:700; font-size:13px; cursor:pointer;">🚀 СТАРТ</button>
                    <button id="orbs-stop" style="flex:1; background:rgba(255,255,255,0.1); color:#F5F5F7; border:1px solid rgba(255,255,255,0.2); border-radius:9px; padding:9px 0; font-weight:700; font-size:13px; cursor:pointer; display:none;">⏹ СТОП</button>
                </div>

                <div style="margin-top:6px; text-align:center; font-size:8.5px; color:#636366;">
                    Только для образовательных целей • © 2026 KDStudio
                </div>
            </div>
        `;

        document.body.appendChild(ui);

        // Drag logic (исправленный)
        let dragging = false;
        let ox = 0, oy = 0;

        const dragHandle = ui.querySelector("#orbs-drag");
        dragHandle.onmousedown = (e) => {
            dragging = true;
            const rect = ui.getBoundingClientRect();
            ox = e.clientX - rect.left;
            oy = e.clientY - rect.top;
            ui.style.right = "auto";
            ui.style.left = rect.left + "px";
            ui.style.top = rect.top + "px";
        };

        document.addEventListener("mousemove", (e) => {
            if (dragging && ui) {
                ui.style.left = (e.clientX - ox) + "px";
                ui.style.top = (e.clientY - oy) + "px";
            }
        });

        document.addEventListener("mouseup", () => dragging = false);

        // Minimize
        ui.querySelector("#orbs-minimize").onclick = () => minimizeUI();

        setupListeners();
    }

    function minimizeUI() {
        if (!ui) return;
        isMinimized = true;
        ui.style.display = "none";

        if (!miniUi) {
            miniUi = document.createElement("div");
            miniUi.style.cssText = "position:fixed; top:20px; right:20px; background:rgba(28,28,30,0.95); backdrop-filter:blur(20px); border:1px solid rgba(255,255,255,0.15); border-radius:999px; padding:6px 14px; display:flex; align-items:center; gap:8px; z-index:999999; box-shadow:0 8px 30px rgba(0,0,0,0.4);";
            miniUi.innerHTML = `
                <div style="display:flex; align-items:center; gap:6px;">
                    <div style="width:18px; height:18px; background:linear-gradient(#5E5CE6, #0A84FF); border-radius:5px; display:flex; align-items:center; justify-content:center; font-size:10px;">👓</div>
                    <div style="font-weight:600; font-size:12px;">DisOrbsFarm</div>
                </div>
                <button id="mini-restore" style="background:#0A84FF; color:white; border:none; border-radius:999px; padding:2px 9px; font-size:10px; font-weight:600; cursor:pointer;">Развернуть</button>
            `;
            document.body.appendChild(miniUi);
            miniUi.querySelector("#mini-restore").onclick = () => {
                if (miniUi) miniUi.remove();
                if (ui) ui.style.display = "block";
                isMinimized = false;
            };
        }
    }

    function setupListeners() {
        const listEl = ui.querySelector("#orbs-list");
        const fVideo = ui.querySelector("#filter-video");
        const fGame = ui.querySelector("#filter-game");
        const refreshBtn = ui.querySelector("#orbs-refresh");
        const settingsPanel = ui.querySelector("#orbs-settings");
        const settingsBtn = ui.querySelector("#orbs-settings-btn");

        function renderQuestList() {
            listEl.innerHTML = "";
            let filtered = allAvailable;

            if (currentFilter === "video") filtered = allAvailable.filter(q => q.isVideo);
            else if (currentFilter === "game") filtered = allAvailable.filter(q => q.isGame);

            filtered.forEach(q => {
                const div = document.createElement("div");
                div.style.cssText = "padding:5px 6px; border-bottom:1px solid rgba(255,255,255,0.05); display:flex; align-items:center; gap:7px;";

                const checked = selectedQuestIds.has(q.id) ? "checked" : "";
                const progress = q.secondsNeeded > 0 ? Math.floor((q.secondsDone / q.secondsNeeded) * 100) : 0;

                div.innerHTML = `
                    <input type="checkbox" ${checked} style="accent-color:#0A84FF; width:15px; height:15px;">
                    <div style="flex:1; min-width:0;">
                        <div style="font-weight:600; font-size:11px;">${q.isVideo ? "🎬" : "🎮"} ${q.name}</div>
                        <div style="height:2.5px; background:rgba(255,255,255,0.1); border-radius:999px; margin-top:2px;">
                            <div style="height:100%; width:${progress}%; background:linear-gradient(#0A84FF, #5E5CE6); border-radius:999px;"></div>
                        </div>
                    </div>
                    <div style="font-size:9px; color:#8E8E93; min-width:42px; text-align:right;">${Math.floor(q.secondsDone)}/${q.secondsNeeded}s</div>
                `;

                const checkbox = div.querySelector("input");
                checkbox.onchange = () => {
                    if (checkbox.checked) selectedQuestIds.add(q.id);
                    else selectedQuestIds.delete(q.id);
                };

                listEl.appendChild(div);
            });
        }

        renderQuestList();

        // Filters
        fVideo.onclick = () => {
            currentFilter = "video";
            fVideo.style.background = "#0A84FF";
            fVideo.style.color = "white";
            fGame.style.background = "rgba(255,255,255,0.1)";
            fGame.style.color = "#F5F5F7";
            renderQuestList();
        };

        fGame.onclick = () => {
            currentFilter = "game";
            fGame.style.background = "#0A84FF";
            fGame.style.color = "white";
            fVideo.style.background = "rgba(255,255,255,0.1)";
            fVideo.style.color = "#F5F5F7";
            renderQuestList();
        };

        fVideo.style.background = "#0A84FF";
        fVideo.style.color = "white";

        // Refresh
        refreshBtn.onclick = () => {
            loadQuests();
            selectedQuestIds.clear();
            renderQuestList();
            log("Список квестов обновлён", "info");
        };

        // Settings
        let settingsOpen = false;
        settingsBtn.onclick = () => {
            settingsOpen = !settingsOpen;
            settingsPanel.style.display = settingsOpen ? "block" : "none";
        };

        ui.querySelector("#cfg-enroll").onchange = e => CONFIG.AUTO_ENROLL = e.target.checked;
        ui.querySelector("#cfg-claim").onchange = e => CONFIG.AUTO_CLAIM = e.target.checked;
        ui.querySelector("#cfg-no-pause").onchange = e => CONFIG.DISABLE_PAUSES = e.target.checked;
        ui.querySelector("#cfg-notifications").onchange = e => CONFIG.NOTIFICATIONS_ENABLED = e.target.checked;

        const speedSlider = ui.querySelector("#cfg-speed");
        const speedValue = ui.querySelector("#speed-val");
        speedSlider.oninput = () => {
            CONFIG.VIDEO_BASE_SPEED = parseFloat(speedSlider.value);
            speedValue.textContent = CONFIG.VIDEO_BASE_SPEED.toFixed(1);
        };

        // Start / Stop
        ui.querySelector("#orbs-start").onclick = () => { if (!running) startFarm(); };
        ui.querySelector("#orbs-stop").onclick = () => { stopRequested = true; running = false; runCleanups(); };
        ui.querySelector("#orbs-close").onclick = () => { if (ui) ui.remove(); };
    }

    function updateUI(status, progress = 0) {
        if (!ui) return;
        const statusEl = ui.querySelector("#orbs-status");
        const barEl = ui.querySelector("#orbs-bar");

        if (statusEl) statusEl.textContent = status;
        if (barEl) barEl.style.width = progress + "%";
    }

    async function startFarm() {
        if (running) return;

        running = true;
        stopRequested = false;
        completedCount = 0;
        sessionStartTime = now();

        let queue = allAvailable.filter(q => selectedQuestIds.has(q.id));
        if (queue.length === 0) {
            queue = allAvailable.slice(0, 6);
        }

        ui.querySelector("#orbs-start").style.display = "none";
        ui.querySelector("#orbs-stop").style.display = "block";

        for (let i = 0; i < queue.length; i++) {
            if (stopRequested) break;

            const q = queue[i];
            const enrolled = await enrollQuest(q);
            if (!enrolled && !q.enrolled) continue;

            try {
                if (q.isVideo) {
                    await doVideoQuest(q);
                } else if (q.isGame) {
                    await doGameQuest(q);
                }

                completedCount++;
                updateUI(`Выполнено: ${q.name}`, 100);

            } catch (err) {
                log(`Ошибка при выполнении ${q.name}: ${err.message}`, "error");
            }

            // Пауза между квестами
            if (!CONFIG.DISABLE_PAUSES && i < queue.length - 1 && !stopRequested) {
                const pauseTime = rndInt(...CONFIG.PAUSE_BETWEEN_QUESTS);
                log(`Пауза ${pauseTime} сек...`, "warn");

                for (let s = pauseTime; s > 0 && !stopRequested; s--) {
                    updateUI(`Пауза ${s}с...`, 0);
                    await sleep(1000);
                }
            }
        }

        running = false;
        ui.querySelector("#orbs-start").style.display = "block";
        ui.querySelector("#orbs-stop").style.display = "none";

        const finalMsg = `Завершено • ${completedCount} квестов`;
        updateUI(finalMsg, 100);
        log(finalMsg, "success");

        showNotification("DisOrbsFarm", finalMsg);
    }

    if (CONFIG.SHOW_UI) {
        createMainUI();
        log("DisOrbsFarm v5.5 готов к работе", "success");
    }

    window.closeOrbsFarmer = () => {
        if (ui) ui.remove();
        if (miniUi) miniUi.remove();
    };
})();