// ==UserScript==
// @name         Advanced IP Monitor with Speed Test (FiberHome) - Bilingual
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Monitor IPs with automatic speed testing via Fast.com - English/Arabic
// @author       Fahad (Twitter: @kkoao1)
// @match        http://192.168.8.1/*
// @match        https://fast.com/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        window.close
// ==/UserScript==


let speedTestRetryCount = 0;
let lastKnownWAN = "";
let currentLang = GM_getValue('ipMonitorLang', 'en');
let ipPinningAttempts = 0;

// Language translations
const translations = {
    en: {
        mainTitle: "IP Tools ",
        status: {
            connected: "Connected",
            disconnected: "Disconnected",
            connecting: "Connecting"
        },
        buttons: {
            changeIP: "Change IP",
            speedTest: "Speed Test",
            stopAuto: "Stop Auto",
            saveLog: "Save Log",
            close: "Close",
            clearLog: "Clear",
            statsTable: "Speed Table"
        },
        labels: {
            autoSpeedTest: "Auto Speed Test Mode",
            autoSpeedDesc: "Automatically test speed for each new IP",
            networkLog: "Network Log",
            ipPinning: "IP Pinning",
            ipPinDesc: "Auto-change IP until match found",
            startPinning: "Start Pinning",
            wanIP: "WAN IP",
            publicIP: "Public IP",
            speed: "Speed",
            upload: "Upload",
            ping: "Ping",
            time: "Time",
            status: "Status"
        },
        messages: {
            noLogs: "No logs yet...",
            openingFast: "Opening Fast.com for speed test...",
            waitingTest: "Waiting for speed test to complete...",
            networkError: "Network error during speed test, retrying in 3 seconds...",
            maxRetries: "Reached maximum retries for speed test. Please check your internet and try again.",
            waitingNext: "Waiting 3 seconds before next IP change...",
            testTimeout: "Speed test timeout - no results obtained",
            processRunning: "Process already running!",
            startingIPChange: "Starting IP change process...",
            loadingAirplane: "Loading airplane mode settings...",
            enablingAirplane: "Enabling airplane mode...",
            airplaneEnabled: "Airplane mode enabled",
            waiting: "Waiting",
            seconds: "seconds",
            disablingAirplane: "Disabling airplane mode...",
            airplaneDisabled: "Airplane mode disabled",
            waitingReconnect: "Waiting for reconnection...",
            ipChangeComplete: "IP change completed!",
            error: "Error",
            testCompleted: "Test completed! Closing...",
            speedTestResults: "Speed Test Results",
            testCount: "Test Count",
            ipFound: "Target IP found! Stopping...",
            searchingIP: "Searching for matching IP...",
            pinningActive: "IP Pinning Active"
        },
        statsTable: {
            title: "Speed Test Results",
            headers: {
                number: "#",
                wanIP: "WAN IP",
                publicIP: "Public IP",
                speed: "Speed",
                upload: "Upload",
                ping: "Ping"
            }
        }
    },
    ar: {
        mainTitle: "IP Tools",
        status: {
            connected: "متصل",
            disconnected: "غير متصل",
            connecting: "جاري الاتصال"
        },
        buttons: {
            changeIP: "تغيير IP",
            speedTest: "اختبار السرعة",
            stopAuto: "إيقاف تلقائي",
            saveLog: "حفظ السجل",
            close: "إغلاق",
            clearLog: "مسح",
            statsTable: "جدول السرعات"
        },
        labels: {
            autoSpeedTest: "وضع اختبار السرعة التلقائي",
            autoSpeedDesc: "اختبار السرعة تلقائياً لكل IP جديد",
            networkLog: "سجل الشبكة",
            ipPinning: "تثبيت IP",
            ipPinDesc: "تغيير IP تلقائياً حتى العثور على التطابق",
            startPinning: "بدء التثبيت",
            wanIP: "IP الشبكة",
            publicIP: "IP العام",
            speed: "السرعة",
            upload: "الرفع",
            ping: "البنج",
            time: "الوقت",
            status: "الحالة"
        },
        messages: {
            noLogs: "لا توجد سجلات بعد...",
            openingFast: "فتح Fast.com لاختبار السرعة...",
            waitingTest: "انتظار اكتمال اختبار السرعة...",
            networkError: "خطأ في الشبكة أثناء اختبار السرعة، إعادة المحاولة بعد 3 ثواني...",
            maxRetries: "تم الوصول للحد الأقصى من المحاولات. تحقق من الإنترنت وحاول مرة أخرى.",
            waitingNext: "انتظار 3 ثواني قبل تغيير IP التالي...",
            testTimeout: "انتهت مهلة اختبار السرعة - لم يتم الحصول على نتائج",
            processRunning: "العملية قيد التشغيل بالفعل!",
            startingIPChange: "بدء عملية تغيير IP...",
            loadingAirplane: "تحميل إعدادات وضع الطيران...",
            enablingAirplane: "تفعيل وضع الطيران...",
            airplaneEnabled: "تم تفعيل وضع الطيران",
            waiting: "انتظار",
            seconds: "ثواني",
            disablingAirplane: "إلغاء وضع الطيران...",
            airplaneDisabled: "تم إلغاء وضع الطيران",
            waitingReconnect: "انتظار إعادة الاتصال...",
            ipChangeComplete: "اكتملت عملية تغيير IP!",
            error: "خطأ",
            testCompleted: "اكتمل الاختبار! جاري الإغلاق...",
            speedTestResults: "نتائج اختبارات السرعة",
            testCount: "عدد الاختبارات",
            ipFound: "تم العثور على IP المستهدف! جاري الإيقاف...",
            searchingIP: "البحث عن IP مطابق...",
            pinningActive: "تثبيت IP نشط"
        },
        statsTable: {
            title: "نتائج اختبارات السرعة",
            headers: {
                number: "#",
                wanIP: "IP الشبكة",
                publicIP: "IP العام",
                speed: "السرعة",
                upload: "الرفع",
                ping: "البنج"
            }
        }
    }
};

// Get translation
function t(key) {
    const keys = key.split('.');
    let value = translations[currentLang];
    for (const k of keys) {
        value = value[k];
    }
    return value || key;
}

(function() {
    'use strict';

    // Check if we're on Fast.com
    if (window.location.hostname === 'fast.com') {
        handleFastCom();
        return;
    }

    function addSidebarBtn() {
        let management = document.querySelector('span[title="Management"]');
        if (management && !document.getElementById('fh_ip_monitor_sidebar')) {
            // دور على العنصر الرئيسي (li أو div أو أي أب) في القائمة
            let li = management.closest('li, .el-menu-item, .menu-item');
            if (!li) li = management.parentElement;
            // انسخ العنصر ونظفه
            let ipLi = li.cloneNode(true);
            ipLi.id = 'fh_ip_monitor_sidebar';
            let span = ipLi.querySelector('span');
            if (span) {
                span.innerHTML = `<img src="https://cdn-icons-png.flaticon.com/128/11479/11479255.png" style="width:20px;height:20px;vertical-align:-3px;margin-right:4px;"> <b style="color:#111;">IP Tools</b>`;
            }
            // خلي الزر يفتح الواجهة مباشرة
            ipLi.onclick = function(e) {
                e.preventDefault();
                showMainUI();
            };
            // أضفه بعد management مباشرة
            li.parentNode.insertBefore(ipLi, li.nextSibling);
            return true; // زرع الزر
        }
        return false; // ما زرع الزر
    }

    // حاول تلقاه أول ما تحمل الصفحة
    if (!addSidebarBtn()) {
        // لو ما حصلته، تابع حاول كل نص ثانية لين يطلع
        let sidebarInterval = setInterval(()=>{
            if (addSidebarBtn()) clearInterval(sidebarInterval);
        }, 500);
    }

    // fallback زر عائم لو ما فيه sidebar أصلاً
    setTimeout(()=>{
        if (!document.getElementById('fh_ip_monitor_sidebar') && !document.getElementById('fh_ip_monitor_btn')) {
            let mainBtn = document.createElement('button');
            mainBtn.id = 'fh_ip_monitor_btn';
            mainBtn.innerHTML = `<img src="https://cdn-icons-png.flaticon.com/128/11479/11479255.png" style="width:24px;height:24px;vertical-align:-5px;margin-right:3px;"> <b style="font-size:22px;font-family:Segoe UI,Arial,sans-serif;">IP Tools</b>`;
            mainBtn.style.cssText = 'position:fixed;top:24px;left:50%;transform:translateX(-50%);z-index:100040;background:#1a2332;color:#00ffcc;border-radius:20px;padding:11px 30px 12px 30px;font-size:20px;border:2px solid #00ffcc40;font-weight:bold;box-shadow:0 4px 24px #00ffcc20;cursor:pointer;transition:.2s;';
            mainBtn.onmouseenter = ()=>{mainBtn.style.transform='translateX(-50%) scale(1.05)';mainBtn.style.boxShadow='0 6px 32px #00ffcc40';};
            mainBtn.onmouseleave = ()=>{mainBtn.style.transform='translateX(-50%) scale(1)';mainBtn.style.boxShadow='0 4px 24px #00ffcc20';};
            mainBtn.onclick = showMainUI;
            document.body.appendChild(mainBtn);
        }
    }, 2500);

    // -- STATE --
    let logList = [];
    let interval = null;
    let watcherActive = false;
    let prev = {status:"", wan:"", pub:""};
    let colors = {bg:"#0d1117", fg:"#00ffcc", red:"#ff3366", green:"#00ff88", yellow:"#ffcc00", blue:"#00ccff", orange:"#ff9944", purple:"#cc99ff", pink:"#ff66cc"};
    let airplaneProcess = {active: false};
    let speedTestEnabled = false;
    let speedTestCycle = false;
    let speedTestWindow = null;
    let speedTestInProgress = false;
    let ipPinningActive = false;
    let targetWAN = "";
    let targetPublic = "";

// -- MAIN UI --
// -- MAIN UI --
function showMainUI() {
    if (document.getElementById("fh_ip_main")) return;

    let box = document.createElement("div");

    // ستايلات responsive + ستايل خاص لتصغير خط أرقام الـ IP
    const style = document.createElement('style');
    style.textContent = `
#fh_ip_main { font-size: 1.09rem; }
#fh_ip_main button, #fh_ip_main input, #fh_ip_main label, #fh_ip_main span, #fh_ip_main div {
  transition: all .14s;
}
#fh_ip_main .fh_ip_val {
    font-size: 1.03rem !important;
    font-weight: 700 !important;
    letter-spacing: 0.5px;
    word-break: break-all;
}
@media (max-width: 850px) {
  #fh_ip_main { max-width: 99vw !important; min-width: 0 !important; width: 99vw !important; padding: 7px 1vw !important; font-size: 0.90rem !important; }
  #fh_ip_main * { font-size: 0.87rem !important; }
  #fh_ip_main button, #fh_ip_main .lang-btn { padding: 6px 7px !important; font-size: 0.95rem !important; border-radius: 8px !important; }
  #fh_ip_main input { font-size: 0.92rem !important; padding: 4px 6px !important; border-radius: 7px !important; }
  #fh_ip_main label { font-size: 0.85rem !important; }
  #fh_ip_main #fh_ip_now { font-size: 1.05rem !important; padding: 8px !important; }
  #fh_ip_main .fh_ip_val { font-size: 0.91rem !important; }
}
@media (max-width: 500px) {
  #fh_ip_main { max-width: 99vw !important; width: 99vw !important; padding: 2px 0.5vw !important; font-size: 0.81rem !important; }
  #fh_ip_main * { font-size: 0.76rem !important; }
  #fh_ip_main button, #fh_ip_main .lang-btn { padding: 4px 4px !important; font-size: 0.82rem !important; border-radius: 7px !important; }
  #fh_ip_main input { font-size: 0.82rem !important; padding: 2.5px 4px !important; border-radius: 6px !important; }
  #fh_ip_main label { font-size: 0.73rem !important; }
  #fh_ip_main #fh_ip_now { font-size: 0.95rem !important; padding: 4px !important; }
  #fh_ip_main .fh_ip_val { font-size: 0.82rem !important; }
}
`;
    document.head.appendChild(style);

    box.id = "fh_ip_main";
    box.style.cssText = `
    background:${colors.bg};
    width: min(97vw, 410px);
    min-width: 260px;
    max-width: 410px;
    padding: clamp(7px, 2vw, 24px) clamp(7px, 2vw, 20px) clamp(7px,2vw,24px) clamp(7px,2vw,20px);
    border-radius:28px;
    box-shadow:0 12px 48px #000a;
    position:fixed;top:38px;left:50%;transform:translateX(-50%);
    z-index:100041;
    font-family:'Segoe UI',system-ui,sans-serif;
    border:1px solid #ffffff10;
    direction: ${currentLang === 'ar' ? 'rtl' : 'ltr'};
    transition: width .14s, max-width .14s, min-width .14s, padding .14s;
    max-height: 97vh;
    overflow-y: auto;
    overscroll-behavior: contain;
    `;

    box.innerHTML = `
    <div id="fh_drag_handle" style="display:flex;gap:6px;margin-bottom:3px;align-items:center;cursor:grab;user-select:none;">
        <button class="lang-btn" data-lang="en" style="background:${currentLang === 'en' ? colors.green : '#2d3748'};color:${currentLang === 'en' ? '#000' : '#fff'};padding:5px 9px;border:none;border-radius:7px;font-weight:bold;cursor:pointer;">EN</button>
        <button class="lang-btn" data-lang="ar" style="background:${currentLang === 'ar' ? colors.green : '#2d3748'};color:${currentLang === 'ar' ? '#000' : '#fff'};padding:5px 9px;border:none;border-radius:7px;font-weight:bold;cursor:pointer;">AR</button>
        <div style="flex:1"></div>
        <img src="https://cdn-icons-png.flaticon.com/128/11479/11479255.png" style="width:28px;height:28px;margin-left:6px;margin-right:6px;">
        <span style="font-size:1.09em;text-shadow:0 2px 10px ${colors.fg}40;font-weight:900;letter-spacing:0.7px;color:${colors.fg};">${t('mainTitle')}</span>
    </div>

    <div id="fh_ip_status" style="font-size:1.1rem;font-weight:bold;margin-bottom:7px"></div>
    <div id="fh_ip_now" style="font-size:0.8rem;margin-bottom:13px;line-height:1.7;color:#fff;background:#ffffff08;padding:10px;border-radius:12px;border:1px solid #ffffff10;">
        <div style="display:flex;justify-content:space-between;margin-bottom:2px;">
            <span><b style="color:${colors.blue};">${t('labels.wanIP')}:</b></span>
            <span class="fh_ip_val"></span>
        </div>
        <div style="display:flex;justify-content:space-between;">
            <span><b style="color:${colors.orange};">${t('labels.publicIP')}:</b></span>
            <span class="fh_ip_val"></span>
        </div>
    </div>

    <div style="background:#ffffff08;border-radius:11px;padding:12px 14px 12px 14px;margin-bottom:9px;border:1px solid #ffffff10;display:flex;align-items:center;justify-content:space-between;gap:10px;">
        <div style="display:flex;flex-direction:column;align-items:flex-start;">
            <label style="display:flex;align-items:center;gap:7px;cursor:pointer;user-select:none;">
                <input type="checkbox" id="fh_auto_speed" style="width:15px;height:15px;cursor:pointer;">
                <span style="color:${colors.yellow};font-weight:bold;font-size:1.01rem;">🚀 ${t('labels.autoSpeedTest')}</span>
            </label>
            <span style="color:#bbb;font-size:0.82rem;margin-${currentLang === 'ar' ? 'right' : 'left'}:16px;margin-top:1px;">
                ${t('labels.autoSpeedDesc')}
            </span>
        </div>
        <button id="fh_stop_auto" style="background:${colors.red};color:#fff;padding:7px 17px;border-radius:7px;font-weight:bold;border:none;cursor:pointer;box-shadow:0 1px 8px #0003;font-size:0.96rem;">
            ${t('buttons.stopAuto')}
        </button>
    </div>

    <div style="display:flex;gap:7px;margin-bottom:9px;">
        <button id="fh_change_ip" style="flex:1;background:linear-gradient(135deg,${colors.green},${colors.blue});color:#000;padding:8px;font-size:1.01rem;font-weight:900;border:none;border-radius:13px;cursor:pointer;box-shadow:0 4px 16px ${colors.green}40;display:flex;align-items:center;justify-content:center;gap:5px;transition:.15s;">
            <span style="font-size:1.1rem">✈️</span> ${t('buttons.changeIP')}
        </button>
        <button id="fh_speed_test" style="flex:1;background:linear-gradient(135deg,${colors.purple},${colors.pink});color:#fff;padding:8px;font-size:1.01rem;font-weight:900;border:none;border-radius:13px;cursor:pointer;box-shadow:0 4px 16px ${colors.purple}40;display:flex;align-items:center;justify-content:center;gap:5px;transition:.15s;">
            <span style="font-size:1.1rem">⚡</span> ${t('buttons.speedTest')}
        </button>
    </div>

    <div style="background:#ffffff08;border-radius:11px;padding:10px 14px;margin-bottom:9px;border:1px solid #ffffff10;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:7px;">
            <div style="flex:1;">
                <span style="color:${colors.orange};font-weight:bold;font-size:1.01rem;">📌 ${t('labels.ipPinning')}</span>
                <span id="fh_pinning_counter" style="color:${colors.yellow};font-weight:bold;font-size:0.9rem;margin-${currentLang === 'ar' ? 'right' : 'left'}:10px;display:none;">
                    (${currentLang === 'ar' ? 'محاولة' : 'Attempts'}: <span id="fh_pinning_count">0</span>)
                </span>
                <span style="color:#bbb;font-size:0.8rem;display:block;margin-top:2px;">${t('labels.ipPinDesc')}</span>
            </div>
            <button id="fh_start_pinning" style="background:${colors.orange};color:#000;padding:7px 13px;border-radius:7px;font-weight:bold;border:none;cursor:pointer;font-size:0.93rem;">
                ${t('labels.startPinning')}
            </button>
        </div>
        <div style="display:flex;gap:7px;">
            <div style="flex:1;">
                <label style="color:#bbb;font-size:0.75rem;display:block;margin-bottom:3px;">WAN IP:</label>
                <input type="text" id="fh_target_wan"
                    placeholder="e.g. 10.193.89"
                    style="width:100%;padding:6px 8px;background:#0a0e14;border:1px solid #ffffff20;border-radius:7px;color:#fff;font-size:0.92rem;box-sizing:border-box;">
            </div>
            <div style="flex:1;">
                <label style="color:#bbb;font-size:0.75rem;display:block;margin-bottom:3px;">Public IP:</label>
                <input type="text" id="fh_target_public"
                    placeholder="e.g. 51.253.184"
                    style="width:100%;padding:6px 8px;background:#0a0e14;border:1px solid #ffffff20;border-radius:7px;color:#fff;font-size:0.92rem;box-sizing:border-box;">
            </div>
        </div>
    </div>

    <div id="fh_process_status" style="display:none;background:linear-gradient(135deg,${colors.purple},${colors.pink});color:#fff;padding:8px;border-radius:11px;margin-bottom:7px;text-align:center;font-weight:bold;font-size:0.98rem;box-shadow:0 4px 16px ${colors.purple}40;"></div>

    <div style="background:#0a0e14;border-radius:13px;padding:9px 10px 9px 10px;margin-bottom:8px;border:1px solid #ffffff10;">
        <div style="color:${colors.blue};font-weight:bold;font-size:0.98rem;border-bottom:2px solid #ffffff10;padding-bottom:5px;margin-bottom:6px;display:flex;justify-content:space-between;align-items:center;">
            <span>📊 ${t('labels.networkLog')}</span>
            <button id="fh_clear_log" style="background:${colors.red}40;color:${colors.red};border:1px solid ${colors.red};padding:2px 6px;font-size:0.73rem;border-radius:7px;cursor:pointer;">${t('buttons.clearLog')}</button>
        </div>
        <div id="fh_ip_log" style="max-height:120px;overflow-y:auto;font-size:0.8rem;color:#fff;line-height:1.4;font-family:monospace;"></div>
    </div>

    <div style="display:flex;gap:7px;margin-bottom:4px;">
        <button id="fh_stats_btn" style="flex:1;background:#313149;color:#fff;padding:6px;font-size:0.91rem;font-weight:600;border:1px solid #00ffcc40;border-radius:9px;cursor:pointer;">
            📊 ${t('buttons.statsTable')}
        </button>
        <button id="fh_save_log" style="flex:1;background:#2d3748;color:${colors.green};padding:6px;font-size:0.91rem;font-weight:600;border:1px solid ${colors.green}40;border-radius:9px;cursor:pointer;transition:.2s;">
            💾 ${t('buttons.saveLog')}
        </button>
        <button id="fh_ip_close" style="flex:1;background:#2d3748;color:#888;padding:6px;font-size:0.91rem;font-weight:600;border:1px solid #ffffff20;border-radius:9px;cursor:pointer;transition:.2s;">
            ${t('buttons.close')}
        </button>
    </div>

    <div style="text-align:center;margin-top:7px;font-size:0.94rem;color:${colors.fg};opacity:0.84;font-weight:bold;letter-spacing:0.01em;">
        Developed by Fahad<br>
        <a href="https://routers.world/" target="_blank" style="color:#44d9ff;text-decoration:none;font-weight:bold;font-size:1.02em;">https://routers.world/</a>
    </div>
`;

    document.body.appendChild(box);

    // السحب من الهيدر (أول ديف فوق)
    makeDraggable(box, box.querySelector("#fh_drag_handle"));

    // باقي الأكواد الخاصة بتفعيل اللغة والأحداث...
    box.querySelectorAll('.lang-btn').forEach(btn => {
        btn.onclick = () => {
            currentLang = btn.dataset.lang;
            GM_setValue('ipMonitorLang', currentLang);
            closeUI();
            showMainUI();
        };
    });

    document.getElementById('fh_ip_close').onclick = ()=>{ closeUI(); };
    document.getElementById('fh_change_ip').onclick = ()=>{ triggerAirplaneMode(); };
    document.getElementById('fh_speed_test').onclick = ()=>{ runSpeedTest(); };
    document.getElementById('fh_clear_log').onclick = ()=>{ logList = []; updateLogDisplay(); };
    document.getElementById('fh_save_log').onclick = ()=>{ saveLogToFile(); };
    document.getElementById('fh_auto_speed').onchange = (e)=>{ speedTestEnabled = e.target.checked; };
    document.getElementById('fh_stats_btn').onclick = showStatsWindow;
    document.getElementById('fh_start_pinning').onclick = startIPPinning;

    document.getElementById('fh_stop_auto').onclick = ()=>{
        speedTestEnabled = false;
        ipPinningActive = false;
        let cb = document.getElementById('fh_auto_speed');
        if(cb) cb.checked = false;
        updateProcessStatus("");
        let counter = document.getElementById('fh_pinning_counter');
        if(counter) counter.style.display = 'none';
    };

    // hover effect
    let buttons = box.querySelectorAll('button');
    buttons.forEach(btn => {
        if (!btn.id.includes('clear') && !btn.classList.contains('lang-btn')) {
            btn.onmouseenter = ()=>{ btn.style.transform = 'translateY(-2px)'; btn.style.boxShadow = '0 6px 24px #00000040'; };
            btn.onmouseleave = ()=>{ btn.style.transform = 'translateY(0)'; btn.style.boxShadow = ''; };
        }
    });

    updateInfo(true);
}



function closeUI() {
    let x = document.getElementById("fh_ip_main");
    if(x) x.remove();
    if(interval) clearInterval(interval);
    watcherActive = false;
    airplaneProcess.active = false;
    speedTestCycle = false;
    speedTestInProgress = false;
    ipPinningActive = false;
    prev = {status:"",wan:"",pub:""};

    if (speedTestWindow && !speedTestWindow.closed) {
        speedTestWindow.close();
    }
    speedTestWindow = null;

    GM_setValue('speedTestRequested', false);
}

// IP Pinning function
function startIPPinning() {
    targetWAN = document.getElementById('fh_target_wan').value.trim();
    targetPublic = document.getElementById('fh_target_public').value.trim();

    if (!targetWAN && !targetPublic) {
        alert("Please enter at least one IP to search for!");
        return;
    }

    ipPinningActive = true;
    ipPinningAttempts = 0; // إعادة تعيين العداد
    speedTestEnabled = false;
    document.getElementById('fh_auto_speed').checked = false;

    logList.unshift(`<div style="color:${colors.orange};font-weight:bold;background:#ff994420;padding:8px;border-radius:8px;margin-bottom:8px;">🔍 ${t('messages.searchingIP')}</div>`);
    updateLogDisplay();

    // Start first IP change
    triggerAirplaneMode();
}

function checkIPMatch() {
    if (!ipPinningActive) return false;

    let wanMatch = false;
    let publicMatch = false;

    // Helper function to check if IP matches the pattern
    function checkIPPattern(ip, pattern) {
        if (!ip || ip === "Unknown" || ip === "Failed!") return false;

        // Get first octet of the IP
        const firstOctet = ip.split('.')[0];

        // Check if pattern contains 'x' (exclusion pattern)
        if (pattern.includes('x')) {
            // Extract excluded octets
            const excludedOctets = pattern.split('x').map(num => num.trim()).filter(num => num);
            // If first octet is in the excluded list, it's a failure
            return !excludedOctets.includes(firstOctet);
        }
        // Check if pattern contains dash (inclusion pattern)
        else if (pattern.includes('-')) {
            // Extract allowed first octets
            const allowedOctets = pattern.split('-').map(num => num.trim());
            // Check if first octet is in the allowed list
            return allowedOctets.includes(firstOctet);
        } else {
            // Original behavior - prefix matching
            return ip.startsWith(pattern);
        }
    }

    // Check WAN IP match
    if (targetWAN && prev.wan) {
        wanMatch = checkIPPattern(prev.wan, targetWAN);
    }

    // Check Public IP match
    if (targetPublic && prev.pub) {
        publicMatch = checkIPPattern(prev.pub, targetPublic);
    }

    // If both are specified, both must match
    if (targetWAN && targetPublic) {
        return wanMatch && publicMatch;
    }
    // If only one is specified, that one must match
    return wanMatch || publicMatch;
}

// Monitor & Log
async function updateInfo(forceLog=false, retries=1) {
    let modem = await getModemInfo();
    if ((modem.wanip==="Unknown" || modem.status==="Unknown") && retries > 0) {
        await new Promise(r=>setTimeout(r,1200));
        return updateInfo(forceLog, retries-1);
    }

    let publicip = await fetchPublicIP();
    let status = /connected/i.test(modem.status) ? "Connected" :
                 /disconnected/i.test(modem.status) ? "Disconnected" :
                 /connecting/i.test(modem.status) ? "Connecting" :
                 modem.status;
    let wanip = modem.wanip;

    if (wanip && wanip !== "Unknown") lastKnownWAN = wanip;

    let statusElem = document.getElementById('fh_ip_status');
    let nowElem = document.getElementById('fh_ip_now');
    if (!statusElem || !nowElem) return;

statusElem.innerHTML = status==="Connected"
    ? `<span style="color:${colors.green}">📶 ${t('status.connected')}</span>`
    : status==="Disconnected"
        ? `<span style="color:${colors.red}">✈️ ${t('status.disconnected')}</span>`
        : status==="Connecting"
            ? `<span style="color:${colors.yellow}">🔄 ${t('status.connecting')}...</span>`
        : `<span style="color:${colors.yellow}">${status}</span>`;


    nowElem.innerHTML = `
        <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
            <span><b style="color:${colors.blue};">${t('labels.wanIP')}:</b></span>
            <span style="color:#fff;font-size:0.8rem;font-weight:bold;">${wanip}</span>
        </div>
        <div style="display:flex;justify-content:space-between;">
            <span><b style="color:${colors.orange};">${t('labels.publicIP')}:</b></span>
            <span style="color:#fff;font-size:0.8rem;font-weight:bold;">${publicip}</span>
        </div>
    `;

    if (forceLog || prev.status!==status || prev.wan!==wanip || prev.pub!==publicip) {
        logStatus(status, wanip, publicip);
        prev = {status, wan:wanip, pub:publicip};

        // Check for IP match if pinning is active
if (ipPinningActive && status === "Connected" && checkIPMatch()) {
    ipPinningActive = false;
    updateProcessStatus("");
    document.getElementById('fh_pinning_counter').style.display = 'none'; // إخفاء العداد
    logList.unshift(`<div style="color:${colors.green};font-weight:bold;background:#00ff8820;padding:8px;border-radius:8px;margin-bottom:8px;">🎯 ${t('messages.ipFound')} (${currentLang === 'ar' ? 'بعد' : 'After'} ${ipPinningAttempts} ${currentLang === 'ar' ? 'محاولة' : 'attempts'})</div>`);
    updateLogDisplay();
    return;
}

        // Continue IP changing if pinning active
if (ipPinningActive && status === "Connected" && !airplaneProcess.active) {
    // زيادة العداد وتحديث العرض
    ipPinningAttempts++;
    let counterElem = document.getElementById('fh_pinning_counter');
    let countElem = document.getElementById('fh_pinning_count');
    if (counterElem) counterElem.style.display = 'inline';
    if (countElem) countElem.textContent = ipPinningAttempts;

    setTimeout(()=>{
        if (ipPinningActive && prev.status === "Connected" && !airplaneProcess.active) {
            updateProcessStatus(`${t('messages.pinningActive')} - ${t('messages.searchingIP')}`);
            triggerAirplaneMode();
        }
    }, 3000);
}

        // Check if auto speed test is enabled and IP changed
        if (speedTestEnabled && !speedTestInProgress && status === "Connected" &&
            publicip !== "Failed!" && publicip !== "Unknown" &&
            (prev.pub !== publicip || speedTestCycle)) {
            setTimeout(()=>{
                if (prev.status === "Connected" && !speedTestInProgress) {
                    runSpeedTest(true);
                }
            }, 3000);
        }
    }
}

function logStatus(status, wan, pub, speedData = null) {
    let time = new Date().toLocaleTimeString(currentLang === 'ar' ? 'ar-SA' : 'en-US');
    let entry = `<div style="background:#ffffff05;padding:12px;border-radius:12px;margin-bottom:8px;border:1px solid #ffffff10;">`;
    entry += `<span style="color:${colors.yellow};font-weight:bold;">${time}</span> | `;
    entry += `<b>${t('labels.status')}:</b> <span style="color:${status=="Connected"?colors.green:colors.red};font-weight:bold">${t(`status.${status.toLowerCase()}`)}</span>`;
    entry += `<br><b>${t('labels.wanIP')}:</b> <span style="color:${colors.blue}">${wan}</span>`;
    entry += `<br><b>${t('labels.publicIP')}:</b> <span style="color:${colors.orange}">${pub}</span>`;
    if (speedData) {
        entry += `<br><b>${t('labels.speed')}:</b> <span style="color:${colors.green}">${speedData.download} Mbps</span>`;
        entry += ` | <b>${t('labels.ping')}:</b> <span style="color:${colors.yellow}">${speedData.ping} ms</span>`;
        entry += ` | <b>${t('labels.upload')}:</b> <span style="color:${colors.purple}">${speedData.upload} Mbps</span>`;
    }
    entry += `</div>`;
    logList.unshift(entry);
    updateLogDisplay();
}

function updateLogDisplay() {
    let el = document.getElementById('fh_ip_log');
    if(el) el.innerHTML = logList.join("") || `<div style="color:#666;text-align:center;">${t('messages.noLogs')}</div>`;
}

// GET WAN IP + STATUS
function getModemInfo() {
    return new Promise(resolve => {
        let ifr = document.getElementById('fh_net_iframe');
        if (ifr) ifr.remove();
        ifr = document.createElement('iframe');
        ifr.id = 'fh_net_iframe';
        ifr.style.display = 'none';
        ifr.src = "/main.html#/networkInfo";
        document.body.appendChild(ifr);

        setTimeout(()=>{
            try {
                let doc = ifr.contentDocument || ifr.contentWindow.document;
                let netStatus = "Unknown", wanIP = "Unknown";
                doc.querySelectorAll("tr").forEach(tr=>{
                    let th = tr.querySelector("th");
                    let td = tr.querySelector("td");
                    if(!th || !td) return;
                    if(/Network Status/i.test(th.textContent)) netStatus = td.textContent.trim();
                    if(/WAN IP Address/i.test(th.textContent)) wanIP = td.textContent.trim();
                });
                if (wanIP == "" || wanIP=="-") wanIP = "Unknown";
                if (netStatus == "" || netStatus=="-") netStatus = "Unknown";
                resolve({status: netStatus, wanip: wanIP});
            } catch(e) {
                resolve({status:"Unknown", wanip:"Unknown"});
            }
            setTimeout(()=>{ ifr.remove(); },550);
        }, 950);
    });
}

// GET PUBLIC IP
async function fetchPublicIP() {
    let sources = [
        async()=>{ let r=await fetch("https://api.ipify.org?format=json"); return (await r.json()).ip; },
        async()=>{ let r=await fetch("https://ipv4.icanhazip.com/"); return (await r.text()).trim(); },
        async()=>{ let r=await fetch("https://ipinfo.io/json"); return (await r.json()).ip; },
    ];
    for (let fn of sources) {
        try {
            let ip = await fn();
            if (/^\d+\.\d+\.\d+\.\d+$/.test(ip)) return ip;
        } catch(e){}
    }
    return "Failed!";
}

// SPEED TEST
function runSpeedTest(auto = false) {
    if (speedTestInProgress) {
        console.log('Speed test already in progress, skipping...');
        return;
    }

    if (speedTestWindow && !speedTestWindow.closed) {
        speedTestWindow.close();
    }

    speedTestInProgress = true;
    updateProcessStatus(`🚀 ${t('messages.openingFast')}`);
    GM_setValue('speedTestRequested', true);
    GM_setValue('currentPublicIP', prev.pub);

    speedTestWindow = window.open('https://fast.com/', '_blank');

    setTimeout(()=>{
        if (speedTestInProgress) {
            updateProcessStatus(`⏳ ${t('messages.waitingTest')}`);
        }
    }, 3000);

    let timeout = null;

    let checkInterval = setInterval(()=>{
        if (GM_getValue('speedTestShouldRetry', false)) {
            GM_setValue('speedTestShouldRetry', false);
            speedTestInProgress = false;
            if (speedTestWindow && !speedTestWindow.closed) {
                speedTestWindow.close();
            }
            speedTestWindow = null;
            speedTestRetryCount++;

            logList.unshift(`<div style="color:${colors.red}">🔁 ${t('messages.networkError')} (Retry #${speedTestRetryCount})</div>`);
            updateLogDisplay();

            clearInterval(checkInterval);
            if (timeout) clearTimeout(timeout);

            if (speedTestRetryCount >= 5) {
                logList.unshift(`<div style="color:${colors.red}">❌ ${t('messages.maxRetries')}</div>`);
                updateLogDisplay();
                speedTestRetryCount = 0;
                return;
            }
            setTimeout(()=>{ runSpeedTest(auto); }, 3000);
            return;
        }

        let result = GM_getValue('speedTestResult', null);
        if (result) {
            GM_setValue('speedTestResult', null);
            clearInterval(checkInterval);
            if (timeout) clearTimeout(timeout);

            speedTestInProgress = false;
            speedTestRetryCount = 0;

            logStatus("Connected", lastKnownWAN, prev.pub, result);
            updateProcessStatus("");

            if (speedTestWindow && !speedTestWindow.closed) {
                speedTestWindow.close();
            }
            speedTestWindow = null;

            if (auto && speedTestCycle && speedTestEnabled) {
                logList.unshift(`<div style="color:${colors.yellow}">⏳ ${t('messages.waitingNext')}</div>`);
                updateLogDisplay();
                setTimeout(()=>{
                    if (!airplaneProcess.active) {
                        triggerAirplaneMode();
                    }
                }, 3000);
            }
        }
    }, 1000);

    timeout = setTimeout(()=>{
        clearInterval(checkInterval);
        speedTestInProgress = false;
        updateProcessStatus("");

        if (speedTestWindow && !speedTestWindow.closed) {
            speedTestWindow.close();
        }
        speedTestWindow = null;

        GM_setValue('speedTestRequested', false);

        if (!auto) {
            alert("Speed test timeout! Please try again.");
        } else {
            logList.unshift(`<div style="color:${colors.red}">⚠️ ${t('messages.testTimeout')}</div>`);
            updateLogDisplay();

            if (speedTestCycle && speedTestEnabled) {
                logList.unshift(`<div style="color:${colors.yellow}">⏳ ${t('messages.waitingNext')}</div>`);
                updateLogDisplay();
                setTimeout(()=>{
                    if (!airplaneProcess.active) {
                        triggerAirplaneMode();
                    }
                }, 3000);
            }
        }
    }, 90000);
}

// AIRPLANE MODE
function updateProcessStatus(msg) {
    let el = document.getElementById('fh_process_status');
    if (el) {
        el.style.display = msg ? 'block' : 'none';
        el.textContent = msg;
    }
}

function triggerAirplaneMode() {
    if (airplaneProcess.active) {
        alert(t('messages.processRunning'));
        return;
    }

    airplaneProcess.active = true;
    watcherActive = true;
    speedTestCycle = speedTestEnabled;

    let btn = document.getElementById('fh_change_ip');
    if (btn) {
        btn.disabled = true;
        btn.style.background = '#444';
        btn.style.cursor = 'not-allowed';
    }

    logList.unshift(`<div style="color:${colors.fg};font-weight:bold;background:#00ffcc20;padding:8px;border-radius:8px;margin-bottom:8px;">🔄 ${t('messages.startingIPChange')}</div>`);
    updateLogDisplay();
    updateProcessStatus(`📡 ${t('messages.loadingAirplane')}`);

    let ifr = document.getElementById('fh_air_iframe');
    if (ifr) ifr.remove();
    ifr = document.createElement('iframe');
    ifr.id = 'fh_air_iframe';
    ifr.style.display = 'none';
    ifr.src = "/main.html#/mobileNetwork/networkSet";
    document.body.appendChild(ifr);

    executeAirplaneSequence(ifr);

    if(interval) clearInterval(interval);
    interval = setInterval(()=>updateInfo(), 2000);
}

async function executeAirplaneSequence(ifr) {
    try {
        await new Promise(r => setTimeout(r, 1500));

        updateProcessStatus(`✈️ ${t('messages.enablingAirplane')}`);
        let doc = ifr.contentDocument || ifr.contentWindow.document;
        let sw = doc.querySelector('input[type=checkbox].el-switch__input');

        if (sw && !sw.checked) {
            sw.click();
            logList.unshift(`<div style="color:${colors.green}">✅ ${t('messages.airplaneEnabled')}</div>`);
            updateLogDisplay();
        }

        for(let i = 8; i > 0; i--) {
            updateProcessStatus(`⏱️ ${t('messages.waiting')} ${i} ${t('messages.seconds')}...`);
            await new Promise(r => setTimeout(r, 1000));
        }

        updateProcessStatus(`📡 ${t('messages.disablingAirplane')}`);
        sw = doc.querySelector('input[type=checkbox].el-switch__input');
        if (sw && sw.checked) {
            sw.click();
            logList.unshift(`<div style="color:${colors.green}">✅ ${t('messages.airplaneDisabled')}</div>`);
            updateLogDisplay();
        }

        updateProcessStatus(`🔄 ${t('messages.waitingReconnect')}`);
        await new Promise(r => setTimeout(r, 3000));

        updateProcessStatus("");
        ifr.remove();
        logList.unshift(`<div style="color:${colors.green};font-weight:bold;background:#00ff8820;padding:8px;border-radius:8px;margin-bottom:8px;">✅ ${t('messages.ipChangeComplete')}</div>`);
        updateLogDisplay();

        setTimeout(()=>{
            // Speed test or IP pinning will be handled by updateInfo
        }, 1000);

    } catch(e) {
        logList.unshift(`<div style="color:${colors.red}">❌ ${t('messages.error')}: ${e.message}</div>`);
        updateLogDisplay();
        updateProcessStatus("");
    } finally {
        airplaneProcess.active = false;
        watcherActive = false;
        let btn = document.getElementById('fh_change_ip');
        if (btn) {
            btn.disabled = false;
            btn.style.background = `linear-gradient(135deg,${colors.green},${colors.blue})`;
            btn.style.cursor = 'pointer';
        }
    }
}

// SAVE LOG
function saveLogToFile() {
    let text = `${t('mainTitle')} - ${t('labels.networkLog')}\n`;
    text += "Generated: " + new Date().toLocaleString(currentLang === 'ar' ? 'ar-SA' : 'en-US') + "\n";
    text += "=====================================\n\n";

    let tempDiv = document.createElement('div');
    logList.forEach(log => {
        tempDiv.innerHTML = log;
        text += tempDiv.textContent.trim() + "\n\n";
    });

    let blob = new Blob([text], {type: 'text/plain'});
    let a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `IP_Monitor_Log_${new Date().toISOString().slice(0,10)}.txt`;
    a.click();
}

// DRAG FUNCTIONALITY
function makeDraggable(box, handle) {
    let offsetX, offsetY, drag = false;
    handle.onmousedown = function(e) {
        if (e.target.classList.contains('lang-btn') || e.target.id === 'fh_stats_close') return;
        drag = true;
        box.style.transition = 'none';
        offsetX = e.clientX - box.getBoundingClientRect().left;
        offsetY = e.clientY - box.getBoundingClientRect().top;
        document.body.style.userSelect = "none";
        handle.style.cursor = "grabbing";
    };
    document.addEventListener('mousemove', function(e) {
        if (drag) {
            box.style.left = (e.clientX - offsetX) + "px";
            box.style.top = (e.clientY - offsetY) + "px";
            box.style.transform = "none";
        }
    });
    document.addEventListener('mouseup', function() {
        drag = false;
        document.body.style.userSelect = "";
        handle.style.cursor = "grab";
    });
}

// FAST.COM HANDLER
function handleFastCom() {
    if (!GM_getValue('speedTestRequested', false)) return;

    let resultFound = false, detailsLoaded = false, retryCount = 0;
    let startZeroTime = null;

    let checkInterval = setInterval(() => {
        let speedElem   = document.querySelector('#speed-value');
        let uploadElem  = document.querySelector('#upload-value');
        let latencyElem = document.querySelector('#latency-value');

        let download = speedElem   ? speedElem.textContent.trim()   : "0";
        let upload   = uploadElem  ? uploadElem.textContent.trim()  : "0";
        let ping     = latencyElem ? latencyElem.textContent.trim() : "0";

        let noConnElem = document.querySelector('div#error-results-msg[loc-str="no_connection"]');
        let noConnVisible = noConnElem && (noConnElem.offsetParent !== null || noConnElem.style.display === 'block' || noConnElem.style.display === '');

        if (noConnVisible && download === "0" && upload === "0" && ping === "0") {
            if (!startZeroTime) startZeroTime = Date.now();
            if (Date.now() - startZeroTime >= 5000) {
                retryCount = (retryCount || 0) + 1;
                console.log(`Fast.com: Real failure (all zero for 5+ sec), will close and retry. (Retry #${retryCount})`);
                GM_setValue('speedTestRequested', false);
                GM_setValue('speedTestShouldRetry', true);
                setTimeout(() => { window.close(); }, 500);
                clearInterval(checkInterval);
                return;
            }
        } else {
            startZeroTime = null;
        }

        let progressIndicator = document.querySelector('#speed-progress-indicator');
        if (
            progressIndicator && progressIndicator.classList.contains('succeeded') &&
            !progressIndicator.classList.contains('in-progress') &&
            speedElem && download !== "0" &&
            !detailsLoaded
        ) {
            detailsLoaded = true;
            let moreLink = document.querySelector('#show-more-details-link');
            if (moreLink && moreLink.style.display !== 'none') {
                moreLink.click();
            }

            let uploadSuccessCheck = setInterval(() => {
                let uploadElemDone = document.querySelector('#upload-value.extra-measurement-value-container.succeeded');
                if (uploadElemDone && uploadElemDone.textContent && uploadElemDone.textContent !== '0') {
                    clearInterval(uploadSuccessCheck);

                    setTimeout(() => {
                        let latencyElem = document.querySelector('#latency-value');
                        let speedValue  = document.querySelector('#speed-value');
                        let upload      = uploadElemDone.textContent;
                        let download    = speedValue ? speedValue.textContent : null;
                        let ping        = latencyElem ? latencyElem.textContent : null;

                        if (
                            upload && upload !== '0' &&
                            download && download !== '0' &&
                            ping && ping !== '0'
                        ) {
                            saveFastComResult({download, ping, upload});
                            clearInterval(checkInterval);
                            resultFound = true;
                        }
                    }, 3000);
                }
            }, 500);
        }
    }, 800);

    setTimeout(() => {
        clearInterval(checkInterval);
        if (!resultFound) {
            console.log('Test timeout, closing window...');
            GM_setValue('speedTestRequested', false);
            window.close();
        }
    }, 90000);

    function saveFastComResult(result) {
        let data = {
            download: result.download,
            ping: result.ping,
            upload: result.upload,
            ip: GM_getValue('currentPublicIP', 'Unknown'),
            timestamp: new Date().toISOString()
        };
        GM_setValue('speedTestResult', data);
        GM_setValue('speedTestRequested', false);

        let body = document.body;
        let msg = document.createElement('div');
        msg.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#00ff88;color:#000;padding:20px;border-radius:10px;font-size:20px;font-weight:bold;z-index:9999;';
        msg.textContent = `✅ ${t('messages.testCompleted')}`;
        body.appendChild(msg);

        setTimeout(() => { window.close(); }, 2000);
    }
}

// STATS WINDOW
function showStatsWindow() {
    if (document.getElementById('fh_stats_window')) return;
    let rows = extractSpeedRows(logList);

    let sortBy = 'speed', sortDir = -1;

    function sortRows() {
        rows.sort((a, b) => {
            let va = a[sortBy], vb = b[sortBy];
            if (sortBy === "ping") return (parseFloat(va) - parseFloat(vb)) * sortDir;
            else return (parseFloat(vb) - parseFloat(va)) * sortDir;
        });
    }
    sortRows();

    let win = document.createElement('div');
    win.id = 'fh_stats_window';
    win.style.cssText = `
        position:fixed;top:100px;left:50%;transform:translateX(-50%);
        background:#181a24;padding:0 0 26px 0;border-radius:28px;
        min-width:700px;max-width:900px;z-index:200042;
        box-shadow:0 18px 60px #000c;
        border:1.5px solid #00ffcc40;
        font-family:'Segoe UI',system-ui,sans-serif;
        animation:fadein .2s;
        display:flex;flex-direction:column;
        direction: ${currentLang === 'ar' ? 'rtl' : 'ltr'};
    `;

    win.innerHTML = `
        <div id="fh_stats_drag" style="padding:18px 34px 10px 34px;display:flex;align-items:center;user-select:none;cursor:grab;">
            <span style="font-size:2.12rem;color:#27ffd1;font-weight:900;letter-spacing:1px;flex:1;text-align:center;">${t('statsTable.title')}</span>
            <button id="fh_stats_close" style="background:#2e3647;color:#fff;border-radius:11px;border:none;padding:8px 22px;font-size:1.12rem;font-weight:700;cursor:pointer;box-shadow:0 2px 8px #0004;margin-${currentLang === 'ar' ? 'right' : 'left'}:10px;">${t('buttons.close')}</button>
        </div>
        <div style="padding:0 34px 8px 34px;text-align:center;">
            <span style="color:#00ffaa;font-size:1.09rem;font-weight:700;background:#222d39;padding:7px 18px;border-radius:12px;box-shadow:0 1px 8px #00ffa911;">
                ${t('messages.testCount')}: <span style="color:#ffe14c;font-size:1.12em;font-weight:bold;">${rows.length}</span>
            </span>
        </div>
        <div id="fh_stats_container" style="padding:0 30px;">
            <div id="fh_stats_table_wrap" style="overflow-x:auto;margin-top:16px;"></div>
        </div>
    `;
    document.body.appendChild(win);

    makeDraggable(win, win.querySelector("#fh_stats_drag"));

    document.getElementById('fh_stats_close').onclick = ()=>{ win.remove(); };

    function renderTable() {
        let getArrow = (key) => {
            if (sortBy !== key) return "";
            return sortDir === 1 ? " <span style='color:#25ff95;font-size:1.03em;'>&#8593;</span>" : " <span style='color:#ff5189;font-size:1.03em;'>&#8595;</span>";
        };
        let table = `
        <table style="width:100%;border-collapse:separate;border-spacing:0 7px;font-size:1.19rem;">
            <thead>
                <tr style="background:#243042;">
                    <th style="padding:13px 8px;min-width:56px;border-radius:13px 0 0 0;">${t('statsTable.headers.number')}</th>
                    <th style="padding:13px 8px;min-width:123px;">${t('statsTable.headers.wanIP')}</th>
                    <th style="padding:13px 8px;min-width:123px;">${t('statsTable.headers.publicIP')}</th>
                    <th id="sort_speed"  style="padding:13px 8px;min-width:92px;cursor:pointer;user-select:none;">${t('statsTable.headers.speed')}${getArrow('speed')}</th>
                    <th id="sort_upload" style="padding:13px 8px;min-width:92px;cursor:pointer;user-select:none;">${t('statsTable.headers.upload')}${getArrow('upload')}</th>
                    <th id="sort_ping"   style="padding:13px 8px;min-width:92px;cursor:pointer;user-select:none;border-radius:0 13px 0 0;">${t('statsTable.headers.ping')}${getArrow('ping')}</th>
                </tr>
            </thead>
            <tbody>
                ${rows.map((r, i) => `
                <tr style="background:${i%2 ? "#223049" : "#181f2d"};transition:.15s;">
                    <td style="text-align:center;padding:10px 0;font-weight:bold;color:#ffe14c;font-size:1.07em;">${i+1}</td>
                    <td style="text-align:center;padding:10px 7px;color:#10bcff;font-family:monospace;font-size:1.07em;">${r.wan}</td>
                    <td style="text-align:center;padding:10px 7px;color:#ffa726;font-family:monospace;font-size:1.07em;">${r.pub}</td>
                    <td style="text-align:center;padding:10px 7px;font-weight:900;color:#25ff95;font-size:1.14em;">${r.speed}</td>
                    <td style="text-align:center;padding:10px 7px;font-weight:700;color:#cc6aff;">${r.upload}</td>
                    <td style="text-align:center;padding:10px 7px;font-weight:700;color:#ffe35e;">${r.ping}</td>
                </tr>
                `).join('')}
            </tbody>
        </table>
        `;
        document.getElementById('fh_stats_table_wrap').innerHTML = table;

        document.getElementById('sort_speed').onclick = () => {
            if (sortBy == 'speed') sortDir *= -1; else { sortBy = 'speed'; sortDir = -1; }
            sortRows(); renderTable();
        };
        document.getElementById('sort_upload').onclick = () => {
            if (sortBy == 'upload') sortDir *= -1; else { sortBy = 'upload'; sortDir = -1; }
            sortRows(); renderTable();
        };
        document.getElementById('sort_ping').onclick = () => {
            if (sortBy == 'ping') sortDir *= -1; else { sortBy = 'ping'; sortDir = 1; }
            sortRows(); renderTable();
        };
    }
    renderTable();
}

function extractSpeedRows(logArr) {
    let out = [];
    let tempDiv = document.createElement('div');
    for (let i = 0; i < logArr.length; i++) {
        tempDiv.innerHTML = logArr[i];
        let plain = tempDiv.textContent || tempDiv.innerText || "";
        let m = plain.match(
            /(?:WAN IP|IP الشبكة):\s*([0-9\.]+).*?(?:Public IP|IP العام):\s*([0-9\.]+).*?(?:Speed|السرعة):\s*(\d+)\s*Mbps\s*\|\s*(?:Ping|البنج):\s*(\d+)\s*ms\s*\|\s*(?:Upload|الرفع):\s*(\d+)\s*Mbps/i
        );
        if (m) {
            out.push({
                wan: m[1].trim(),
                pub: m[2].trim(),
                speed: m[3].trim(),
                ping: m[4].trim(),
                upload: m[5].trim()
            });
        }
    }
    return out;
}

// Add CSS animation
const style = document.createElement('style');
style.textContent = `
    @keyframes fadein {
        from { opacity: 0; transform: translateX(-50%) translateY(-20px); }
        to { opacity: 1; transform: translateX(-50%) translateY(0); }
    }
`;
document.head.appendChild(style);
})();
