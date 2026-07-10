/*
 * ==UserScript==
 * @name         Discord Orbs Farmer v8.0
 * @namespace    https://github.com/KorsDubStudio/discord-orbs-farmer
 * @version      8.0
 * @description  Полная перезапись с нуля. Чистый и стабильный фармер Discord Orbs.
 * @author       KDStudio
 * @match        https://discord.com/*
 * @grant        none
 * @run-at       document-idle
 * ==/UserScript==
 */

/**
 * Discord Orbs Farmer v8.0
 * Полная перезапись с нуля — чистая, современная, максимально стабильная версия.
 * Всё сделано заново для лучшей производительности и безопасности.
 */

(async () => {
    "use strict";

    // ================== CONFIG ==================
    const CONFIG = {
        level: 2,
        autoEnroll: true,
        autoClaim: false,
        videoSpeed: 4.0,
        pauseRange: [45, 120],
        disablePauses: false,
        notifications: true
    };

    // Загрузка сохранённых настроек
    function loadConfig() {
        try {
            const saved = localStorage.getItem('disorbsfarm_config');
            if (saved) {
                const parsed = JSON.parse(saved);
                Object.assign(CONFIG, parsed);
            }
        } catch {}
    }
    function saveConfig() {
        try {
            localStorage.setItem('disorbsfarm_config', JSON.stringify(CONFIG));
        } catch {}
    }

    function setLevel(lvl) {
        CONFIG.level = lvl;
        if (lvl === 1) {
            CONFIG.videoSpeed = 8.0;
            CONFIG.pauseRange = [8, 18];
        } else if (lvl === 2) {
            CONFIG.videoSpeed = 4.0;
            CONFIG.pauseRange = [45, 120];
        } else {
            CONFIG.videoSpeed = 2.2;
            CONFIG.pauseRange = [120, 300];
        }
        saveConfig();
    }

    loadConfig();
    setLevel(CONFIG.level);

    // ================== HELPERS ==================
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const rand = (min, max) => Math.random() * (max - min) + min;

    function sound(freq = 850, time = 160) {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const o = ctx.createOscillator();
            const g = ctx.createGain();
            o.type = "sine";
            o.frequency.value = freq;
            g.gain.value = 0.25;
            o.connect(g);
            g.connect(ctx.destination);
            o.start();
            setTimeout(() => {
                g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
                setTimeout(() => o.stop(), 30);
            }, time);
        } catch {}
    }

    function notify(title, msg) {
        if (!CONFIG.notifications) return;
        try {
            if (Notification.permission === "granted") {
                new Notification(title, { body: msg });
            } else if (Notification.permission !== "denied") {
                Notification.requestPermission().then(p => {
                    if (p === "granted") new Notification(title, { body: msg });
                });
            }
        } catch {}
        sound(720, 200);
    }

    const print = (text, type = "info") => {
        const color = { info: "#0A84FF", success: "#30D158", warn: "#FF9F0A", error: "#FF453A" }[type] || "#0A84FF";
        console.log(`%c[DisOrbsFarm v8] ${text}`, `color:${color}; font-weight:600`);
    };

    // ================== DISCORD MODULES ==================
    delete window.$;
    let wp;
    try {
        wp = webpackChunkdiscord_app.push([[Symbol()], {}, r => r]);
        webpackChunkdiscord_app.pop();
    } catch {
        print("Не удалось получить доступ к Discord модулям. Убедись, что ты на discord.com/app", "error");
        return;
    }

    const getMod = fn => {
        for (const m of Object.values(wp.c)) {
            const e = m?.exports;
            if (!e) continue;
            for (const v of [e.A, e.Ay, e.Z, e.default, e.Bo, e.h, e]) {
                if (v && fn(v)) return v;
            }
        }
        return null;
    };

    const Quests = getMod(m => m.getQuest && m.quests) || 
                 Object.values(wp.c).find(x => x?.exports?.A?.__proto__?.getQuest)?.exports?.A;
    const API = getMod(m => m.post && m.get) || 
              Object.values(wp.c).find(x => x?.exports?.Bo?.get)?.exports?.Bo;

    if (!Quests || !API) {
        print("Не удалось загрузить модули Discord. Попробуй обновить страницу.", "error");
        return;
    }

    // ================== STATE ==================
    let list = [];
    let chosen = new Set();
    let running = false;
    let stopped = false;
    let currentFilter = "video";

    function loadQuests() {
        list = [];
        let raw = [];
        try {
            raw = Quests.quests instanceof Map ? [...Quests.quests.values()] : Object.values(Quests.quests || {});
        } catch {}

        raw.forEach(q => {
            try {
                if (q.userStatus?.completedAt) return;
                const cfg = q.config?.taskConfig ?? q.config?.taskConfigV2;
                if (!cfg?.tasks) return;

                const typeKey = Object.keys(cfg.tasks).find(t => 
                    t.includes("VIDEO") || t === "PLAY_ON_DESKTOP"
                );
                if (!typeKey) return;

                list.push({
                    id: q.id,
                    name: q.config?.messages?.questName || q.config?.application?.name || "Quest",
                    needed: cfg.tasks[typeKey].target || 0,
                    done: q.userStatus?.progress?.[typeKey]?.value || 0,
                    video: typeKey.includes("VIDEO"),
                    game: typeKey === "PLAY_ON_DESKTOP",
                    enrolled: !!q.userStatus?.enrolledAt
                });
            } catch {}
        });

        list.sort((a, b) => (b.enrolled - a.enrolled) || (b.video - a.video));
    }

    loadQuests();
    if (!list.length) {
        print("Нет доступных квестов для фарма. Убедись, что ты вошёл в аккаунт и есть активные квесты.", "warn");
        return;
    }

    // ================== ACTIONS ==================
    async function enrollQuest(q) {
        if (q.enrolled) return true;
        if (!CONFIG.autoEnroll) return false;

        for (const loc of [0, 1, 2, 11, 13]) {
            try {
                const r = await API.post({ url: `/quests/${q.id}/enroll`, body: { location: loc } });
                if (r?.body) {
                    q.enrolled = true;
                    await sleep(800);
                    return true;
                }
            } catch {}
            await sleep(250);
        }
        return false;
    }

    async function claimQuest(q) {
        if (!CONFIG.autoClaim) return;
        try {
            await API.post({ url: `/quests/${q.id}/claim-reward`, body: { location: 0 } });
            print(`Награда за квест получена: ${q.name}`, "success");
        } catch {}
    }

    async function doVideo(q) {
        let done = q.done;
        const total = q.needed;

        while (done < total && !stopped) {
            const step = CONFIG.videoSpeed + rand(-0.4, 0.7);
            await sleep(1200 + rand(0, 450));

            try {
                await API.post({ url: `/quests/${q.id}/video-progress`, body: { timestamp: done + step } });
                done += step;
                q.done = done;
                updateProgress(q.id, Math.min(100, Math.floor((done / total) * 100)));
            } catch (e) {
                const err = String(e);
                if (err.includes("429") || err.includes("captcha") || err.includes("rate")) {
                    print("Discord защита сработала. Делаю долгую паузу...", "warn");
                    await sleep(rand(300000, 600000));
                    break;
                }
                print("Ошибка прогресса видео: " + err, "error");
            }
        }

        if (done >= total) {
            await claimQuest(q);
        }
    }

    async function doGame(q) {
        print(`Игровой квест: ${q.name} — ждём ${q.needed} сек...`, "info");
        await sleep(Math.min(q.needed * 850, 200000));
        await claimQuest(q);
    }

    // ================== UI ==================
    let ui = null;
    let miniUI = null;
    let progressBars = new Map();

    function buildUI() {
        if (ui) ui.remove();

        ui = document.createElement("div");
        ui.style.cssText = "position:fixed; top:70px; right:18px; z-index:999999; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;";

        ui.innerHTML = `
            <div style="width: 370px; background: rgba(22, 22, 24, 0.96); backdrop-filter: blur(50px) saturate(180%); border: 1px solid rgba(255,255,255,0.08); border-radius: 22px; padding: 18px 20px; color: #F5F5F7; box-shadow: 0 30px 90px rgba(0,0,0,0.7);">
                
                <!-- Header -->
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; cursor:move;" id="df-drag">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <div style="width:30px; height:30px; background: linear-gradient(135deg, #5E5CE6, #0A84FF); border-radius:9px; display:flex; align-items:center; justify-content:center; font-size:16px; box-shadow: 0 3px 10px rgba(94,92,230,0.5);">👓</div>
                        <div>
                            <div style="font-weight:800; font-size:18px; letter-spacing:-0.3px;">DisOrbsFarm</div>
                            <div style="font-size:10px; color:#8E8E93; margin-top:-2px;">v8.0 • С нуля</div>
                        </div>
                    </div>
                    <div style="display:flex; gap:5px;">
                        <button id="df-min" style="width:26px; height:26px; background:rgba(255,255,255,0.08); border:none; border-radius:7px; font-size:14px; color:#8E8E93; cursor:pointer; transition: all .2s;">−</button>
                        <button id="df-set" style="width:26px; height:26px; background:rgba(255,255,255,0.08); border:none; border-radius:7px; font-size:13px; cursor:pointer; transition: all .2s;">⚙</button>
                        <button id="df-x" style="width:24px; height:24px; background:rgba(255,69,58,0.15); color:#FF453A; border:none; border-radius:50%; font-size:13px; font-weight:700; cursor:pointer; transition: all .2s;">✕</button>
                    </div>
                </div>

                <!-- Stats -->
                <div style="display:flex; gap:6px; margin-bottom:12px;">
                    <div style="flex:1; background:rgba(255,255,255,0.05); border-radius:10px; padding:8px 10px; font-size:11px;">
                        <div style="color:#8E8E93; font-size:9.5px;">КВЕСТОВ</div>
                        <div id="df-qcount" style="font-weight:700; font-size:17px; margin-top:1px;">0</div>
                    </div>
                    <div style="flex:1; background:rgba(255,255,255,0.05); border-radius:10px; padding:8px 10px; font-size:11px;">
                        <div style="color:#8E8E93; font-size:9.5px;">ВРЕМЯ</div>
                        <div id="df-time" style="font-weight:700; font-size:17px; margin-top:1px;">00:00</div>
                    </div>
                </div>

                <!-- Settings Panel -->
                <div id="df-settings" style="display:none; background:rgba(15,15,17,0.98); border-radius:12px; padding:13px; margin-bottom:11px; font-size:12.5px; border:1px solid rgba(255,255,255,0.06);">
                    <div style="margin-bottom:9px;">
                        <div style="color:#8E8E93; margin-bottom:4px; font-size:11px; font-weight:500;">Уровень безопасности</div>
                        <select id="df-level" style="width:100%; padding:7px 9px; border-radius:8px; background:#2b2d31; color:#fff; border:1px solid #3f4147; font-size:13px;">
                            <option value="1">⚡ Быстрый (риск)</option>
                            <option value="2" selected>⚖ Баланс (рекомендуется)</option>
                            <option value="3">🛡 Безопасный</option>
                        </select>
                    </div>

                    <div style="display:flex; flex-direction:column; gap:4px; font-size:12.5px;">
                        <label style="display:flex; align-items:center; gap:7px; cursor:pointer;"><input type="checkbox" id="df-enroll" checked style="accent-color:#0A84FF;"> Автопринятие квестов</label>
                        <label style="display:flex; align-items:center; gap:7px; cursor:pointer;"><input type="checkbox" id="df-claim" style="accent-color:#0A84FF;"> Автоклейм наград <span style="color:#FF453A; font-size:10px;">(риск)</span></label>
                        <label style="display:flex; align-items:center; gap:7px; cursor:pointer;"><input type="checkbox" id="df-nopause" style="accent-color:#0A84FF;"> Без пауз между квестами <span style="color:#FF9F0A; font-size:10px;">(риск)</span></label>
                        <label style="display:flex; align-items:center; gap:7px; cursor:pointer;"><input type="checkbox" id="df-notify" checked style="accent-color:#0A84FF;"> Уведомления и звуки</label>
                    </div>

                    <div style="margin-top:10px;">
                        <div style="color:#8E8E93; margin-bottom:3px; font-size:11px; font-weight:500;">Скорость видео (x)</div>
                        <input type="range" id="df-speed" min="1.5" max="12" step="0.2" value="4" style="width:100%; accent-color:#5E5CE6;">
                        <div style="display:flex; justify-content:space-between; font-size:10px; color:#8E8E93; margin-top:2px;">
                            <span>1.5x</span> <span id="df-spval" style="font-weight:600; color:#fff;">4.0</span> <span>12x</span>
                        </div>
                    </div>
                </div>

                <!-- Filters -->
                <div style="display:flex; gap:5px; margin-bottom:9px;">
                    <button id="df-fvideo" style="flex:1; padding:7px 0; border-radius:9px; border:none; background:#0A84FF; color:white; font-size:12px; font-weight:700; cursor:pointer; transition:all .2s;">🎬 Видео</button>
                    <button id="df-fgame" style="flex:1; padding:7px 0; border-radius:9px; border:none; background:rgba(255,255,255,0.08); color:#F5F5F7; font-size:12px; font-weight:600; cursor:pointer; transition:all .2s;">🎮 Игры</button>
                    <button id="df-refresh" style="padding:7px 11px; border-radius:9px; border:1px solid rgba(255,255,255,0.12); background:rgba(255,255,255,0.05); color:#F5F5F7; font-size:13px; cursor:pointer; transition:all .2s;">🔄</button>
                </div>

                <div id="df-status" style="font-size:11px; color:#8E8E93; margin-bottom:5px; min-height:16px;">Готов к работе</div>
                
                <div style="background:rgba(255,255,255,0.06); border-radius:999px; height:4px; margin-bottom:10px; overflow:hidden;">
                    <div id="df-bar" style="background:linear-gradient(90deg, #0A84FF, #5E5CE6); height:100%; width:0%; transition:width .4s cubic-bezier(0.23,1,0.32,1); border-radius:999px;"></div>
                </div>

                <div id="df-list" style="max-height:165px; overflow-y:auto; font-size:12px; margin-bottom:12px; padding-right:4px;"></div>

                <div style="display:flex; gap:8px;">
                    <button id="df-start" style="flex:1; background:#0A84FF; color:white; border:none; border-radius:11px; padding:12px 0; font-weight:800; font-size:14.5px; cursor:pointer; transition:all .2s; box-shadow:0 4px 15px rgba(10,132,255,0.3);">СТАРТ ФАРМА</button>
                    <button id="df-stop" style="flex:1; background:rgba(255,255,255,0.08); color:#F5F5F7; border:1px solid rgba(255,255,255,0.15); border-radius:11px; padding:12px 0; font-weight:800; font-size:14.5px; cursor:pointer; display:none; transition:all .2s;">ОСТАНОВИТЬ</button>
                </div>

                <div style="margin-top:10px; text-align:center; font-size:9px; color:#636366; opacity:0.8;">
                    Только для личного использования • KDStudio 2026
                </div>
            </div>
        `;

        document.body.appendChild(ui);

        // Drag logic
        let drag = false, ox = 0, oy = 0;
        const handle = ui.querySelector("#df-drag");
        handle.onmousedown = e => {
            drag = true;
            const r = ui.getBoundingClientRect();
            ox = e.clientX - r.left;
            oy = e.clientY - r.top;
            ui.style.right = "auto";
            ui.style.left = r.left + "px";
            ui.style.top = r.top + "px";
        };
        document.addEventListener("mousemove", e => {
            if (drag) {
                ui.style.left = (e.clientX - ox) + "px";
                ui.style.top = (e.clientY - oy) + "px";
            }
        });
        document.addEventListener("mouseup", () => drag = false);

        setupInterface();
    }

    function setupInterface() {
        const listEl = ui.querySelector("#df-list");
        const fVideo = ui.querySelector("#df-fvideo");
        const fGame = ui.querySelector("#df-fgame");
        const refBtn = ui.querySelector("#df-refresh");
        const settingsBox = ui.querySelector("#df-settings");
        const setBtn = ui.querySelector("#df-set");
        const startBtn = ui.querySelector("#df-start");
        const stopBtn = ui.querySelector("#df-stop");
        const statusEl = ui.querySelector("#df-status");
        const mainBar = ui.querySelector("#df-bar");

        function updateStats() {
            ui.querySelector("#df-qcount").textContent = list.length;
        }
        updateStats();

        function drawList() {
            listEl.innerHTML = "";
            let filtered = list;
            if (currentFilter === "video") filtered = list.filter(q => q.video);
            else if (currentFilter === "game") filtered = list.filter(q => q.game);

            filtered.forEach(q => {
                const row = document.createElement("div");
                row.style.cssText = "padding:6px 8px; border-bottom:1px solid rgba(255,255,255,0.04); display:flex; align-items:center; gap:8px;";
                const isChecked = chosen.has(q.id) ? "checked" : "";
                const pct = q.needed > 0 ? Math.floor((q.done / q.needed) * 100) : 0;

                row.innerHTML = `
                    <input type="checkbox" ${isChecked} style="accent-color:#0A84FF; width:16px; height:16px; flex-shrink:0;">
                    <div style="flex:1; min-width:0;">
                        <div style="font-weight:600; font-size:12.5px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${q.video ? "🎬" : "🎮"} ${q.name}</div>
                        <div style="height:3px; background:rgba(255,255,255,0.08); border-radius:999px; margin-top:3px; overflow:hidden;">
                            <div style="height:100%; width:${pct}%; background:linear-gradient(#0A84FF, #5E5CE6); border-radius:999px; transition:width .3s;"></div>
                        </div>
                    </div>
                    <div style="font-size:10px; color:#8E8E93; min-width:48px; text-align:right; font-variant-numeric:tabular-nums;">${Math.floor(q.done)}/${q.needed}</div>
                `;

                const chk = row.querySelector("input");
                chk.onchange = () => {
                    if (chk.checked) chosen.add(q.id);
                    else chosen.delete(q.id);
                };
                listEl.appendChild(row);
            });
        }

        drawList();

        // Filter buttons
        fVideo.onclick = () => {
            currentFilter = "video";
            fVideo.style.background = "#0A84FF";
            fVideo.style.color = "white";
            fGame.style.background = "rgba(255,255,255,0.08)";
            fGame.style.color = "#F5F5F7";
            drawList();
        };
        fGame.onclick = () => {
            currentFilter = "game";
            fGame.style.background = "#0A84FF";
            fGame.style.color = "white";
            fVideo.style.background = "rgba(255,255,255,0.08)";
            fVideo.style.color = "#F5F5F7";
            drawList();
        };
        fVideo.style.background = "#0A84FF";
        fVideo.style.color = "white";

        refBtn.onclick = () => {
            loadQuests();
            chosen.clear();
            drawList();
            updateStats();
            print("Список квестов обновлён", "info");
        };

        // Settings
        let settingsOpen = false;
        setBtn.onclick = () => {
            settingsOpen = !settingsOpen;
            settingsBox.style.display = settingsOpen ? "block" : "none";
        };

        const levelSel = ui.querySelector("#df-level");
        levelSel.value = CONFIG.level;
        levelSel.onchange = e => {
            setLevel(parseInt(e.target.value));
            print(`Уровень изменён на ${CONFIG.level}`, "info");
        };

        ui.querySelector("#df-enroll").checked = CONFIG.autoEnroll;
        ui.querySelector("#df-enroll").onchange = e => { CONFIG.autoEnroll = e.target.checked; saveConfig(); };

        ui.querySelector("#df-claim").checked = CONFIG.autoClaim;
        ui.querySelector("#df-claim").onchange = e => { CONFIG.autoClaim = e.target.checked; saveConfig(); };

        ui.querySelector("#df-nopause").checked = CONFIG.disablePauses;
        ui.querySelector("#df-nopause").onchange = e => { CONFIG.disablePauses = e.target.checked; saveConfig(); };

        ui.querySelector("#df-notify").checked = CONFIG.notifications;
        ui.querySelector("#df-notify").onchange = e => { CONFIG.notifications = e.target.checked; saveConfig(); };

        const speedSlider = ui.querySelector("#df-speed");
        const speedVal = ui.querySelector("#df-spval");
        speedSlider.value = CONFIG.videoSpeed;
        speedVal.textContent = CONFIG.videoSpeed.toFixed(1);

        speedSlider.oninput = () => {
            CONFIG.videoSpeed = parseFloat(speedSlider.value);
            speedVal.textContent = CONFIG.videoSpeed.toFixed(1);
            saveConfig();
        };

        startBtn.onclick = runSession;
        stopBtn.onclick = () => {
            stopped = true;
            running = false;
            statusEl.textContent = "Остановлено пользователем";
        };

        ui.querySelector("#df-x").onclick = () => {
            ui.remove();
            if (miniUI) miniUI.remove();
        };
    }

    function minimizeUI() {
        if (!ui) return;
        ui.style.display = "none";
        if (!miniUI) {
            miniUI = document.createElement("div");
            miniUI.style.cssText = "position:fixed; top:20px; right:20px; background:rgba(22,22,24,0.95); backdrop-filter:blur(25px); border:1px solid rgba(255,255,255,0.1); border-radius:999px; padding:5px 14px; display:flex; align-items:center; gap:8px; z-index:999999; box-shadow:0 10px 30px rgba(0,0,0,0.4);";
            miniUI.innerHTML = `
                <div style="display:flex; align-items:center; gap:6px;">
                    <div style="width:20px; height:20px; background:linear-gradient(#5E5CE6,#0A84FF); border-radius:6px; display:flex; align-items:center; justify-content:center; font-size:11px;">👓</div>
                    <div style="font-weight:700; font-size:12.5px;">DisOrbsFarm</div>
                </div>
                <button style="background:#0A84FF; color:white; border:none; border-radius:999px; padding:3px 10px; font-size:10px; font-weight:700; cursor:pointer;">Открыть</button>
            `;
            document.body.appendChild(miniUI);
            miniUI.querySelector("button").onclick = () => {
                miniUI.remove();
                miniUI = null;
                ui.style.display = "block";
            };
        }
    }

    function updateProgress(id, pct) {
        // Обновляем главный бар (средний прогресс)
        const mainBar = ui?.querySelector("#df-bar");
        if (mainBar) {
            mainBar.style.width = pct + "%";
        }
        // Можно расширить для индивидуальных баров
    }

    async function runSession() {
        if (running) return;
        running = true;
        stopped = false;

        const statusEl = ui.querySelector("#df-status");
        const startBtn = ui.querySelector("#df-start");
        const stopBtn = ui.querySelector("#df-stop");
        const mainBar = ui.querySelector("#df-bar");

        let toRun = list.filter(q => chosen.has(q.id));
        if (toRun.length === 0) {
            toRun = list.slice(0, 6); // Берём первые 6 если ничего не выбрано
        }

        startBtn.style.display = "none";
        stopBtn.style.display = "block";
        mainBar.style.width = "0%";

        for (let i = 0; i < toRun.length && !stopped; i++) {
            const q = toRun[i];
            statusEl.textContent = `Обработка: ${q.name}`;

            const ok = await enrollQuest(q);
            if (!ok && !q.enrolled) {
                print(`Не удалось принять квест: ${q.name}`, "warn");
                continue;
            }

            try {
                if (q.video) {
                    await doVideo(q);
                } else if (q.game) {
                    await doGame(q);
                }
            } catch (e) {
                print("Ошибка выполнения квеста: " + e.message, "error");
            }

            if (!CONFIG.disablePauses && i < toRun.length - 1 && !stopped) {
                const pauseTime = rand(...CONFIG.pauseRange);
                for (let s = Math.floor(pauseTime); s > 0 && !stopped; s--) {
                    statusEl.textContent = `Пауза ${s}с • ${toRun[i+1]?.name || ""}`;
                    await sleep(1000);
                }
            }
        }

        running = false;
        startBtn.style.display = "block";
        stopBtn.style.display = "none";
        statusEl.textContent = stopped ? "Остановлено" : `Готово! ${toRun.length} квестов`;
        if (mainBar) mainBar.style.width = "100%";

        notify("DisOrbsFarm v8.0", `Фарм завершён. Обработано квестов: ${toRun.length}`);
        print("Сессия фарма успешно завершена", "success");
    }

    // ================== START ==================
    buildUI();
    print("DisOrbsFarm v8.0 готов. Всё с нуля, чистый код.", "success");
    notify("DisOrbsFarm", "Скрипт загружен. Добро пожаловать!");

    window.closeOrbsFarmer = () => {
        if (ui) ui.remove();
        if (miniUI) miniUI.remove();
        print("DisOrbsFarm закрыт", "info");
    };

    // Подсказка в консоль
    console.log("%c[DisOrbsFarm v8.0] Чтобы закрыть UI: window.closeOrbsFarmer()", "color:#8E8E93");
})();