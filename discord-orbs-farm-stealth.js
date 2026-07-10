/**
 * 🔥 DISCORD ORBS FARMER v4.0 STEALTH
 * Авто-принятие + максимально безопасный режим (меньше шансов на бан)
 *
 * ⚠️ ВАЖНО ПРО БАН:
 * Discord с апреля 2026 активно банит за автоматизацию квестов.
 * Этот скрипт сделан максимально "человечным":
 *   - JIT-enroll (принимает квест только перед выполнением)
 *   - Медленный видео-прогресс (почти как настоящий просмотр)
 *   - Большие случайные паузы между квестами
 *   - Не трогает claim (claim часто вызывает captcha)
 *   - Ограничение количества квестов за сессию
 *   - Случайные задержки и jitter
 *
 * Даже с этим РИСК БАНА ОСТАЁТСЯ. Используй на свой страх и риск.
 * Лучше всего — на альтернативном аккаунте.
 *
 * Как использовать:
 * 1. Discord Desktop / Vesktop / Equicord
 * 2. Ctrl+Shift+I → Console → allow pasting
 * 3. Вставь код → Enter
 * 4. Появится панель → настрой и жми СТАРТ
 */

(async () => {
    "use strict";

    // ====================== STEALTH CONFIG ======================
    const CONFIG = {
        LANG: "ru",

        // === БЕЗОПАСНОСТЬ (чем выше — тем безопаснее, но медленнее) ===
        STEALTH_LEVEL: 2,              // 1 = быстрее, 2 = баланс, 3 = максимально осторожно
        MAX_QUESTS_PER_SESSION: 4,     // сколько квестов максимум за один запуск (меньше = безопаснее)
        AUTO_ENROLL: true,             // автоматически принимать квесты
        AUTO_CLAIM: false,             // claim часто вызывает captcha → выключено по умолчанию
        PRIORITIZE_VIDEO: true,        // сначала видео (они безопаснее и быстрее)

        // Видео (адаптируется под STEALTH_LEVEL)
        VIDEO_BASE_SPEED: 4,           // базовый прирост секунд
        VIDEO_MAX_FUTURE: 6,           // максимум забега вперёд
        VIDEO_MIN_DELAY: 1400,         // минимальная пауза между запросами

        // Паузы между квестами (секунды)
        PAUSE_BETWEEN_QUESTS: [45, 120], // случайная пауза 45-120 сек

        SHOW_UI: true,
        DEBUG: true
    };

    // Авто-подстройка под уровень stealth
    if (CONFIG.STEALTH_LEVEL === 1) {
        CONFIG.VIDEO_BASE_SPEED = 7;
        CONFIG.VIDEO_MAX_FUTURE = 10;
        CONFIG.VIDEO_MIN_DELAY = 900;
        CONFIG.PAUSE_BETWEEN_QUESTS = [15, 40];
        CONFIG.MAX_QUESTS_PER_SESSION = 6;
    } else if (CONFIG.STEALTH_LEVEL === 3) {
        CONFIG.VIDEO_BASE_SPEED = 2.5;
        CONFIG.VIDEO_MAX_FUTURE = 4;
        CONFIG.VIDEO_MIN_DELAY = 2200;
        CONFIG.PAUSE_BETWEEN_QUESTS = [90, 240];
        CONFIG.MAX_QUESTS_PER_SESSION = 2;
    }

    // ====================== UTILS ======================
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const rnd = (a, b) => Math.random() * (b - a) + a;
    const rndInt = (a, b) => Math.floor(rnd(a, b + 1));
    const now = () => Date.now();

    const t = {
        ru: {
            title: "🔥 Orbs Farmer STEALTH v4",
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
            title: "🔥 Orbs Farmer STEALTH v4",
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
    if (CONFIG.SHOW_UI) {
        ui = document.createElement("div");
        ui.id = "orbs-stealth-ui";
        ui.innerHTML = `
            <div style="background:linear-gradient(145deg,#1a1b1e,#2b2d31);border:1px solid #3f4147;border-radius:14px;padding:16px;width:340px;font-family:gg sans,Whitney,system-ui,sans-serif;color:#dbdee1;box-shadow:0 12px 40px rgba(0,0,0,.55);">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;cursor:move;" id="orbs-drag">
                    <div style="font-weight:700;font-size:15px;">${t.title}</div>
                    <div style="font-size:11px;background:#5865F2;padding:2px 8px;border-radius:10px;">STEALTH ${CONFIG.STEALTH_LEVEL}</div>
                </div>
                <div id="orbs-status" style="font-size:12px;color:#b5bac1;margin-bottom:8px;min-height:18px;">Готов · максимум ${CONFIG.MAX_QUESTS_PER_SESSION} квестов</div>
                <div style="background:#111214;border-radius:8px;height:8px;margin-bottom:12px;overflow:hidden;">
                    <div id="orbs-bar" style="background:linear-gradient(90deg,#5865F2,#57F287);height:100%;width:0%;transition:width .4s;"></div>
                </div>
                <div id="orbs-list" style="max-height:180px;overflow-y:auto;font-size:12px;margin-bottom:14px;"></div>
                <div style="display:flex;gap:8px;">
                    <button id="orbs-start" style="flex:1;background:#5865F2;color:#fff;border:none;border-radius:8px;padding:10px;font-weight:600;cursor:pointer;font-size:13px;">${t.start}</button>
                    <button id="orbs-stop" style="flex:1;background:#4e5058;color:#fff;border:none;border-radius:8px;padding:10px;font-weight:600;cursor:pointer;font-size:13px;display:none;">${t.stop}</button>
                </div>
                <div style="font-size:10px;color:#949ba4;margin-top:10px;text-align:center;line-height:1.4;">
                    Авто-принятие: ${CONFIG.AUTO_ENROLL ? "✅" : "❌"} · Claim: ${CONFIG.AUTO_CLAIM ? "✅" : "❌"}<br>
                    Паузы и медленный прогресс = меньше риска бана
                </div>
            </div>
        `;
        ui.style.cssText = "position:fixed;top:70px;right:18px;z-index:999999;";
        document.body.appendChild(ui);

        // Drag
        let dragging=false, ox=0, oy=0;
        ui.querySelector("#orbs-drag").onmousedown = e => { dragging=true; ox=e.clientX-ui.offsetLeft; oy=e.clientY-ui.offsetTop; e.preventDefault(); };
        document.onmousemove = e => { if(dragging){ ui.style.left=(e.clientX-ox)+"px"; ui.style.top=(e.clientY-oy)+"px"; ui.style.right="auto"; } };
        document.onmouseup = () => dragging=false;

        // List
        const list = ui.querySelector("#orbs-list");
        allAvailable.slice(0, 12).forEach(q => {
            const icon = q.isVideo?"🎬":q.isGame?"🎮":q.isStream?"📡":"🎯";
            const div = document.createElement("div");
            div.id = `orbs-q-${q.id}`;
            div.style.cssText = "padding:5px 0;border-bottom:1px solid #3f4147;display:flex;justify-content:space-between;align-items:center;";
            div.innerHTML = `
                <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:200px;">${icon} ${q.name}</span>
                <span style="color:${q.enrolled?"#3BA55C":"#FAA61A"};font-size:11px;">${q.enrolled?"принят":"не принят"}</span>
            `;
            list.appendChild(div);
        });

        ui.querySelector("#orbs-start").onclick = () => { if(!running) startFarm(); };
        ui.querySelector("#orbs-stop").onclick = () => {
            stopRequested = true;
            running = false;
            updateUI("Остановлено", 0);
            setButtons(false);
        };
    }

    const updateUI = (status, pct=0, questId=null) => {
        if (!ui) return;
        ui.querySelector("#orbs-status").textContent = status;
        ui.querySelector("#orbs-bar").style.width = Math.min(100, pct) + "%";
        if (questId) {
            const el = document.getElementById(`orbs-q-${questId}`);
            if (el) el.style.opacity = pct >= 99 ? "0.45" : "1";
        }
    };
    const setButtons = started => {
        if (!ui) return;
        ui.querySelector("#orbs-start").style.display = started ? "none" : "block";
        ui.querySelector("#orbs-stop").style.display = started ? "block" : "none";
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
                log(`${t.progress} ${bar(done, needed)}`, "progress");
                updateUI(`${t.video} ${Math.floor(done)}/${needed}s`, pct, q.id);

                if (res.body?.completed_at || done >= needed) break;
                retries = 0;
            } catch (e) {
                retries++;
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

        const exe = app.executables?.find(x => x.os === "win32")?.name?.replace(">","") || app.name.replace(/[\/\\:*?"<>|]/g,"");
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
        await tryClaim(q.id);
        await sleep(1500);
    }

    // ====================== MAIN ======================
    async function startFarm() {
        if (running) return;
        running = true;
        stopRequested = false;
        completedCount = 0;
        setButtons(true);
        updateUI("Запуск stealth-режима...", 0);

        // Берём только лимит
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
        updateUI(stopRequested ? "Остановлено" : `${t.all_done} (${completedCount})`, 100);
        log(stopRequested ? "Остановлено" : `${t.all_done} · сделано ${completedCount}`, "success");
        runCleanups();
    }

    if (!CONFIG.SHOW_UI) startFarm();
    else log("Панель готова. Нажми СТАРТ. Stealth-режим активен.", "success");

    window.addEventListener("beforeunload", runCleanups);
})();
