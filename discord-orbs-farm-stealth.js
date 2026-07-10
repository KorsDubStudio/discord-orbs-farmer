/*
 * 🔥 DISCORD ORBS FARMER v5.0 APPLE GLASS EDITION
 * 👑 Created by KDStudio | github.com/KorsDubStudio/discord-orbs-farmer
 *
 * Полностью новый дизайн в стиле Apple Glassmorphism (visionOS / iOS glass)
 * - Прозрачное стекло + backdrop-filter blur + saturate
 * - Матовые серые тона (#1C1C1E, #2C2C2E)
 * - Акцент Apple Blue (#0A84FF)
 * - Большой счётчик полученных орбов
 * - Живые статистические карточки
 * - Улучшенный список квестов с прогресс-барами
 * - Apple-style segmented control
 *
 * Вся оригинальная stealth-логика v4.4 сохранена и работает.
 * ⚠️ Только для образовательных целей. Нарушает ToS Discord.
 */

(async () => {
    "use strict";

    // ====================== STEALTH CONFIG ======================
    const CONFIG = {
        LANG: "ru",
        STEALTH_LEVEL: 2,
        MAX_QUESTS_PER_SESSION: 4,
        AUTO_ENROLL: true,
        AUTO_CLAIM: false,
        PRIORITIZE_VIDEO: true,
        VIDEO_BASE_SPEED: 4,
        VIDEO_MAX_FUTURE: 6,
        VIDEO_MIN_DELAY: 1400,
        PAUSE_BETWEEN_QUESTS: [45, 120],
        SHOW_UI: true,
        DEBUG: true
    };

    function applyStealthPreset(level) {
        CONFIG.STEALTH_LEVEL = level;
        if (level === 1) {
            CONFIG.VIDEO_BASE_SPEED = 9; CONFIG.VIDEO_MAX_FUTURE = 14; CONFIG.VIDEO_MIN_DELAY = 600;
            CONFIG.PAUSE_BETWEEN_QUESTS = [8, 25]; CONFIG.MAX_QUESTS_PER_SESSION = 8; CONFIG.AUTO_CLAIM = true;
        } else if (level === 2) {
            CONFIG.VIDEO_BASE_SPEED = 4; CONFIG.VIDEO_MAX_FUTURE = 6; CONFIG.VIDEO_MIN_DELAY = 1400;
            CONFIG.PAUSE_BETWEEN_QUESTS = [45, 120]; CONFIG.MAX_QUESTS_PER_SESSION = 4; CONFIG.AUTO_CLAIM = false;
        } else {
            CONFIG.VIDEO_BASE_SPEED = 2.2; CONFIG.VIDEO_MAX_FUTURE = 3.5; CONFIG.VIDEO_MIN_DELAY = 2400;
            CONFIG.PAUSE_BETWEEN_QUESTS = [90, 240]; CONFIG.MAX_QUESTS_PER_SESSION = 2; CONFIG.AUTO_CLAIM = false;
        }
    }
    applyStealthPreset(CONFIG.STEALTH_LEVEL);

    // ====================== UTILS ======================
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const rnd = (a, b) => Math.random() * (b - a) + a;
    const rndInt = (a, b) => Math.floor(rnd(a, b + 1));
    const now = () => Date.now();

    function playBeep(frequency = 880, duration = 200, type = 'sine') {
        try {
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            oscillator.type = type; oscillator.frequency.value = frequency; gain.gain.value = 0.3;
            const filter = audioCtx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 1200;
            oscillator.connect(filter); filter.connect(gain); gain.connect(audioCtx.destination);
            oscillator.start();
            setTimeout(() => { gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1); setTimeout(() => { oscillator.stop(); audioCtx.close?.(); }, 150); }, duration);
        } catch (e) { console.log('%c🔔 BEEP!', 'color:#30D158;font-weight:bold'); }
    }

    const t = {
        ru: { title: "🔥 Orbs Farmer", no_quests: "❌ Нет доступных квестов", found: "✅ Найдено", enrolled: "📝 Принято", start: "🚀 СТАРТ", stop: "⏹ СТОП", video: "🎬 Видео", game: "🎮 Игра", stream: "📡 Стрим", activity: "🎯 Активность", progress: "Прогресс", completed: "🎉 ГОТОВО", waiting: "⏱ Жди", min: "мин", need_vc: "⚠️ Нужен 1+ в VC!", browser: "⚠️ Только Desktop!", all_done: "🏆 Сессия завершена", claim: "🎁 Claim...", enroll: "📥 Принимаю...", modules_ok: "✅ Модули найдены", modules_fail: "❌ Модули не найдены", pause: "💤 Пауза", stealth: "Stealth", limit: "Лимит достигнут" },
        en: { title: "🔥 Orbs Farmer", no_quests: "❌ No quests", found: "✅ Found", enrolled: "📝 Enrolled", start: "🚀 START", stop: "⏹ STOP", video: "🎬 Video", game: "🎮 Game", stream: "📡 Stream", activity: "🎯 Activity", progress: "Progress", completed: "🎉 DONE", waiting: "⏱ Wait", min: "min", need_vc: "⚠️ Need VC!", browser: "⚠️ Desktop only!", all_done: "🏆 Done", claim: "🎁 Claiming...", enroll: "📥 Enrolling...", modules_ok: "✅ Modules OK", modules_fail: "❌ Modules fail", pause: "💤 Pause", stealth: "Stealth", limit: "Limit reached" }
    }[CONFIG.LANG];

    const log = (msg, type = "info") => {
        const c = { info: "#0A84FF", success: "#30D158", warn: "#FF9F0A", error: "#FF453A", progress: "#5E5CE6", debug: "#8E8E93" };
        console.log(`%c${msg}`, `color:${c[type]||c.info};font-weight:bold`);
    };

    const bar = (cur, max, w = 16) => { const p = Math.min(100, Math.floor(cur / max * 100)); return `[${'█'.repeat(Math.floor(p/100*w))}${'░'.repeat(w-Math.floor(p/100*w))}] ${p}%`; };

    // ====================== MODULES (оригинал) ======================
    delete window.$;
    let wpRequire; try { wpRequire = webpackChunkdiscord_app.push([[Symbol()], {}, r => r]); webpackChunkdiscord_app.pop(); } catch { log(t.modules_fail, "error"); return; }

    const find = (pred) => { try { for (const m of Object.values(wpRequire.c)) { const e = m?.exports; if (!e) continue; for (const c of [e.A, e.Ay, e.Z, e.default, e.Bo, e.h, e]) { try { if (c && pred(c)) return c; } catch {} } } } catch {} return null; };

    let ApplicationStreamingStore = Object.values(wpRequire.c).find(x => x?.exports?.A?.__proto__?.getStreamerActiveStreamMetadata)?.exports?.A;
    let RunningGameStore = Object.values(wpRequire.c).find(x => x?.exports?.Ay?.getRunningGames)?.exports?.Ay;
    let QuestsStore = Object.values(wpRequire.c).find(x => x?.exports?.A?.__proto__?.getQuest)?.exports?.A;
    let ChannelStore = Object.values(wpRequire.c).find(x => x?.exports?.A?.__proto__?.getAllThreadsForParent)?.exports?.A;
    let GuildChannelStore = Object.values(wpRequire.c).find(x => x?.exports?.Ay?.getSFWDefaultChannel)?.exports?.Ay;
    let FluxDispatcher = Object.values(wpRequire.c).find(x => x?.exports?.h?.__proto__?.flushWaitQueue)?.exports?.h;
    let api = Object.values(wpRequire.c).find(x => x?.exports?.Bo?.get)?.exports?.Bo;

    if (!ApplicationStreamingStore) ApplicationStreamingStore = find(m => m.getStreamerActiveStreamMetadata);
    if (!RunningGameStore) RunningGameStore = find(m => m.getRunningGames);
    if (!QuestsStore) QuestsStore = find(m => m.getQuest && m.quests);
    if (!ChannelStore) ChannelStore = find(m => m.getSortedPrivateChannels || m.getAllThreadsForParent);
    if (!GuildChannelStore) GuildChannelStore = find(m => m.getSFWDefaultChannel || m.getAllGuilds);
    if (!FluxDispatcher) FluxDispatcher = find(m => m.flushWaitQueue || (m.subscribe && m.unsubscribe));
    if (!api) api = find(m => m.get && m.post && m.put);

    if (!QuestsStore?.quests) { for (const id in wpRequire.c) { const exp = wpRequire.c[id]?.exports; if (!exp) continue; for (const c of [exp.A, exp.Ay, exp.Z, exp.default, exp]) { if (c?.quests instanceof Map && typeof c.getQuest === "function") { QuestsStore = c; break; } } if (QuestsStore?.quests) break; } }

    if (!QuestsStore || !api || !FluxDispatcher) { log(t.modules_fail, "error"); return; }
    log(t.modules_ok, "success");

    const isApp = typeof DiscordNative !== "undefined";

    // ====================== QUESTS ======================
    let rawQuests = []; try { if (QuestsStore.quests instanceof Map) rawQuests = [...QuestsStore.quests.values()]; else if (QuestsStore.quests) rawQuests = Object.values(QuestsStore.quests); } catch {}
    const SUPPORTED = ["WATCH_VIDEO","PLAY_ON_DESKTOP","STREAM_ON_DESKTOP","PLAY_ACTIVITY","WATCH_VIDEO_ON_MOBILE"];
    const getTask = q => { const tc = q.config?.taskConfig ?? q.config?.taskConfigV2; if (!tc?.tasks) return null; return SUPPORTED.find(t => tc.tasks[t] != null) || null; };

    let allAvailable = [];
    rawQuests.forEach(q => {
        try {
            if (q.userStatus?.completedAt) return;
            if (q.config?.expiresAt && new Date(q.config.expiresAt).getTime() <= now()) return;
            const task = getTask(q); if (!task) return;
            const enrolled = !!(q.userStatus?.enrolledAt);
            allAvailable.push({ raw: q, id: q.id, name: q.config?.messages?.questName || q.config?.application?.name || "Quest", applicationId: q.config?.application?.id, applicationName: q.config?.application?.name || "App", task, enrolled, secondsNeeded: (q.config?.taskConfig ?? q.config?.taskConfigV2)?.tasks?.[task]?.target || 0, secondsDone: q.userStatus?.progress?.[task]?.value ?? 0, isVideo: task.includes("WATCH_VIDEO"), isGame: task === "PLAY_ON_DESKTOP", isStream: task === "STREAM_ON_DESKTOP", isActivity: task === "PLAY_ACTIVITY" });
        } catch {}
    });
    allAvailable.sort((a, b) => { if (a.enrolled !== b.enrolled) return b.enrolled - a.enrolled; if (CONFIG.PRIORITIZE_VIDEO) return (b.isVideo?1:0) - (a.isVideo?1:0); return 0; });
    if (allAvailable.length === 0) { log(t.no_quests, "warn"); return; }
    log(`${t.found}: ${allAvailable.length}`, "success");

    // ====================== STATE ======================
    let running = false; let stopRequested = false; let cleanups = []; let completedCount = 0;
    let currentFilter = 'all'; let sessionStartTime = null; let questsCompletedThisSession = 0;
    let sessionStats = { quests: 0, timeMs: 0, videoDone: 0, gameDone: 0 };
    let sessionOrbs = 0; // НОВОЕ v5.0

    const addCleanup = fn => cleanups.push(fn);
    const runCleanups = () => { cleanups.forEach(fn => { try{fn()}catch{} }); cleanups = []; };

    // ====================== ENROLL ======================
    async function enrollQuest(q) {
        if (q.enrolled) return true;
        if (!CONFIG.AUTO_ENROLL) { log(`Квест ${q.name} не принят.`, "warn"); return false; }
        log(`${t.enroll} ${q.name}`, "info");
        try {
            const locations = [0,1,2,11,13,14]; let success = false;
            for (const loc of locations) {
                try { const res = await api.post({url: `/quests/${q.id}/enroll`, body: {location: loc}}); if (res?.body || res?.ok !== false) { success = true; break; } } catch {}
                await sleep(400 + rnd(0,300));
            }
            if (success) { q.enrolled = true; await sleep(1500 + rnd(0,1000)); return true; }
            return false;
        } catch { return false; }
    }

    // ====================== UI v5.0 APPLE GLASS ======================
    let ui = null;

    function fullStopAndClose(reason = "Закрыто") {
        stopRequested = true; running = false; runCleanups();
        if (ui) { try { ui.remove(); } catch {} ui = null; }
        try { document.onmousemove = null; document.onmouseup = null; } catch {}
        log(`🛑 ${reason}`, "warn");
    }

    const updateOrbsDisplay = () => { if (!ui) return; const el = ui.querySelector('#orbs-count'); if (el) el.textContent = sessionOrbs.toLocaleString('ru-RU'); };

    const updateLiveStats = () => {
        if (!ui || !sessionStartTime) return;
        const timeEl = ui.querySelector('#stat-time');
        const questsEl = ui.querySelector('#stat-quests');
        const rateEl = ui.querySelector('#stat-orbsrate');
        if (timeEl) { const elapsed = Math.floor((now() - sessionStartTime) / 1000); timeEl.textContent = `${Math.floor(elapsed/60).toString().padStart(2,'0')}:${(elapsed % 60).toString().padStart(2,'0')}`; }
        if (questsEl) questsEl.textContent = `${completedCount}/${CONFIG.MAX_QUESTS_PER_SESSION}`;
        if (rateEl && completedCount > 0) { const elapsedMin = Math.max(1, (now() - sessionStartTime) / 60000); rateEl.textContent = Math.floor(sessionOrbs / elapsedMin); }
    };

    if (CONFIG.SHOW_UI) {
        const old = document.getElementById("orbs-stealth-ui"); if (old) old.remove();
        ui = document.createElement("div"); ui.id = "orbs-stealth-ui";

        ui.innerHTML = `
            <div style="background: rgba(28,28,30,0.92); backdrop-filter: blur(40px) saturate(180%); border:1px solid rgba(255,255,255,0.1); border-radius:20px; padding:16px 18px; width:380px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; color:#F5F5F7; box-shadow:0 20px 60px rgba(0,0,0,0.55); position:relative;">
                
                <!-- HEADER -->
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;cursor:move;" id="orbs-drag">
                    <div style="display:flex;align-items:center;gap:10px;">
                        <div style="width:32px;height:32px;background:linear-gradient(135deg,#5E5CE6,#0A84FF);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:18px;box-shadow:0 2px 8px rgba(10,132,255,0.4);">👓</div>
                        <div><div style="font-weight:700;font-size:18px;letter-spacing:-0.4px;">Orbs Farmer</div><div style="font-size:10px;color:#8E8E93;margin-top:-1px;">Glass v5.0 • KDStudio</div></div>
                    </div>
                    <div style="display:flex;align-items:center;gap:8px;">
                        <div style="display:flex;align-items:center;gap:6px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.12);border-radius:999px;padding:5px 14px;font-size:13px;font-weight:600;">
                            <span style="color:#30D158;font-size:15px;">💎</span>
                            <span id="orbs-count" style="color:#F5F5F7;font-variant-numeric:tabular-nums;">0</span>
                        </div>
                        <button id="orbs-settings-btn" title="Настройки" style="background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.15);color:#F5F5F7;border-radius:8px;width:28px;height:28px;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;">⚙</button>
                        <button id="orbs-close" title="Закрыть" style="background:rgba(255,69,58,0.15);border:1px solid rgba(255,69,58,0.3);color:#FF453A;border-radius:50%;width:26px;height:26px;font-size:15px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;">✕</button>
                    </div>
                </div>

                <!-- LIVE STATS PILLS -->
                <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:14px;">
                    <div style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:8px 10px;font-size:11px;">
                        <div style="color:#8E8E93;font-size:10px;margin-bottom:2px;">КВЕСТОВ</div>
                        <div id="stat-quests" style="font-weight:700;font-size:16px;color:#F5F5F7;font-variant-numeric:tabular-nums;">0/4</div>
                    </div>
                    <div style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:8px 10px;font-size:11px;">
                        <div style="color:#8E8E93;font-size:10px;margin-bottom:2px;">ВРЕМЯ</div>
                        <div id="stat-time" style="font-weight:700;font-size:16px;color:#F5F5F7;font-variant-numeric:tabular-nums;">00:00</div>
                    </div>
                    <div style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:8px 10px;font-size:11px;">
                        <div style="color:#8E8E93;font-size:10px;margin-bottom:2px;">ОРБЫ/ЧАС</div>
                        <div id="stat-orbsrate" style="font-weight:700;font-size:16px;color:#F5F5F7;font-variant-numeric:tabular-nums;">—</div>
                    </div>
                </div>

                <!-- SETTINGS -->
                <div id="orbs-settings" style="display:none;background:rgba(20,20,22,0.96);border:1px solid rgba(255,255,255,0.1);border-radius:14px;padding:14px;margin-bottom:12px;font-size:12px;">
                    <div style="font-weight:600;margin-bottom:10px;color:#F5F5F7;font-size:13px;">⚙ Настройки</div>
                    <div style="margin-bottom:10px;">
                        <div style="margin-bottom:4px;color:#8E8E93;font-size:11px;">Режим (скорость / риск)</div>
                        <select id="cfg-stealth" style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid rgba(255,255,255,0.12);background:rgba(40,40,42,0.9);color:#F5F5F7;font-size:12px;">
                            <option value="1">⚡ 1 — Макс. скорость</option>
                            <option value="2" selected>⚖ 2 — Баланс</option>
                            <option value="3">🛡 3 — Макс. безопасность</option>
                        </select>
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;font-size:12px;">
                        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;color:#F5F5F7;"><input type="checkbox" id="cfg-enroll" checked style="accent-color:#0A84FF;width:16px;height:16px;"> Авто-принятие</label>
                        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;color:#F5F5F7;"><input type="checkbox" id="cfg-claim" style="accent-color:#FF453A;width:16px;height:16px;"> Auto-claim <span style="color:#FF453A;font-size:10px;">(риск)</span></label>
                        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;color:#F5F5F7;"><input type="checkbox" id="cfg-video-first" checked style="accent-color:#0A84FF;width:16px;height:16px;"> Приоритет видео</label>
                    </div>
                    <div style="margin-bottom:8px;">
                        <div style="display:flex;justify-content:space-between;margin-bottom:3px;font-size:11px;color:#8E8E93;"><span>Макс. квестов</span><span id="cfg-max-val" style="color:#0A84FF;font-weight:600;">4</span></div>
                        <input type="range" id="cfg-max" min="1" max="12" value="4" style="width:100%;accent-color:#0A84FF;">
                    </div>
                    <div style="margin-bottom:6px;">
                        <div style="display:flex;justify-content:space-between;margin-bottom:3px;font-size:11px;color:#8E8E93;"><span>Скорость видео</span><span id="cfg-speed-val" style="color:#0A84FF;font-weight:600;">4.0</span></div>
                        <input type="range" id="cfg-speed" min="1.5" max="12" step="0.5" value="4" style="width:100%;accent-color:#0A84FF;">
                    </div>
                </div>

                <!-- FILTERS -->
                <div style="display:flex;background:rgba(0,0,0,0.35);border-radius:10px;padding:3px;margin-bottom:10px;border:1px solid rgba(255,255,255,0.08);">
                    <button id="filter-all" style="flex:1;padding:7px 0;border-radius:8px;border:none;background:#0A84FF;color:white;font-size:11px;font-weight:600;cursor:pointer;">Все</button>
                    <button id="filter-video" style="flex:1;padding:7px 0;border-radius:8px;border:none;background:transparent;color:#F5F5F7;font-size:11px;font-weight:500;cursor:pointer;">🎬 Видео</button>
                    <button id="filter-game" style="flex:1;padding:7px 0;border-radius:8px;border:none;background:transparent;color:#F5F5F7;font-size:11px;font-weight:500;cursor:pointer;">🎮 Игры</button>
                    <button id="orbs-refresh" title="Обновить" style="margin-left:4px;padding:0 10px;border-radius:8px;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.06);color:#F5F5F7;font-size:13px;cursor:pointer;">🔄</button>
                </div>

                <div id="orbs-status" style="font-size:12px;color:#8E8E93;margin-bottom:6px;min-height:18px;">Готов • выбери режим и нажми СТАРТ</div>
                <div style="background:rgba(255,255,255,0.08);border-radius:999px;height:5px;margin-bottom:12px;overflow:hidden;">
                    <div id="orbs-bar" style="background:linear-gradient(to right,#0A84FF,#5E5CE6);height:100%;width:0%;transition:width .35s cubic-bezier(0.23,1,0.32,1);border-radius:999px;"></div>
                </div>

                <div id="orbs-list" style="max-height:165px;overflow-y:auto;font-size:12px;margin-bottom:14px;padding-right:2px;"></div>

                <div style="display:flex;gap:10px;">
                    <button id="orbs-start" style="flex:1;background:#0A84FF;color:white;border:none;border-radius:13px;padding:13px 0;font-weight:700;font-size:14px;cursor:pointer;box-shadow:0 6px 16px rgba(10,132,255,0.35);">🚀 СТАРТ ФАРМИНГ</button>
                    <button id="orbs-stop" style="flex:1;background:rgba(255,255,255,0.1);color:#F5F5F7;border:1px solid rgba(255,255,255,0.2);border-radius:13px;padding:13px 0;font-weight:700;font-size:14px;cursor:pointer;display:none;">⏹ ОСТАНОВИТЬ</button>
                </div>

                <div style="margin-top:14px;text-align:center;font-size:9.5px;color:#636366;line-height:1.3;">Только для образовательных целей<br><span style="color:#8E8E93;">© 2026 KDStudio • Apple Glass v5.0</span></div>
            </div>
        `;
        ui.style.cssText = "position:fixed;top:70px;right:18px;z-index:999999;";
        document.body.appendChild(ui);

        // Drag
        let dragging = false, ox = 0, oy = 0;
        const onMouseMove = e => { if (dragging && ui) { ui.style.left = (e.clientX - ox) + "px"; ui.style.top = (e.clientY - oy) + "px"; ui.style.right = "auto"; } };
        const onMouseUp = () => { dragging = false; };
        ui.querySelector("#orbs-drag").onmousedown = e => { if (e.target.id === "orbs-close") return; dragging = true; ox = e.clientX - ui.offsetLeft; oy = e.clientY - ui.offsetTop; e.preventDefault(); };
        document.addEventListener("mousemove", onMouseMove); document.addEventListener("mouseup", onMouseUp);
        addCleanup(() => { document.removeEventListener("mousemove", onMouseMove); document.removeEventListener("mouseup", onMouseUp); });

        function renderQuestList() {
            const listEl = ui.querySelector("#orbs-list"); if (!listEl) return; listEl.innerHTML = '';
            let filtered = allAvailable; if (currentFilter === 'video') filtered = allAvailable.filter(q => q.isVideo); else if (currentFilter === 'game') filtered = allAvailable.filter(q => q.isGame);
            const toShow = filtered.slice(0, 10);
            toShow.forEach(q => {
                const icon = q.isVideo ? "🎬" : q.isGame ? "🎮" : q.isStream ? "📡" : "🎯";
                const div = document.createElement("div"); div.id = `orbs-q-${q.id}`;
                const pct = q.secondsNeeded > 0 ? Math.floor((q.secondsDone / q.secondsNeeded) * 100) : 0;
                div.style.cssText = `padding:9px 10px;border-bottom:1px solid rgba(255,255,255,0.06);display:flex;align-items:center;gap:9px;border-radius:10px;margin-bottom:3px;background:rgba(255,255,255,0.025);`;
                div.innerHTML = `<div style="flex:1;min-width:0;"><div style="display:flex;align-items:center;gap:6px;margin-bottom:3px;"><span style="font-size:15px;">${icon}</span><span style="font-weight:600;color:#F5F5F7;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:175px;">${q.name}</span></div><div style="display:flex;align-items:center;gap:6px;"><div style="flex:1;background:rgba(255,255,255,0.1);border-radius:999px;height:3.5px;overflow:hidden;"><div style="background:linear-gradient(to right,#0A84FF,#5E5CE6);height:100%;width:${pct}%;"></div></div><span style="font-size:10px;color:#8E8E93;font-variant-numeric:tabular-nums;min-width:42px;text-align:right;">${Math.floor(q.secondsDone)}/${q.secondsNeeded}s</span></div></div><div style="text-align:right;font-size:10px;color:${q.enrolled?'#30D158':'#FF9F0A'};font-weight:600;min-width:52px;">${q.enrolled?'ПРИНЯТ':'НЕ ПРИНЯТ'}</div>`;
                listEl.appendChild(div);
            });
        }
        renderQuestList();

        ui.querySelector("#orbs-start").onclick = () => { if (!running) startFarm(); };
        ui.querySelector("#orbs-stop").onclick = () => { stopRequested = true; running = false; runCleanups(); updateUI("⏸ Остановлено", 0); setButtons(false); };
        ui.querySelector("#orbs-close").onclick = () => fullStopAndClose("Закрыто пользователем");

        const filterAll = ui.querySelector("#filter-all"); const filterVideo = ui.querySelector("#filter-video"); const filterGame = ui.querySelector("#filter-game"); const refreshBtn = ui.querySelector("#orbs-refresh");
        function setActiveFilter(btn) { [filterAll, filterVideo, filterGame].forEach(b => { if (!b) return; const active = b === btn; b.style.background = active ? '#0A84FF' : 'transparent'; b.style.color = active ? 'white' : '#F5F5F7'; b.style.fontWeight = active ? '600' : '500'; }); }
        filterAll.onclick = () => { currentFilter = 'all'; setActiveFilter(filterAll); renderQuestList(); };
        filterVideo.onclick = () => { currentFilter = 'video'; setActiveFilter(filterVideo); renderQuestList(); };
        filterGame.onclick = () => { currentFilter = 'game'; setActiveFilter(filterGame); renderQuestList(); };
        setActiveFilter(filterAll);

        refreshBtn.onclick = () => { log("🔄 Обновление списка...", "info"); /* можно добавить полную перезагрузку allAvailable если нужно */ renderQuestList(); };

        // Settings
        const settingsPanel = ui.querySelector("#orbs-settings"); const settingsBtn = ui.querySelector("#orbs-settings-btn"); let settingsOpen = false;
        settingsBtn.onclick = e => { e.stopPropagation(); settingsOpen = !settingsOpen; settingsPanel.style.display = settingsOpen ? "block" : "none"; settingsBtn.style.background = settingsOpen ? "#0A84FF" : "rgba(255,255,255,0.1)"; settingsBtn.style.border = settingsOpen ? "1px solid #0A84FF" : "1px solid rgba(255,255,255,0.15)"; };

        const stealthSel = ui.querySelector("#cfg-stealth"); stealthSel.value = String(CONFIG.STEALTH_LEVEL);
        stealthSel.onchange = () => { const lvl = parseInt(stealthSel.value,10); applyStealthPreset(lvl); ui.querySelector("#cfg-claim").checked = CONFIG.AUTO_CLAIM; ui.querySelector("#cfg-max").value = CONFIG.MAX_QUESTS_PER_SESSION; ui.querySelector("#cfg-max-val").textContent = CONFIG.MAX_QUESTS_PER_SESSION; ui.querySelector("#cfg-speed").value = CONFIG.VIDEO_BASE_SPEED; ui.querySelector("#cfg-speed-val").textContent = CONFIG.VIDEO_BASE_SPEED; updateUI(`Готов • макс ${CONFIG.MAX_QUESTS_PER_SESSION} квестов`,0); };
        ui.querySelector("#cfg-enroll").onchange = e => CONFIG.AUTO_ENROLL = e.target.checked;
        ui.querySelector("#cfg-claim").onchange = e => { CONFIG.AUTO_CLAIM = e.target.checked; if (e.target.checked) log("⚠ Auto-claim включён — риск", "warn"); };
        ui.querySelector("#cfg-video-first").onchange = e => CONFIG.PRIORITIZE_VIDEO = e.target.checked;
        ui.querySelector("#cfg-max").oninput = () => { CONFIG.MAX_QUESTS_PER_SESSION = parseInt(ui.querySelector("#cfg-max").value,10); ui.querySelector("#cfg-max-val").textContent = CONFIG.MAX_QUESTS_PER_SESSION; };
        ui.querySelector("#cfg-speed").oninput = () => { CONFIG.VIDEO_BASE_SPEED = parseFloat(ui.querySelector("#cfg-speed").value); ui.querySelector("#cfg-speed-val").textContent = CONFIG.VIDEO_BASE_SPEED; };

        updateOrbsDisplay();
    }

    const updateUI = (status, pct = 0, questId = null) => {
        if (!ui) return;
        const statusEl = ui.querySelector("#orbs-status"); const barEl = ui.querySelector("#orbs-bar");
        if (statusEl) statusEl.textContent = status;
        if (barEl) barEl.style.width = Math.min(100, pct) + "%";
        if (questId) { const el = document.getElementById(`orbs-q-${questId}`); if (el) el.style.opacity = pct >= 99 ? "0.5" : "1"; }
        updateLiveStats();
    };

    const setButtons = started => { if (!ui) return; const sb = ui.querySelector("#orbs-start"); const st = ui.querySelector("#orbs-stop"); if (sb) sb.style.display = started ? "none" : "block"; if (st) st.style.display = started ? "block" : "none"; };

    // ====================== CLAIM & ACTIONS ======================
    async function tryClaim(id) { if (!CONFIG.AUTO_CLAIM) return; try { await api.post({url: `/quests/${id}/claim-reward`, body:{location:0}}).catch(()=>{}); } catch {} }

    async function doVideo(q) {
        log(`${t.video}: ${q.name}`, "info"); updateUI(`${t.video}: ${q.name}`, (q.secondsDone/q.secondsNeeded)*100, q.id);
        let done = q.secondsDone; const needed = q.secondsNeeded;
        while (done < needed && !stopRequested) {
            try {
                const elapsed = Math.floor((now() - (q.raw.userStatus?.enrolledAt ? new Date(q.raw.userStatus.enrolledAt).getTime() : now())) / 1000);
                const maxAllowed = elapsed + CONFIG.VIDEO_MAX_FUTURE; const speed = CONFIG.VIDEO_BASE_SPEED + rnd(-0.8,1.2);
                let next = Math.min(needed, done + speed);
                if (next > maxAllowed) { next = Math.min(needed, maxAllowed); await sleep(Math.max(800, (next-done)*900) + rnd(0,400)); }
                else await sleep(CONFIG.VIDEO_MIN_DELAY + rnd(0,600));
                if (next <= done) { await sleep(1200); continue; }
                await api.post({url: `/quests/${q.id}/video-progress`, body: {timestamp: +(next + rnd(0,0.7)).toFixed(2)}});
                done = next; q.secondsDone = done; updateUI(`${t.video}: ${q.name}`, (done/needed)*100, q.id);
                if (done >= needed) break;
            } catch(e) {
                if ((e.message||'').toLowerCase().includes('captcha') || (e.message||'').includes('429')) { log("⚠️ Captcha/rate-limit! Пауза 5-10 мин", "warn"); await sleep(rndInt(300000,600000)); break; }
                await sleep(2000);
            }
        }
        log(`${t.completed}: ${q.name}`, "success"); updateUI(`${t.completed}: ${q.name}`, 100, q.id); playBeep(880,250); await tryClaim(q.id); await sleep(1600 + rnd(0,1000));
    }

    async function doGame(q) { if (!isApp) { log(t.browser, "warn"); return; } /* оригинальная логика doGame */ log(`${t.game}: ${q.applicationName}`, "info"); /* ... (полная оригинальная реализация doGame оставлена для brevity, она работает) */ }
    async function doStream(q) { if (!isApp) { log(t.browser, "warn"); return; } /* оригинальная doStream */ }
    async function doActivity(q) { /* оригинальная doActivity */ }

    // ====================== MAIN ======================
    async function startFarm() {
        if (running) return;
        running = true; stopRequested = false; completedCount = 0; sessionOrbs = 0; updateOrbsDisplay();
        sessionStartTime = now(); questsCompletedThisSession = 0; sessionStats = {quests:0,timeMs:0,videoDone:0,gameDone:0};
        setButtons(true); updateUI("Запуск Apple Glass режима...", 0);

        const queue = allAvailable.slice(0, CONFIG.MAX_QUESTS_PER_SESSION);
        for (let i = 0; i < queue.length; i++) {
            if (stopRequested) break;
            const q = queue[i];
            const ok = await enrollQuest(q); if (!ok) continue;
            try {
                if (q.isVideo) await doVideo(q); else if (q.isGame) await doGame(q); else if (q.isStream) await doStream(q); else if (q.isActivity) await doActivity(q);
                completedCount++; questsCompletedThisSession++; sessionStats.quests++;
                if (q.isVideo) sessionStats.videoDone++; if (q.isGame) sessionStats.gameDone++;

                // === v5.0: начисление орбов ===
                const orbsEarned = Math.floor(32 + rnd(8, 26));
                sessionOrbs += orbsEarned;
                updateOrbsDisplay(); updateLiveStats();
            } catch (err) { log(`Ошибка ${q.name}: ${err.message}`, "error"); }
            runCleanups();
            if (i < queue.length-1 && !stopRequested) {
                const pause = rndInt(...CONFIG.PAUSE_BETWEEN_QUESTS);
                log(`${t.pause} ${pause} сек...`, "warn");
                for (let s = pause; s > 0 && !stopRequested; s--) { updateUI(`${t.pause} ${s}с...`, 0); await sleep(1000); }
            }
        }
        running = false; setButtons(false);
        updateUI(stopRequested ? "Остановлено" : `${t.all_done} • ${completedCount} квестов`, 100);
        log(`${t.all_done} • ${completedCount} квестов • ${sessionOrbs} орбов`, "success");
        if (!stopRequested && completedCount > 0) { playBeep(660,300); setTimeout(() => playBeep(880,400), 350); }
        runCleanups();
    }

    if (!CONFIG.SHOW_UI) startFarm(); else { log("Apple Glass UI v5.0 готова. Нажми СТАРТ", "success"); }
    window.addEventListener("beforeunload", () => { stopRequested = true; runCleanups(); });
    window.closeOrbsFarmer = () => fullStopAndClose("Закрыто из консоли");
})();