/**
 * 🔥 DISCORD ORBS FARMER v4.4 STEALTH
 * 👑 Created by KDStudio  |  github.com/KorsDubStudio/discord-orbs-farmer
 *
 * ⚠️ ТОЛЬКО В ОБРАЗОВАТЕЛЬНЫХ ЦЕЛЯХ / FOR EDUCATIONAL PURPOSES ONLY
 * Этот скрипт создан исключительно для изучения внутреннего API Discord и механики квестов.
 * Использование автоматизации квестов нарушает Terms of Service Discord.
 * Discord с апреля 2026 активно банит за автоматизацию.
 * Автор (KDStudio) и репозиторий НЕ несут ответственности за баны, потери аккаунтов или любые последствия.
 * Используй ТОЛЬКО на свой страх и риск (желательно на тестовом/альтернативном аккаунте).
 *
 * © KDStudio — запрещено удалять кредиты и выдавать за свой продукт.
 * Если хочешь использовать/модифицировать — оставляй "Created by KDStudio".
 *
 * Возможности v4.4:
 *   - JIT-enroll + авто-принятие
 *   - Кнопка СТОП + кнопка ✕ (полностью закрыть и очистить)
 *   - Медленный видео-прогресс + stealth-паузы
 *   - UI с логотипом KDStudio + настройки
 *   - Прогресс + ETA (оставшееся время)
 *   - Фильтры: Только видео / Только игры
 *   - Звуковое уведомление при завершении
 *   - Статистика сессии
 *   - Авто-пауза при captcha / rate-limit
 *   - Кнопка обновления списка квестов 🔄
 *
 * Как использовать:
 * 1. Discord Desktop / Vesktop / Equicord
 * 2. Ctrl+Shift+I → Console → allow pasting
 * 3. Вставь код → Enter
 * 4. Появится панель → настрой фильтры / ⚙ → СТАРТ
 * 5. ✕ — полностью закрыть и очистить
 */

(async () => {
    "use strict";

    // ====================== STEALTH CONFIG ======================
    const CONFIG = {
        LANG: "ru",

        // === БЕЗОПАСНОСТЬ (чем выше — тем безопаснее, но медленнее) ===
        STEALTH_LEVEL: 2,              // 1 = рискованно/быстро, 2 = баланс, 3 = максимально осторожно
        MAX_QUESTS_PER_SESSION: 4,     // сколько квестов максимум за один запуск
        AUTO_ENROLL: true,             // автоматически принимать квесты
        AUTO_CLAIM: false,             // claim (рискованно — может вызвать captcha)
        PRIORITIZE_VIDEO: true,        // сначала видео

        // Видео
        VIDEO_BASE_SPEED: 4,
        VIDEO_MAX_FUTURE: 6,
        VIDEO_MIN_DELAY: 1400,

        // Паузы между квестами (секунды)
        PAUSE_BETWEEN_QUESTS: [45, 120],

        SHOW_UI: true,
        DEBUG: true
    };

    // Пресеты (вызывается при смене STEALTH_LEVEL или вручную)
    function applyStealthPreset(level) {
        CONFIG.STEALTH_LEVEL = level;
        if (level === 1) { // РИСК / МАКС. СКОРОСТЬ
            CONFIG.VIDEO_BASE_SPEED = 9;
            CONFIG.VIDEO_MAX_FUTURE = 14;
            CONFIG.VIDEO_MIN_DELAY = 600;
            CONFIG.PAUSE_BETWEEN_QUESTS = [8, 25];
            CONFIG.MAX_QUESTS_PER_SESSION = 8;
            CONFIG.AUTO_CLAIM = true;   // рискованно
        } else if (level === 2) { // БАЛАНС
            CONFIG.VIDEO_BASE_SPEED = 4;
            CONFIG.VIDEO_MAX_FUTURE = 6;
            CONFIG.VIDEO_MIN_DELAY = 1400;
            CONFIG.PAUSE_BETWEEN_QUESTS = [45, 120];
            CONFIG.MAX_QUESTS_PER_SESSION = 4;
            CONFIG.AUTO_CLAIM = false;
        } else { // 3 = МАКС. БЕЗОПАСНОСТЬ
            CONFIG.VIDEO_BASE_SPEED = 2.2;
            CONFIG.VIDEO_MAX_FUTURE = 3.5;
            CONFIG.VIDEO_MIN_DELAY = 2400;
            CONFIG.PAUSE_BETWEEN_QUESTS = [90, 240];
            CONFIG.MAX_QUESTS_PER_SESSION = 2;
            CONFIG.AUTO_CLAIM = false;
        }
    }
    applyStealthPreset(CONFIG.STEALTH_LEVEL);

    // ====================== UTILS ======================
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const rnd = (a, b) => Math.random() * (b - a) + a;
    const rndInt = (a, b) => Math.floor(rnd(a, b + 1));
    const now = () => Date.now();

    // Sound notification (Web Audio API - no external files needed)
    function playBeep(frequency = 880, duration = 200, type = 'sine') {
        try {
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            oscillator.type = type;
            oscillator.frequency.value = frequency;
            gain.gain.value = 0.3;
            const filter = audioCtx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 1200;
            oscillator.connect(filter);
            filter.connect(gain);
            gain.connect(audioCtx.destination);
            oscillator.start();
            setTimeout(() => {
                gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
                setTimeout(() => {
                    oscillator.stop();
                    audioCtx.close?.();
                }, 150);
            }, duration);
        } catch (e) {
            // Fallback: console beep if audio fails
            console.log('%c🔔 BEEP! (sound notification)', 'color:#57F287;font-weight:bold');
        }
    }

    const t = {
        ru: {
            title: "🔥 Orbs Farmer",
            no_quests: "❌ Нет доступных квестов",
            found: "✅ Найдено",
            enrolled: "📝 Принято",
            start: "🚀 СТАРТ",
            stop: "⏹ СТОП",
            video: "🎬 Видео",
            game: "🎮 Игра",
            stream: "📡 Стрим",
            activity: "🎯 Активность",
            progress: "Прогресс",
            completed: "🎉 ГОТОВО",
            waiting: "⏱ Жди",
            min: "мин",
            need_vc: "⚠️ Нужен 1+ человек в VC!",
            browser: "⚠️ Только Desktop!",
            all_done: "🏆 Сессия завершена",
            claim: "🎁 Claim...",
            enroll: "📥 Принимаю квест...",
            modules_ok: "✅ Модули найдены",
            modules_fail: "❌ Модули не найдены",
            pause: "💤 Пауза",
            stealth: "Режим stealth",
            limit: "Лимит квестов достигнут"
        },
        en: {
            title: "🔥 Orbs Farmer",
            no_quests: "❌ No available quests",
            found: "✅ Found",
            enrolled: "📝 Enrolled",
            start: "🚀 START",
            stop: "⏹ STOP",
            video: "🎬 Video",
            game: "🎮 Game",
            stream: "📡 Stream",
            activity: "🎯 Activity",
            progress: "Progress",
            completed: "🎉 DONE",
            waiting: "⏱ Wait",
            min: "min",
            need_vc: "⚠️ Need 1+ in VC!",
            browser: "⚠️ Desktop only!",
            all_done: "🏆 Session finished",
            claim: "🎁 Claiming...",
            enroll: "📥 Enrolling...",
            modules_ok: "✅ Modules found",
            modules_fail: "❌ Modules not found",
            pause: "💤 Pause",
            stealth: "Stealth mode",
            limit: "Quest limit reached"
        }
    }[CONFIG.LANG];

    const log = (msg, type = "info") => {
        const c = { info: "#5865F2", success: "#3BA55C", warn: "#FAA61A", error: "#F04747", progress: "#00B0F4", debug: "#949BA4" };
        console.log(`%c${msg}`, `color:${c[type]||c.info};font-weight:bold`);
    };

    const bar = (cur, max, w = 16) => {
        const p = Math.min(100, Math.floor(cur / max * 100));
        return `[${"█".repeat(Math.floor(p/100*w))}${"░".repeat(w-Math.floor(p/100*w))}] ${p}%`;
    };

    // ====================== MODULES ======================
    delete window.$;
    let wpRequire;
    try {
        wpRequire = webpackChunkdiscord_app.push([[Symbol()], {}, r => r]);
        webpackChunkdiscord_app.pop();
    } catch {
        log(t.modules_fail, "error");
        return;
    }

    const find = (pred) => {
        try {
            for (const m of Object.values(wpRequire.c)) {
                const e = m?.exports;
                if (!e) continue;
                const cands = [e.A, e.Ay, e.Z, e.default, e.Bo, e.h, e];
                for (const c of cands) {
                    try { if (c && pred(c)) return c; } catch {}
                }
            }
        } catch {}
        return null;
    };

    // Exact first
    let ApplicationStreamingStore = Object.values(wpRequire.c).find(x => x?.exports?.A?.__proto__?.getStreamerActiveStreamMetadata)?.exports?.A;
    let RunningGameStore = Object.values(wpRequire.c).find(x => x?.exports?.Ay?.getRunningGames)?.exports?.Ay;
    let QuestsStore = Object.values(wpRequire.c).find(x => x?.exports?.A?.__proto__?.getQuest)?.exports?.A;
    let ChannelStore = Object.values(wpRequire.c).find(x => x?.exports?.A?.__proto__?.getAllThreadsForParent)?.exports?.A;
    let GuildChannelStore = Object.values(wpRequire.c).find(x => x?.exports?.Ay?.getSFWDefaultChannel)?.exports?.Ay;
    let FluxDispatcher = Object.values(wpRequire.c).find(x => x?.exports?.h?.__proto__?.flushWaitQueue)?.exports?.h;
    let api = Object.values(wpRequire.c).find(x => x?.exports?.Bo?.get)?.exports?.Bo;

    // Fallbacks
    if (!ApplicationStreamingStore) ApplicationStreamingStore = find(m => m.getStreamerActiveStreamMetadata);
    if (!RunningGameStore) RunningGameStore = find(m => m.getRunningGames);
    if (!QuestsStore) QuestsStore = find(m => m.getQuest && m.quests);
    if (!ChannelStore) ChannelStore = find(m => m.getSortedPrivateChannels || m.getAllThreadsForParent);
    if (!GuildChannelStore) GuildChannelStore = find(m => m.getSFWDefaultChannel || m.getAllGuilds);
    if (!FluxDispatcher) FluxDispatcher = find(m => m.flushWaitQueue || (m.subscribe && m.unsubscribe));
    if (!api) api = find(m => m.get && m.post && m.put);

    // Deep search for QuestsStore
    if (!QuestsStore?.quests) {
        for (const id in wpRequire.c) {
            const exp = wpRequire.c[id]?.exports;
            if (!exp) continue;
            for (const c of [exp.A, exp.Ay, exp.Z, exp.default, exp]) {
                if (c?.quests instanceof Map && typeof c.getQuest === "function") {
                    QuestsStore = c;
                    break;
                }
            }
            if (QuestsStore?.quests) break;
        }
    }

    if (!QuestsStore || !api || !FluxDispatcher) {
        log(t.modules_fail, "error");
        console.log({QuestsStore:!!QuestsStore, api:!!api, FluxDispatcher:!!FluxDispatcher});
        return;
    }
    log(t.modules_ok, "success");
    log(`${t.stealth}: level ${CONFIG.STEALTH_LEVEL} | max ${CONFIG.MAX_QUESTS_PER_SESSION} quests`, "warn");

    const isApp = typeof DiscordNative !== "undefined";

    // ====================== QUESTS ======================
    let rawQuests = [];
    try {
        if (QuestsStore.quests instanceof Map) rawQuests = [...QuestsStore.quests.values()];
        else if (QuestsStore.quests) rawQuests = Object.values(QuestsStore.quests);
    } catch {}

    const SUPPORTED = ["WATCH_VIDEO","PLAY_ON_DESKTOP","STREAM_ON_DESKTOP","PLAY_ACTIVITY","WATCH_VIDEO_ON_MOBILE"];

    const getTask = q => {
        const tc = q.config?.taskConfig ?? q.config?.taskConfigV2;
        if (!tc?.tasks) return null;
        return SUPPORTED.find(t => tc.tasks[t] != null) || null;
    };

    // Собираем ВСЕ возможные квесты (enrolled + не enrolled)
    let allAvailable = [];
    rawQuests.forEach(q => {
        try {
            if (q.userStatus?.completedAt) return;
            if (q.config?.expiresAt && new Date(q.config.expiresAt).getTime() <= now()) return;
            const task = getTask(q);
            if (!task) return;

            const enrolled = !!(q.userStatus?.enrolledAt);
            allAvailable.push({
                raw: q,
                id: q.id,
                name: q.config?.messages?.questName || q.config?.application?.name || "Quest",
                applicationId: q.config?.application?.id,
                applicationName: q.config?.application?.name || "App",
                task,
                enrolled,
                secondsNeeded: (q.config?.taskConfig ?? q.config?.taskConfigV2)?.tasks?.[task]?.target || 0,
                secondsDone: q.userStatus?.progress?.[task]?.value ?? 0,
                isVideo: task.includes("WATCH_VIDEO"),
                isGame: task === "PLAY_ON_DESKTOP",
                isStream: task === "STREAM_ON_DESKTOP",
                isActivity: task === "PLAY_ACTIVITY"
            });
        } catch {}
    });

    // Сортировка: enrolled сначала, потом видео
    allAvailable.sort((a, b) => {
        if (a.enrolled !== b.enrolled) return b.enrolled - a.enrolled;
        if (CONFIG.PRIORITIZE_VIDEO) return (b.isVideo?1:0) - (a.isVideo?1:0);
        return 0;
    });

    if (allAvailable.length === 0) {
        log(t.no_quests, "warn");
        return;
    }

    log(`${t.found}: ${allAvailable.length} (enrolled: ${allAvailable.filter(q=>q.enrolled).length})`, "success");
    allAvailable.forEach((q,i) => {
        const icon = q.isVideo?"🎬":q.isGame?"🎮":q.isStream?"📡":"🎯";
        console.log(`  ${i+1}. ${icon} ${q.name} ${q.enrolled?"[принят]":"[не принят]"} ${Math.floor(q.secondsDone)}/${q.secondsNeeded}s`);
    });

    // ====================== STATE ======================
    let running = false;
    let stopRequested = false;
    let cleanups = [];
    let completedCount = 0;

    // New in v4.4
    let currentFilter = 'all'; // 'all', 'video', 'game', 'other'
    let sessionStartTime = null;
    let questsCompletedThisSession = 0;
    let sessionStats = { quests: 0, timeMs: 0, videoDone: 0, gameDone: 0 };

    const addCleanup = fn => cleanups.push(fn);
    const runCleanups = () => {
        cleanups.forEach(fn => { try{fn()}catch{} });
        cleanups = [];
    };

    // ====================== ENROLL (JIT) ======================
    async function enrollQuest(q) {
        if (q.enrolled) return true;
        if (!CONFIG.AUTO_ENROLL) {
            log(`Квест ${q.name} не принят. Включи AUTO_ENROLL или прими вручную.`, "warn");
            return false;
        }

        log(`${t.enroll} ${q.name}`, "info");
        updateUI(`Принимаю: ${q.name}`, 0);

        try {
            // location: 0 или 11 — самые частые рабочие значения
            const locations = [0, 1, 2, 11, 13, 14];
            let success = false;

            for (const loc of locations) {
                try {
                    const res = await api.post({
                        url: `/quests/${q.id}/enroll`,
                        body: { location: loc }
                    });
                    if (res?.body || res?.ok !== false) {
                        success = true;
                        break;
                    }
                } catch (e) {
                    // пробуем следующий location
                }
                await sleep(400 + rnd(0, 300));
            }

            if (success) {
                q.enrolled = true;
                log(`${t.enrolled}: ${q.name}`, "success");
                // Даём Discord время обновить store
                await sleep(1500 + rnd(0, 1000));
                return true;
            } else {
                log(`Не удалось принять ${q.name}`, "error");
                return false;
            }
        } catch (err) {
            log(`Enroll error: ${err.message}`, "error");
            return false;
        }
    }

    // ====================== UI ======================
    let ui = null;

    // Полная остановка + закрытие панели
    function fullStopAndClose(reason = "Закрыто") {
        stopRequested = true;
        running = false;
        runCleanups();
        if (ui) {
            try { ui.remove(); } catch {}
            ui = null;
        }
        // Убираем глобальные listeners если были
        try {
            document.onmousemove = null;
            document.onmouseup = null;
        } catch {}
        log(`🛑 ${reason}. Скрипт полностью остановлен и панель убрана.`, "warn");
        console.log("%c[Orbs Farmer] Можно снова вставить скрипт, если нужно.", "color:#949ba4");
    }

    if (CONFIG.SHOW_UI) {
        // Если уже есть старая панель — убираем
        const old = document.getElementById("orbs-stealth-ui");
        if (old) old.remove();

        ui = document.createElement("div");
        ui.id = "orbs-stealth-ui";
        ui.innerHTML = `
            <div style="background:linear-gradient(145deg,#1a1b1e,#2b2d31);border:1px solid #3f4147;border-radius:14px;padding:14px 16px;width:360px;font-family:gg sans,Whitney,system-ui,sans-serif;color:#dbdee1;box-shadow:0 12px 40px rgba(0,0,0,.55);position:relative;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;cursor:move;" id="orbs-drag">
                    <div>
                        <div style="font-weight:700;font-size:15px;">${t.title}</div>
                        <div style="font-size:10px;color:#949ba4;margin-top:1px;">by <span style="color:#57F287;font-weight:600;">KDStudio</span></div>
                    </div>
                    <div style="display:flex;align-items:center;gap:6px;">
                        <div id="orbs-badge" style="font-size:11px;background:#5865F2;padding:2px 8px;border-radius:10px;">STEALTH ${CONFIG.STEALTH_LEVEL}</div>
                        <button id="orbs-settings-btn" title="Настройки" style="background:#4e5058;color:white;border:none;border-radius:6px;width:26px;height:22px;font-size:13px;cursor:pointer;padding:0;">⚙</button>
                        <button id="orbs-close" title="Полностью закрыть" style="background:#f04747;color:white;border:none;border-radius:50%;width:22px;height:22px;font-size:14px;line-height:20px;cursor:pointer;padding:0;font-weight:700;">✕</button>
                    </div>
                </div>

                <!-- SETTINGS PANEL (скрыта по умолчанию) -->
                <div id="orbs-settings" style="display:none;background:#111214;border-radius:10px;padding:12px;margin-bottom:12px;font-size:12px;border:1px solid #3f4147;">
                    <div style="font-weight:600;margin-bottom:10px;color:#fff;">⚙ Настройки работы</div>
                    
                    <div style="margin-bottom:10px;">
                        <div style="margin-bottom:4px;color:#b5bac1;">Режим скорости / риска</div>
                        <select id="cfg-stealth" style="width:100%;padding:6px 8px;border-radius:6px;border:1px solid #3f4147;background:#2b2d31;color:#dbdee1;">
                            <option value="1">⚡ 1 — Макс. скорость (рискованно)</option>
                            <option value="2" selected>⚖ 2 — Баланс (рекомендуется)</option>
                            <option value="3">🛡 3 — Макс. безопасность</option>
                        </select>
                    </div>

                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;">
                        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;">
                            <input type="checkbox" id="cfg-enroll" ${CONFIG.AUTO_ENROLL ? "checked" : ""} style="accent-color:#5865F2;">
                            Авто-принятие
                        </label>
                        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;">
                            <input type="checkbox" id="cfg-claim" ${CONFIG.AUTO_CLAIM ? "checked" : ""} style="accent-color:#f04747;">
                            Auto-claim <span style="color:#f04747;font-size:10px;">(риск)</span>
                        </label>
                        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;">
                            <input type="checkbox" id="cfg-video-first" ${CONFIG.PRIORITIZE_VIDEO ? "checked" : ""} style="accent-color:#5865F2;">
                            Сначала видео
                        </label>
                    </div>

                    <div style="margin-bottom:8px;">
                        <div style="display:flex;justify-content:space-between;margin-bottom:3px;">
                            <span style="color:#b5bac1;">Макс. квестов за сессию</span>
                            <span id="cfg-max-val" style="color:#57F287;font-weight:600;">${CONFIG.MAX_QUESTS_PER_SESSION}</span>
                        </div>
                        <input type="range" id="cfg-max" min="1" max="12" value="${CONFIG.MAX_QUESTS_PER_SESSION}" style="width:100%;accent-color:#5865F2;">
                    </div>

                    <div style="margin-bottom:8px;">
                        <div style="display:flex;justify-content:space-between;margin-bottom:3px;">
                            <span style="color:#b5bac1;">Скорость видео</span>
                            <span id="cfg-speed-val" style="color:#57F287;font-weight:600;">${CONFIG.VIDEO_BASE_SPEED}</span>
                        </div>
                        <input type="range" id="cfg-speed" min="1.5" max="12" step="0.5" value="${CONFIG.VIDEO_BASE_SPEED}" style="width:100%;accent-color:#5865F2;">
                    </div>

                    <div style="font-size:10px;color:#949ba4;margin-top:6px;line-height:1.4;">
                        ⚡ Режим 1 = очень быстро, но выше риск бана/captcha<br>
                        🛡 Режим 3 = медленно, но максимально безопасно
                    </div>
                </div>

                <!-- FILTER BAR v4.4 -->
                <div style="display:flex;gap:6px;margin-bottom:8px;align-items:center;">
                    <div style="font-size:10px;color:#949ba4;margin-right:4px;">Фильтр:</div>
                    <button id="filter-all" style="flex:1;padding:3px 6px;font-size:10px;border-radius:5px;border:1px solid #5865F2;background:#5865F2;color:white;cursor:pointer;">Все</button>
                    <button id="filter-video" style="flex:1;padding:3px 6px;font-size:10px;border-radius:5px;border:1px solid #3f4147;background:#2b2d31;color:#dbdee1;cursor:pointer;">🎬 Видео</button>
                    <button id="filter-game" style="flex:1;padding:3px 6px;font-size:10px;border-radius:5px;border:1px solid #3f4147;background:#2b2d31;color:#dbdee1;cursor:pointer;">🎮 Игры</button>
                    <button id="orbs-refresh" title="Обновить список квестов без перезапуска" style="padding:3px 8px;font-size:11px;border-radius:5px;border:1px solid #3f4147;background:#4e5058;color:#dbdee1;cursor:pointer;">🔄</button>
                </div>

                <div id="orbs-status" style="font-size:12px;color:#b5bac1;margin-bottom:8px;min-height:18px;">Готов · максимум ${CONFIG.MAX_QUESTS_PER_SESSION} квестов</div>
                <div style="background:#111214;border-radius:8px;height:8px;margin-bottom:12px;overflow:hidden;">
                    <div id="orbs-bar" style="background:linear-gradient(90deg,#5865F2,#57F287);height:100%;width:0%;transition:width .4s;"></div>
                </div>
                <div id="orbs-list" style="max-height:150px;overflow-y:auto;font-size:12px;margin-bottom:12px;"></div>
                <div style="display:flex;gap:8px;">
                    <button id="orbs-start" style="flex:1;background:#5865F2;color:#fff;border:none;border-radius:8px;padding:10px;font-weight:600;cursor:pointer;font-size:13px;">${t.start}</button>
                    <button id="orbs-stop" style="flex:1;background:#4e5058;color:#fff;border:none;border-radius:8px;padding:10px;font-weight:600;cursor:pointer;font-size:13px;display:none;">${t.stop}</button>
                </div>
                <div style="font-size:10px;color:#949ba4;margin-top:10px;text-align:center;line-height:1.4;">
                    <span style="color:#f04747;font-weight:600;">⚠ Только в образовательных целях</span><br>
                    <span style="color:#57F287;">© 2026 KDStudio</span>
                </div>
            </div>
        `;
        ui.style.cssText = "position:fixed;top:70px;right:18px;z-index:999999;";
        document.body.appendChild(ui);

        // Drag
        let dragging = false, ox = 0, oy = 0;
        const onMouseMove = e => {
            if (dragging && ui) {
                ui.style.left = (e.clientX - ox) + "px";
                ui.style.top = (e.clientY - oy) + "px";
                ui.style.right = "auto";
            }
        };
        const onMouseUp = () => { dragging = false; };

        ui.querySelector("#orbs-drag").onmousedown = e => {
            if (e.target.id === "orbs-close") return;
            dragging = true;
            ox = e.clientX - ui.offsetLeft;
            oy = e.clientY - ui.offsetTop;
            e.preventDefault();
        };
        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);

        // Сохраняем для cleanup
        addCleanup(() => {
            document.removeEventListener("mousemove", onMouseMove);
            document.removeEventListener("mouseup", onMouseUp);
        });

        // List rendering function (v4.4 - supports filters)
        function renderQuestList() {
            const listEl = ui.querySelector("#orbs-list");
            if (!listEl) return;
            listEl.innerHTML = '';
            let filtered = allAvailable;
            if (currentFilter === 'video') {
                filtered = allAvailable.filter(q => q.isVideo);
            } else if (currentFilter === 'game') {
                filtered = allAvailable.filter(q => q.isGame);
            }
            const toShow = filtered.slice(0, 12);
            toShow.forEach(q => {
                const icon = q.isVideo ? "🎬" : q.isGame ? "🎮" : q.isStream ? "📡" : "🎯";
                const div = document.createElement("div");
                div.id = `orbs-q-${q.id}`;
                div.style.cssText = "padding:5px 0;border-bottom:1px solid #3f4147;display:flex;justify-content:space-between;align-items:center;";
                div.innerHTML = `
                    <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:200px;">${icon} ${q.name}</span>
                    <span style="color:${q.enrolled ? "#3BA55C" : "#FAA61A"};font-size:11px;">${q.enrolled ? "принят" : "не принят"}</span>
                `;
                listEl.appendChild(div);
            });
        }

        // Initial render
        renderQuestList();

        // Кнопки
        ui.querySelector("#orbs-start").onclick = () => { if (!running) startFarm(); };
        ui.querySelector("#orbs-stop").onclick = () => {
            stopRequested = true;
            running = false;
            runCleanups();
            updateUI("⏸ Остановлено (можно закрыть ✕)", 0);
            setButtons(false);
            log("Остановлено. Нажми ✕ чтобы полностью закрыть панель.", "warn");
        };
        ui.querySelector("#orbs-close").onclick = () => {
            fullStopAndClose("Панель закрыта пользователем");
        };

        // ===== FILTERS & REFRESH v4.4 =====
        const filterAll = ui.querySelector("#filter-all");
        const filterVideo = ui.querySelector("#filter-video");
        const filterGame = ui.querySelector("#filter-game");
        const refreshBtn = ui.querySelector("#orbs-refresh");

        function setActiveFilter(btn) {
            [filterAll, filterVideo, filterGame].forEach(b => {
                if (b) {
                    b.style.background = b === btn ? '#5865F2' : '#2b2d31';
                    b.style.border = b === btn ? '1px solid #5865F2' : '1px solid #3f4147';
                    b.style.color = b === btn ? 'white' : '#dbdee1';
                }
            });
        }

        filterAll.onclick = () => {
            currentFilter = 'all';
            setActiveFilter(filterAll);
            renderQuestList();
        };
        filterVideo.onclick = () => {
            currentFilter = 'video';
            setActiveFilter(filterVideo);
            renderQuestList();
        };
        filterGame.onclick = () => {
            currentFilter = 'game';
            setActiveFilter(filterGame);
            renderQuestList();
        };

        // Set initial active
        setActiveFilter(filterAll);

        // Refresh quests button
        refreshBtn.onclick = async () => {
            log("🔄 Обновление списка квестов...", "info");
            refreshBtn.style.opacity = '0.5';
            try {
                // Re-fetch from QuestsStore
                let rawQuests = [];
                try {
                    if (QuestsStore.quests instanceof Map) rawQuests = [...QuestsStore.quests.values()];
                    else if (QuestsStore.quests) rawQuests = Object.values(QuestsStore.quests);
                } catch {}

                // Rebuild allAvailable (similar to initial)
                const newAvailable = [];
                rawQuests.forEach(q => {
                    try {
                        if (q.userStatus?.completedAt) return;
                        if (q.config?.expiresAt && new Date(q.config.expiresAt).getTime() <= now()) return;
                        const task = getTask(q);
                        if (!task) return;

                        const enrolled = !!(q.userStatus?.enrolledAt);
                        newAvailable.push({
                            raw: q,
                            id: q.id,
                            name: q.config?.messages?.questName || q.config?.application?.name || "Quest",
                            applicationId: q.config?.application?.id,
                            applicationName: q.config?.application?.name || "App",
                            task,
                            enrolled,
                            secondsNeeded: (q.config?.taskConfig ?? q.config?.taskConfigV2)?.tasks?.[task]?.target || 0,
                            secondsDone: q.userStatus?.progress?.[task]?.value ?? 0,
                            isVideo: task.includes("WATCH_VIDEO"),
                            isGame: task === "PLAY_ON_DESKTOP",
                            isStream: task === "STREAM_ON_DESKTOP",
                            isActivity: task === "PLAY_ACTIVITY"
                        });
                    } catch {}
                });

                // Re-sort
                newAvailable.sort((a, b) => {
                    if (a.enrolled !== b.enrolled) return b.enrolled - a.enrolled;
                    if (CONFIG.PRIORITIZE_VIDEO) return (b.isVideo?1:0) - (a.isVideo?1:0);
                    return 0;
                });

                // Update global
                allAvailable.length = 0;
                newAvailable.forEach(q => allAvailable.push(q));

                renderQuestList();
                log(`✅ Список обновлён: ${allAvailable.length} квестов`, "success");
            } catch (e) {
                log(`Ошибка обновления: ${e.message}`, "error");
            }
            refreshBtn.style.opacity = '1';
        };

        // ===== НАСТРОЙКИ =====
        const settingsPanel = ui.querySelector("#orbs-settings");
        const settingsBtn = ui.querySelector("#orbs-settings-btn");
        let settingsOpen = false;

        settingsBtn.onclick = (e) => {
            e.stopPropagation();
            settingsOpen = !settingsOpen;
            settingsPanel.style.display = settingsOpen ? "block" : "none";
            settingsBtn.style.background = settingsOpen ? "#5865F2" : "#4e5058";
        };

        // Stealth preset select
        const stealthSel = ui.querySelector("#cfg-stealth");
        stealthSel.value = String(CONFIG.STEALTH_LEVEL);
        stealthSel.onchange = () => {
            const lvl = parseInt(stealthSel.value, 10);
            applyStealthPreset(lvl);
            // sync other controls
            ui.querySelector("#cfg-claim").checked = CONFIG.AUTO_CLAIM;
            ui.querySelector("#cfg-max").value = CONFIG.MAX_QUESTS_PER_SESSION;
            ui.querySelector("#cfg-max-val").textContent = CONFIG.MAX_QUESTS_PER_SESSION;
            ui.querySelector("#cfg-speed").value = CONFIG.VIDEO_BASE_SPEED;
            ui.querySelector("#cfg-speed-val").textContent = CONFIG.VIDEO_BASE_SPEED;
            ui.querySelector("#orbs-badge").textContent = `STEALTH ${lvl}`;
            updateUI(`Готов · максимум ${CONFIG.MAX_QUESTS_PER_SESSION} квестов`, 0);
            log(`Режим изменён → STEALTH ${lvl} (скорость ${CONFIG.VIDEO_BASE_SPEED}, паузы ${CONFIG.PAUSE_BETWEEN_QUESTS[0]}-${CONFIG.PAUSE_BETWEEN_QUESTS[1]}с)`, "info");
        };

        // Checkboxes
        ui.querySelector("#cfg-enroll").onchange = (e) => { CONFIG.AUTO_ENROLL = e.target.checked; };
        ui.querySelector("#cfg-claim").onchange = (e) => {
            CONFIG.AUTO_CLAIM = e.target.checked;
            if (e.target.checked) log("⚠ Auto-claim включён — повышенный риск captcha/бана", "warn");
        };
        ui.querySelector("#cfg-video-first").onchange = (e) => { CONFIG.PRIORITIZE_VIDEO = e.target.checked; };

        // Sliders
        const maxSlider = ui.querySelector("#cfg-max");
        maxSlider.oninput = () => {
            CONFIG.MAX_QUESTS_PER_SESSION = parseInt(maxSlider.value, 10);
            ui.querySelector("#cfg-max-val").textContent = CONFIG.MAX_QUESTS_PER_SESSION;
            updateUI(`Готов · максимум ${CONFIG.MAX_QUESTS_PER_SESSION} квестов`, 0);
        };

        const speedSlider = ui.querySelector("#cfg-speed");
        speedSlider.oninput = () => {
            CONFIG.VIDEO_BASE_SPEED = parseFloat(speedSlider.value);
            ui.querySelector("#cfg-speed-val").textContent = CONFIG.VIDEO_BASE_SPEED;
            // если юзер крутит скорость вручную — это уже не чистый пресет
            if (CONFIG.VIDEO_BASE_SPEED >= 8) {
                log("⚡ Высокая скорость видео — выше риск детекта", "warn");
            }
        };
    }

    const updateUI = (status, pct = 0, questId = null) => {
        if (!ui) return;
        const statusEl = ui.querySelector("#orbs-status");
        const barEl = ui.querySelector("#orbs-bar");
        if (statusEl) statusEl.textContent = status;
        if (barEl) barEl.style.width = Math.min(100, pct) + "%";
        if (questId) {
            const el = document.getElementById(`orbs-q-${questId}`);
            if (el) el.style.opacity = pct >= 99 ? "0.45" : "1";
        }
    };
    const setButtons = started => {
        if (!ui) return;
        const startBtn = ui.querySelector("#orbs-start");
        const stopBtn = ui.querySelector("#orbs-stop");
        if (startBtn) startBtn.style.display = started ? "none" : "block";
        if (stopBtn) stopBtn.style.display = started ? "block" : "none";
    };

    // ====================== CLAIM (optional) ======================
    async function tryClaim(id) {
        if (!CONFIG.AUTO_CLAIM) return;
        try {
            log(t.claim, "info");
            await api.post({ url: `/quests/${id}/claim-reward`, body: { location: 0 } }).catch(()=>{});
        } catch {}
    }

    // ====================== VIDEO (stealth) ======================
    async function doVideo(q) {
        log(`${t.video}: ${q.name}`, "info");
        updateUI(`${t.video}: ${q.name}`, (q.secondsDone/q.secondsNeeded)*100, q.id);

        let done = q.secondsDone;
        const needed = q.secondsNeeded;
        const enrolledAt = q.raw.userStatus?.enrolledAt ? new Date(q.raw.userStatus.enrolledAt).getTime() : now();
        let retries = 0;

        while (done < needed && !stopRequested) {
            try {
                const elapsed = Math.floor((now() - enrolledAt) / 1000);
                const maxAllowed = elapsed + CONFIG.VIDEO_MAX_FUTURE;
                const speed = CONFIG.VIDEO_BASE_SPEED + rnd(-0.8, 1.2);
                let next = Math.min(needed, done + speed);

                // Не забегаем сильно вперёд
                if (next > maxAllowed) {
                    next = Math.min(needed, maxAllowed);
                    // Ждём реального времени
                    const wait = Math.max(800, (next - done) * 900);
                    await sleep(wait + rnd(0, 400));
                } else {
                    await sleep(CONFIG.VIDEO_MIN_DELAY + rnd(0, 600));
                }

                if (next <= done) {
                    await sleep(1200);
                    continue;
                }

                const res = await api.post({
                    url: `/quests/${q.id}/video-progress`,
                    body: { timestamp: +(next + rnd(0, 0.7)).toFixed(2) }
                });

                done = next;
                q.secondsDone = done;
                const pct = (done / needed) * 100;
                const remainingSec = Math.max(0, Math.ceil((needed - done) / Math.max(0.5, CONFIG.VIDEO_BASE_SPEED)));
                const etaMin = Math.floor(remainingSec / 60);
                const etaStr = etaMin > 0 ? `~${etaMin} мин` : `~${remainingSec} сек`;
                log(`${t.progress} ${bar(done, needed)} | ETA: ${etaStr}`, "progress");
                updateUI(`${t.video}: ${q.name} | ${etaStr} осталось`, pct, q.id);

                if (res.body?.completed_at || done >= needed) break;
                retries = 0;
            } catch (e) {
                retries++;
                const errMsg = (e.message || '').toLowerCase();
                if (errMsg.includes('captcha') || errMsg.includes('rate limit') || errMsg.includes('429') || errMsg.includes('too many')) {
                    log(`⚠️ Обнаружена captcha / rate-limit! Делаю длинную паузу 5-10 мин...`, "warn");
                    await sleep(rndInt(300000, 600000)); // 5-10 min auto-pause
                    break; // stop this quest
                }
                log(`Video error: ${e.message} (${retries})`, "error");
                if (retries >= 4) break;
                await sleep(2500 * retries);
            }
        }

        // Финальный timestamp
        if (done < needed && !stopRequested) {
            try {
                await api.post({ url: `/quests/${q.id}/video-progress`, body: { timestamp: needed } });
            } catch {}
        }

        log(`${t.completed}: ${q.name}`, "success");
        updateUI(`${t.completed}: ${q.name}`, 100, q.id);
        playBeep(880, 250); // sound on quest complete
        await tryClaim(q.id);
        await sleep(1800 + rnd(0, 1200));
    }

    // ====================== GAME ======================
    async function doGame(q) {
        if (!isApp) { log(`${t.browser} ${q.name}`, "warn"); return; }
        log(`${t.game}: ${q.applicationName}`, "info");
        updateUI(`${t.game}: ${q.name}`, (q.secondsDone/q.secondsNeeded)*100, q.id);

        const pid = rndInt(1000, 32000);
        const res = await api.get({ url: `/applications/public?application_ids=${q.applicationId}` });
        const app = res.body?.[0];
        if (!app) throw new Error("No app data");

        const exe = app.executables?.find(x => x.os === "win32")?.name?.replace(">","") || app.name.replace(/[/\:*?"<>|]/g,"");
        const fake = {
            cmdLine: `C:\\Program Files\\${app.name}\\${exe}`,
            exeName: exe,
            exePath: `c:/program files/${app.name.toLowerCase()}/${exe}`,
            hidden: false, isLauncher: false,
            id: q.applicationId, name: app.name, pid, pidPath: [pid],
            processName: app.name, start: now()
        };

        const real = RunningGameStore.getRunningGames?.() || [];
        const realGet = RunningGameStore.getRunningGames;
        const realPid = RunningGameStore.getGameForPID;

        RunningGameStore.getRunningGames = () => [fake];
        if (RunningGameStore.getGameForPID) RunningGameStore.getGameForPID = p => p===pid ? fake : null;

        FluxDispatcher.dispatch({ type: "RUNNING_GAMES_CHANGE", removed: real, added: [fake], games: [fake] });
        addCleanup(() => {
            RunningGameStore.getRunningGames = realGet;
            if (realPid) RunningGameStore.getGameForPID = realPid;
            FluxDispatcher.dispatch({ type: "RUNNING_GAMES_CHANGE", removed: [fake], added: [], games: [] });
        });

        const rem = Math.ceil((q.secondsNeeded - q.secondsDone) / 60);
        log(`${t.waiting} ~${rem} ${t.min}`, "warn");

        return new Promise(resolve => {
            const fn = data => {
                if (stopRequested) { FluxDispatcher.unsubscribe("QUESTS_SEND_HEARTBEAT_SUCCESS", fn); resolve(); return; }
                try {
                    let progress = q.raw.config?.configVersion === 1
                        ? (data.userStatus?.streamProgressSeconds || 0)
                        : Math.floor(data.userStatus?.progress?.PLAY_ON_DESKTOP?.value || 0);
                    q.secondsDone = progress;
                    const pct = (progress / q.secondsNeeded) * 100;
                    log(`${t.progress} ${bar(progress, q.secondsNeeded)}`, "progress");
                    updateUI(`${t.game} ${progress}/${q.secondsNeeded}s`, pct, q.id);
                    if (progress >= q.secondsNeeded) {
                        FluxDispatcher.unsubscribe("QUESTS_SEND_HEARTBEAT_SUCCESS", fn);
                        log(`${t.completed}: ${q.name}`, "success");
                        updateUI(`${t.completed}`, 100, q.id);
                        playBeep(880, 250);
                        tryClaim(q.id);
                        setTimeout(resolve, 2000);
                    }
                } catch {}
            };
            FluxDispatcher.subscribe("QUESTS_SEND_HEARTBEAT_SUCCESS", fn);
        });
    }

    // ====================== STREAM ======================
    async function doStream(q) {
        if (!isApp) { log(`${t.browser} ${q.name}`, "warn"); return; }
        log(`${t.stream}: ${q.applicationName}`, "info");
        log(t.need_vc, "warn");
        updateUI(`${t.stream}: ${q.name}`, (q.secondsDone/q.secondsNeeded)*100, q.id);

        const pid = rndInt(1000, 32000);
        const realFunc = ApplicationStreamingStore.getStreamerActiveStreamMetadata;
        ApplicationStreamingStore.getStreamerActiveStreamMetadata = () => ({ id: q.applicationId, pid, sourceName: null });
        addCleanup(() => { ApplicationStreamingStore.getStreamerActiveStreamMetadata = realFunc; });

        const rem = Math.ceil((q.secondsNeeded - q.secondsDone) / 60);
        log(`${t.waiting} ~${rem} ${t.min}`, "warn");

        return new Promise(resolve => {
            const fn = data => {
                if (stopRequested) { FluxDispatcher.unsubscribe("QUESTS_SEND_HEARTBEAT_SUCCESS", fn); resolve(); return; }
                try {
                    let progress = q.raw.config?.configVersion === 1
                        ? (data.userStatus?.streamProgressSeconds || 0)
                        : Math.floor(data.userStatus?.progress?.STREAM_ON_DESKTOP?.value || 0);
                    q.secondsDone = progress;
                    const pct = (progress / q.secondsNeeded) * 100;
                    log(`${t.progress} ${bar(progress, q.secondsNeeded)}`, "progress");
                    updateUI(`${t.stream} ${progress}/${q.secondsNeeded}s`, pct, q.id);
                    if (progress >= q.secondsNeeded) {
                        FluxDispatcher.unsubscribe("QUESTS_SEND_HEARTBEAT_SUCCESS", fn);
                        log(`${t.completed}: ${q.name}`, "success");
                        updateUI(`${t.completed}`, 100, q.id);
                        playBeep(880, 250);
                        tryClaim(q.id);
                        setTimeout(resolve, 2000);
                    }
                } catch {}
            };
            FluxDispatcher.subscribe("QUESTS_SEND_HEARTBEAT_SUCCESS", fn);
        });
    }

    // ====================== ACTIVITY ======================
    async function doActivity(q) {
        log(`${t.activity}: ${q.name}`, "info");
        updateUI(`${t.activity}: ${q.name}`, (q.secondsDone/q.secondsNeeded)*100, q.id);

        let channelId = "0";
        try {
            channelId = ChannelStore?.getSortedPrivateChannels?.()?.[0]?.id
                || Object.values(GuildChannelStore?.getAllGuilds?.() || {}).find(g => g?.VOCAL?.length)?.VOCAL?.[0]?.channel?.id
                || "0";
        } catch {}
        const streamKey = `call:${channelId}:1`;

        let done = q.secondsDone;
        let retries = 0;

        while (done < q.secondsNeeded && !stopRequested) {
            try {
                const res = await api.post({
                    url: `/quests/${q.id}/heartbeat`,
                    body: { stream_key: streamKey, terminal: false }
                });
                done = res.body?.progress?.PLAY_ACTIVITY?.value ?? done + 18;
                q.secondsDone = done;
                const pct = (done / q.secondsNeeded) * 100;
                log(`${t.progress} ${bar(done, q.secondsNeeded)}`, "progress");
                updateUI(`${t.activity} ${Math.floor(done)}/${q.secondsNeeded}s`, pct, q.id);

                if (done >= q.secondsNeeded) {
                    await api.post({ url: `/quests/${q.id}/heartbeat`, body: { stream_key: streamKey, terminal: true } });
                    break;
                }
                await sleep(22000 + rnd(0, 6000));
                retries = 0;
            } catch (e) {
                retries++;
                if (retries >= 4) break;
                await sleep(3000 * retries);
            }
        }

        log(`${t.completed}: ${q.name}`, "success");
        updateUI(`${t.completed}`, 100, q.id);
        playBeep(880, 250);
        await tryClaim(q.id);
        await sleep(1500);
    }

    // ====================== MAIN ======================
    async function startFarm() {
        if (running) return;
        running = true;
        stopRequested = false;
        completedCount = 0;
        sessionStartTime = now();
        questsCompletedThisSession = 0;
        sessionStats = { quests: 0, timeMs: 0, videoDone: 0, gameDone: 0 };
        setButtons(true);
        updateUI("Запуск stealth-режима...", 0);

        // Берём только лимит
        // Пересортируем на лету (если юзер менял "Сначала видео")
        allAvailable.sort((a, b) => {
            if (a.enrolled !== b.enrolled) return b.enrolled - a.enrolled;
            if (CONFIG.PRIORITIZE_VIDEO) return (b.isVideo ? 1 : 0) - (a.isVideo ? 1 : 0);
            return 0;
        });
        const queue = allAvailable.slice(0, CONFIG.MAX_QUESTS_PER_SESSION);

        for (let i = 0; i < queue.length; i++) {
            if (stopRequested) break;
            const q = queue[i];

            // JIT enroll
            const ok = await enrollQuest(q);
            if (!ok) {
                log(`Пропускаю ${q.name} (не принят)`, "warn");
                continue;
            }

            try {
                if (q.isVideo) await doVideo(q);
                else if (q.isGame) await doGame(q);
                else if (q.isStream) await doStream(q);
                else if (q.isActivity) await doActivity(q);
                completedCount++;
                questsCompletedThisSession++;
                sessionStats.quests++;
                if (q.isVideo) sessionStats.videoDone++;
                if (q.isGame) sessionStats.gameDone++;
            } catch (err) {
                log(`Ошибка ${q.name}: ${err.message}`, "error");
                console.error(err);
            }

            runCleanups();

            // Длинная пауза между квестами (stealth)
            if (i < queue.length - 1 && !stopRequested) {
                const pause = rndInt(...CONFIG.PAUSE_BETWEEN_QUESTS);
                log(`${t.pause} ${pause} сек...`, "warn");
                updateUI(`${t.pause} ${pause}с перед следующим`, 0);
                for (let s = pause; s > 0 && !stopRequested; s--) {
                    updateUI(`${t.pause} ${s}с...`, 0);
                    await sleep(1000);
                }
            }
        }

        running = false;
        setButtons(false);
        const sessionTimeMs = sessionStartTime ? (now() - sessionStartTime) : 0;
        const sessionMin = Math.floor(sessionTimeMs / 60000);
        const sessionSec = Math.floor((sessionTimeMs % 60000) / 1000);
        sessionStats.timeMs = sessionTimeMs;

        updateUI(stopRequested ? "Остановлено" : `${t.all_done} (${completedCount})`, 100);
        log(stopRequested ? "Остановлено" : `${t.all_done} · сделано ${completedCount}`, "success");

        if (!stopRequested && completedCount > 0) {
            log(`📊 Статистика сессии: ${questsCompletedThisSession} квестов за ${sessionMin}м ${sessionSec}с | Видео: ${sessionStats.videoDone} | Игры: ${sessionStats.gameDone}`, "success");
            playBeep(660, 300);
            setTimeout(() => playBeep(880, 400), 350);
        }
        runCleanups();
    }

    if (!CONFIG.SHOW_UI) startFarm();
    else {
        log("Панель готова. Нажми СТАРТ. Stealth-режим активен.", "success");
        log("✕ — полностью закрыть и очистить скрипт", "info");
        console.log("%c⚠️ ТОЛЬКО В ОБРАЗОВАТЕЛЬНЫХ ЦЕЛЯХ. Риск бана Discord.", "color:#f04747;font-weight:bold;font-size:13px");
    }

    window.addEventListener("beforeunload", () => {
        stopRequested = true;
        runCleanups();
    });

    // Глобальный способ закрыть из консоли: window.closeOrbsFarmer()
    window.closeOrbsFarmer = () => fullStopAndClose("Закрыто через console");
})();
