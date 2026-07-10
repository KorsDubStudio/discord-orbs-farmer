/*
 * DisOrbsFarm v7.0
 * Полная перезапись с нуля
 * Максимально чистая, стабильная и функциональная версия
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

    function setLevel(lvl) {
        CONFIG.level = lvl;
        if (lvl === 1) {
            CONFIG.videoSpeed = 8.0;
            CONFIG.pauseRange = [6, 15];
        } else if (lvl === 2) {
            CONFIG.videoSpeed = 4.0;
            CONFIG.pauseRange = [45, 120];
        } else {
            CONFIG.videoSpeed = 2.4;
            CONFIG.pauseRange = [90, 240];
        }
    }
    setLevel(CONFIG.level);

    // ================== HELPERS ==================
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const rand = (min, max) => Math.random() * (max - min) + min;

    function sound(freq = 850, time = 160) {
        try {
            const ctx = new (AudioContext || webkitAudioContext)();
            const o = ctx.createOscillator();
            const g = ctx.createGain();
            o.type = "sine";
            o.frequency.value = freq;
            g.gain.value = 0.3;
            o.connect(g); g.connect(ctx.destination);
            o.start();
            setTimeout(() => {
                g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
                setTimeout(() => o.stop(), 40);
            }, time);
        } catch {}
    }

    function notify(title, msg) {
        if (!CONFIG.notifications) return;
        try {
            if (Notification.permission === "granted") new Notification(title, { body: msg });
            else if (Notification.permission !== "denied") Notification.requestPermission().then(p => p === "granted" && new Notification(title, { body: msg }));
        } catch {}
        sound(720, 220);
    }

    const print = (text, type = "info") => {
        const color = { info: "#0A84FF", success: "#30D158", warn: "#FF9F0A", error: "#FF453A" }[type] || "#0A84FF";
        console.log(`%c[DisOrbsFarm] ${text}`, `color:${color};font-weight:600`);
    };

    // ================== MODULES ==================
    delete window.$;
    let wp;
    try {
        wp = webpackChunkdiscord_app.push([[Symbol()], {}, r => r]);
        webpackChunkdiscord_app.pop();
    } catch { return; }

    const getMod = fn => {
        for (const m of Object.values(wp.c)) {
            const e = m?.exports;
            if (!e) continue;
            for (const v of [e.A, e.Ay, e.Z, e.default, e.Bo, e.h, e]) if (v && fn(v)) return v;
        }
        return null;
    };

    const Quests = getMod(m => m.getQuest && m.quests) || Object.values(wp.c).find(x => x?.exports?.A?.__proto__?.getQuest)?.exports?.A;
    const API = getMod(m => m.post && m.get) || Object.values(wp.c).find(x => x?.exports?.Bo?.get)?.exports?.Bo;

    if (!Quests || !API) { print("Не удалось загрузить модули Discord", "error"); return; }

    // ================== STATE ==================
    let list = [];
    let chosen = new Set();
    let running = false;
    let stopped = false;
    let currentFilter = "video";

    function loadQuests() {
        list = [];
        let raw = [];
        try { raw = Quests.quests instanceof Map ? [...Quests.quests.values()] : Object.values(Quests.quests || {}); } catch {}

        raw.forEach(q => {
            try {
                if (q.userStatus?.completedAt) return;
                const cfg = q.config?.taskConfig ?? q.config?.taskConfigV2;
                if (!cfg?.tasks) return;

                const type = Object.keys(cfg.tasks).find(t => t.includes("VIDEO") || t === "PLAY_ON_DESKTOP");
                if (!type) return;

                list.push({
                    id: q.id,
                    name: q.config?.messages?.questName || q.config?.application?.name || "Quest",
                    needed: cfg.tasks[type].target || 0,
                    done: q.userStatus?.progress?.[type]?.value || 0,
                    video: type.includes("VIDEO"),
                    game: type === "PLAY_ON_DESKTOP",
                    enrolled: !!q.userStatus?.enrolledAt
                });
            } catch {}
        });

        list.sort((a, b) => (b.enrolled - a.enrolled) || (b.video - a.video));
    }

    loadQuests();
    if (!list.length) { print("Нет доступных квестов", "warn"); return; }

    // ================== ACTIONS ==================
    async function enrollQuest(q) {
        if (q.enrolled) return true;
        if (!CONFIG.autoEnroll) return false;

        for (const loc of [0, 1, 2, 11, 13]) {
            try {
                const r = await API.post({ url: `/quests/${q.id}/enroll`, body: { location: loc } });
                if (r?.body) {
                    q.enrolled = true;
                    await sleep(1000);
                    return true;
                }
            } catch {}
            await sleep(280);
        }
        return false;
    }

    async function claimQuest(q) {
        if (!CONFIG.autoClaim) return;
        try { await API.post({ url: `/quests/${q.id}/claim-reward`, body: { location: 0 } }); } catch {}
    }

    async function doVideo(q) {
        let done = q.done;
        const total = q.needed;

        while (done < total && !stopped) {
            const step = CONFIG.videoSpeed + rand(-0.35, 0.65);
            await sleep(1350 + rand(0, 380));

            try {
                await API.post({ url: `/quests/${q.id}/video-progress`, body: { timestamp: done + step } });
                done += step;
                q.done = done;
                updateBar(q.id, Math.floor((done / total) * 100));
            } catch (e) {
                if (String(e).includes("429") || String(e).includes("captcha")) {
                    print("Защита Discord. Долгая пауза...", "warn");
                    await sleep(rand(350000, 550000));
                    break;
                }
            }
        }
        if (done >= total) await claimQuest(q);
    }

    async function doGame(q) {
        await sleep(Math.min(q.needed * 800, 180000));
        await claimQuest(q);
    }

    // ================== UI ==================
    let ui = null;
    let miniUI = null;

    function buildUI() {
        if (ui) ui.remove();

        ui = document.createElement("div");
        ui.style.cssText = "position:fixed;top:65px;right:16px;z-index:999999;";

        ui.innerHTML = `
            <div style="width:358px;background:rgba(27,27,29,0.95);backdrop-filter:blur(44px)saturate(190%);border:1px solid rgba(255,255,255,0.09);border-radius:20px;padding:15px 17px;color:#F5F5F7;font-family:-apple-system,BlinkMacSystemFont,sans-serif;box-shadow:0 25px 80px rgba(0,0,0,0.6);">
                
                <!-- Header -->
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:11px;cursor:move;" id="df-drag">
                    <div style="display:flex;align-items:center;gap:9px;">
                        <div style="width:26px;height:26px;background:linear-gradient(135deg,#5E5CE6,#0A84FF);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:14px;box-shadow:0 2px 8px rgba(94,92,230,0.4);">👓</div>
                        <div>
                            <div style="font-weight:700;font-size:16px;letter-spacing:-0.2px;">DisOrbsFarm</div>
                            <div style="font-size:9.5px;color:#8E8E93;margin-top:-1px;">v7.0 • Clean</div>
                        </div>
                    </div>
                    <div style="display:flex;gap:4px;">
                        <button id="df-min" style="width:23px;height:23px;background:rgba(255,255,255,0.1);border:none;border-radius:6px;font-size:13px;color:#8E8E93;cursor:pointer;">−</button>
                        <button id="df-set" style="width:23px;height:23px;background:rgba(255,255,255,0.1);border:none;border-radius:6px;font-size:12px;cursor:pointer;">⚙</button>
                        <button id="df-x" style="width:21px;height:21px;background:rgba(255,69,58,0.2);color:#FF453A;border:none;border-radius:50%;font-size:12px;font-weight:700;cursor:pointer;">✕</button>
                    </div>
                </div>

                <!-- Stats -->
                <div style="display:flex;gap:5px;margin-bottom:9px;">
                    <div style="flex:1;background:rgba(255,255,255,0.055);border-radius:9px;padding:6px 8px;font-size:10px;">
                        <div style="color:#8E8E93;">КВЕСТОВ</div>
                        <div id="df-qcount" style="font-weight:700;font-size:15px;">0</div>
                    </div>
                    <div style="flex:1;background:rgba(255,255,255,0.055);border-radius:9px;padding:6px 8px;font-size:10px;">
                        <div style="color:#8E8E93;">ВРЕМЯ</div>
                        <div id="df-time" style="font-weight:700;font-size:15px;">00:00</div>
                    </div>
                </div>

                <!-- Settings -->
                <div id="df-settings" style="display:none;background:rgba(19,19,21,0.97);border-radius:11px;padding:11px;margin-bottom:9px;font-size:12px;border:1px solid rgba(255,255,255,0.08);">
                    <div style="margin-bottom:7px;">
                        <div style="color:#8E8E93;margin-bottom:3px;font-size:11px;">Режим</div>
                        <select id="df-level" style="width:100%;padding:5px 7px;border-radius:6px;background:#2b2d31;color:#fff;border:1px solid #3f4147;">
                            <option value="1">⚡ Быстрый</option>
                            <option value="2" selected>⚖ Баланс</option>
                            <option value="3">🛡 Безопасный</option>
                        </select>
                    </div>

                    <label style="display:flex;align-items:center;gap:5px;margin:2px 0;"><input type="checkbox" id="df-enroll" checked> Автопринятие</label>
                    <label style="display:flex;align-items:center;gap:5px;margin:2px 0;"><input type="checkbox" id="df-claim"> Автоклейм <span style="color:#FF453A;font-size:9.5px;">(риск)</span></label>
                    <label style="display:flex;align-items:center;gap:5px;margin:2px 0;"><input type="checkbox" id="df-nopause"> Без пауз <span style="color:#FF9F0A;font-size:9.5px;">(риск)</span></label>
                    <label style="display:flex;align-items:center;gap:5px;margin:2px 0;"><input type="checkbox" id="df-notify" checked> Уведомления</label>

                    <div style="margin-top:8px;">
                        <div style="color:#8E8E93;margin-bottom:2px;font-size:11px;">Скорость видео</div>
                        <input type="range" id="df-speed" min="1.5" max="11" step="0.5" value="4" style="width:100%;">
                        <div style="display:flex;justify-content:space-between;font-size:9.5px;color:#8E8E93;margin-top:1px;"><span>1.5</span><span id="df-spval">4.0</span><span>11</span></div>
                    </div>
                </div>

                <!-- Filters -->
                <div style="display:flex;gap:4px;margin-bottom:7px;">
                    <button id="df-fvideo" style="flex:1;padding:5.5px 0;border-radius:7px;border:none;background:#0A84FF;color:white;font-size:11px;font-weight:600;">🎬 Видео</button>
                    <button id="df-fgame" style="flex:1;padding:5.5px 0;border-radius:7px;border:none;background:rgba(255,255,255,0.1);color:#F5F5F7;font-size:11px;font-weight:500;">🎮 Игры</button>
                    <button id="df-refresh" style="padding:5.5px 9px;border-radius:7px;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.06);color:#F5F5F7;font-size:12px;cursor:pointer;">🔄</button>
                </div>

                <div id="df-status" style="font-size:10.5px;color:#8E8E93;margin-bottom:3px;">Готов</div>
                <div style="background:rgba(255,255,255,0.07);border-radius:999px;height:3.5px;margin-bottom:7px;"><div id="df-bar" style="background:linear-gradient(#0A84FF,#5E5CE6);height:100%;width:0%;transition:width .3s;border-radius:999px;"></div></div>

                <div id="df-list" style="max-height:158px;overflow-y:auto;font-size:11.5px;margin-bottom:9px;"></div>

                <div style="display:flex;gap:7px;">
                    <button id="df-start" style="flex:1;background:#0A84FF;color:white;border:none;border-radius:9px;padding:10px 0;font-weight:700;font-size:13.5px;cursor:pointer;">СТАРТ</button>
                    <button id="df-stop" style="flex:1;background:rgba(255,255,255,0.1);color:#F5F5F7;border:1px solid rgba(255,255,255,0.2);border-radius:9px;padding:10px 0;font-weight:700;font-size:13.5px;cursor:pointer;display:none;">СТОП</button>
                </div>

                <div style="margin-top:8px;text-align:center;font-size:8.5px;color:#636366;">Только для образовательных целей • © 2026 KDStudio</div>
            </div>
        `;

        document.body.appendChild(ui);

        // Drag
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
        document.addEventListener("mousemove", e => { if (drag) { ui.style.left = (e.clientX - ox) + "px"; ui.style.top = (e.clientY - oy) + "px"; } });
        document.addEventListener("mouseup", () => drag = false);

        ui.querySelector("#df-min").onclick = minimizeUI;
        setupInterface();
    }

    function setupInterface() {
        const listEl = ui.querySelector("#df-list");
        const fVideo = ui.querySelector("#df-fvideo");
        const fGame = ui.querySelector("#df-fgame");
        const ref = ui.querySelector("#df-refresh");
        const settingsBox = ui.querySelector("#df-settings");
        const setBtn = ui.querySelector("#df-set");

        function drawList() {
            listEl.innerHTML = "";
            let filtered = list;
            if (currentFilter === "video") filtered = list.filter(q => q.video);
            else if (currentFilter === "game") filtered = list.filter(q => q.game);

            filtered.forEach(q => {
                const row = document.createElement("div");
                row.style.cssText = "padding:5px 7px;border-bottom:1px solid rgba(255,255,255,0.05);display:flex;align-items:center;gap:7px;";
                const isChecked = chosen.has(q.id) ? "checked" : "";
                const pct = q.needed > 0 ? Math.floor((q.done / q.needed) * 100) : 0;

                row.innerHTML = `
                    <input type="checkbox" ${isChecked} style="accent-color:#0A84FF;width:15px;height:15px;">
                    <div style="flex:1;min-width:0;">
                        <div style="font-weight:600;font-size:11.5px;">${q.video ? "🎬" : "🎮"} ${q.name}</div>
                        <div style="height:2.5px;background:rgba(255,255,255,0.1);border-radius:999px;margin-top:2px;"><div style="height:100%;width:${pct}%;background:linear-gradient(#0A84FF,#5E5CE6);border-radius:999px;"></div></div>
                    </div>
                    <div style="font-size:9.5px;color:#8E8E93;min-width:42px;text-align:right;">${Math.floor(q.done)}/${q.needed}s</div>
                `;

                const chk = row.querySelector("input");
                chk.onchange = () => chk.checked ? chosen.add(q.id) : chosen.delete(q.id);
                listEl.appendChild(row);
            });
        }

        drawList();

        fVideo.onclick = () => { currentFilter = "video"; fVideo.style.background = "#0A84FF"; fVideo.style.color = "white"; fGame.style.background = "rgba(255,255,255,0.1)"; fGame.style.color = "#F5F5F7"; drawList(); };
        fGame.onclick = () => { currentFilter = "game"; fGame.style.background = "#0A84FF"; fGame.style.color = "white"; fVideo.style.background = "rgba(255,255,255,0.1)"; fVideo.style.color = "#F5F5F7"; drawList(); };
        fVideo.style.background = "#0A84FF"; fVideo.style.color = "white";

        ref.onclick = () => { loadQuests(); chosen.clear(); drawList(); print("Квесты обновлены", "info"); };

        let open = false;
        setBtn.onclick = () => { open = !open; settingsBox.style.display = open ? "block" : "none"; };

        ui.querySelector("#df-level").onchange = e => setLevel(parseInt(e.target.value));
        ui.querySelector("#df-enroll").onchange = e => CONFIG.autoEnroll = e.target.checked;
        ui.querySelector("#df-claim").onchange = e => CONFIG.autoClaim = e.target.checked;
        ui.querySelector("#df-nopause").onchange = e => CONFIG.disablePauses = e.target.checked;
        ui.querySelector("#df-notify").onchange = e => CONFIG.notifications = e.target.checked;

        const sp = ui.querySelector("#df-speed");
        const spv = ui.querySelector("#df-spval");
        sp.oninput = () => { CONFIG.videoSpeed = parseFloat(sp.value); spv.textContent = CONFIG.videoSpeed.toFixed(1); };

        ui.querySelector("#df-start").onclick = runSession;
        ui.querySelector("#df-stop").onclick = () => { stopped = true; running = false; };
        ui.querySelector("#df-x").onclick = () => ui.remove();
    }

    function minimizeUI() {
        if (!ui) return;
        ui.style.display = "none";
        if (!miniUI) {
            miniUI = document.createElement("div");
            miniUI.style.cssText = "position:fixed;top:18px;right:18px;background:rgba(27,27,29,0.96);backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,0.12);border-radius:999px;padding:4px 11px;display:flex;align-items:center;gap:7px;z-index:999999;";
            miniUI.innerHTML = `<div style="display:flex;align-items:center;gap:5px;"><div style="width:17px;height:17px;background:linear-gradient(#5E5CE6,#0A84FF);border-radius:5px;display:flex;align-items:center;justify-content:center;font-size:9px;">👓</div><div style="font-weight:600;font-size:11.5px;">DisOrbsFarm</div></div><button style="background:#0A84FF;color:white;border:none;border-radius:999px;padding:1px 8px;font-size:9.5px;font-weight:600;cursor:pointer;">Открыть</button>`;
            document.body.appendChild(miniUI);
            miniUI.querySelector("button").onclick = () => { miniUI.remove(); miniUI = null; ui.style.display = "block"; };
        }
    }

    function updateBar(id, pct) {
        // Можно улучшить, но для стабильности оставлено минимально
    }

    async function runSession() {
        if (running) return;
        running = true;
        stopped = false;

        let toRun = list.filter(q => chosen.has(q.id));
        if (toRun.length === 0) toRun = list.slice(0, 5);

        ui.querySelector("#df-start").style.display = "none";
        ui.querySelector("#df-stop").style.display = "block";

        for (let i = 0; i < toRun.length; i++) {
            if (stopped) break;
            const q = toRun[i];

            const ok = await enrollQuest(q);
            if (!ok && !q.enrolled) continue;

            try {
                if (q.video) await doVideo(q);
                else if (q.game) await doGame(q);
            } catch (e) {
                print("Ошибка: " + e.message, "error");
            }

            if (!CONFIG.disablePauses && i < toRun.length - 1 && !stopped) {
                const p = rand(...CONFIG.pauseRange);
                for (let s = p; s > 0 && !stopped; s--) {
                    ui.querySelector("#df-status").textContent = `Пауза ${s}с`;
                    await sleep(1000);
                }
            }
        }

        running = false;
        ui.querySelector("#df-start").style.display = "block";
        ui.querySelector("#df-stop").style.display = "none";
        ui.querySelector("#df-status").textContent = `Готов • ${toRun.length} квестов`;

        notify("DisOrbsFarm", `Завершено ${toRun.length} квестов`);
        print("Сессия завершена", "success");
    }

    // Запуск
    if (true) {
        buildUI();
        print("DisOrbsFarm v7.0 готов к работе", "success");
    }

    window.closeOrbsFarmer = () => { if (ui) ui.remove(); if (miniUI) miniUI.remove(); };
})();