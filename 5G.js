// ==UserScript==
// @name         Modem Signal Monitor - Neighbour Colors + Live Update
// @namespace    http://tampermonkey.net/
// @version      1.5
// @description  نافذة واحدة مع ألوان للإشارات وجداول الأبراج القريبة متجددة باستمرار
// @author       fahad 0day
// @match        *://192.168.8.1/*
// @grant        none
// ==/UserScript==

let currentTab = "main";
let imeiCurrentValue = "";
let imeiChangeResult = "";
let imeiMasked = true; // افتراضي مفعّل (true = تمويه)


(function() {
    'use strict';

    // ============ ألوان الإشارات ============
    function getTemperatureColor(temp) {
        if (temp == null) return "#666";
        if (temp < 35) return "#00ff00";
        if (temp < 45) return "#ffaa00";
        return "#ff0000";
    }
    const getColor = {
        RSRP: (val) => {
            if (val == null) return "#666";
            if (val >= -80) return "#00ff00";
            if (val >= -90) return "#90EE90";
            if (val >= -100) return "#ffcc00";
            if (val >= -110) return "#ff6600";
            return "#ff0000";
        },
        RSRQ: (val) => {
            if (val == null) return "#666";
            if (val >= -10) return "#00ff00";
            if (val >= -15) return "#90EE90";
            if (val >= -20) return "#ffcc00";
            return "#ff6600";
        },
        SINR: (val) => {
            if (val == null) return "#666";
            if (val >= 20) return "#00ff00";
            if (val >= 13) return "#90EE90";
            if (val >= 0) return "#ffcc00";
            return "#ff6600";
        },
        RSSI: (val) => {
            if (val == null) return "#666";
            if (val >= -65) return "#00ff00";
            if (val >= -75) return "#90EE90";
            if (val >= -85) return "#ffcc00";
            return "#ff6600";
        }
    };
    function parseNumber(str) {
        if (!str) return null;
        return parseFloat(str.replace(/[^\d\.\-]/g, ''));
    }

    // ============ بناء النافذة ============
const button = document.createElement('button');
button.innerHTML = '📡 سكربت فايبر هوم - عالم الراوترات';
button.style.cssText = `
    position: fixed; left: 50%; top: 10px; transform: translateX(-50%);
    background: #2196F3; color: white;
    border: none; padding: 13px 28px; border-radius: 25px; cursor: pointer;
    font-family: Arial, sans-serif; font-size: 17px; z-index: 9999;
    box-shadow: 0 2px 10px rgba(0,0,0,0.18); transition: all 0.3s ease;
    font-weight: bold; letter-spacing: 0.7px;
`;
button.onmouseover = () => button.style.background = '#1976D2';
button.onmouseout = () => button.style.background = '#2196F3';
document.body.appendChild(button);


    // النافذة نفسها
    const popup = document.createElement('div');
    popup.style.cssText = `
        display: none; position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
        background: #1a1a1a; border-radius: 10px; box-shadow: 0 10px 50px rgba(0,0,0,0.5);
        z-index: 10000; min-width: 700px; max-width: 900px; font-family: Arial, sans-serif; color: white; overflow: hidden;
    `;
popup.innerHTML = `
    <div id="popupHeader" style="direction: ltr; background: linear-gradient(90deg, #2196F3 0%, #00BCD4 100%); padding: 15px 20px 10px 20px; display: flex; justify-content: space-between; align-items: center;">
        <div style="display: flex; gap: 8px;">
            <button id="closeBtn" style="background: rgba(255,255,255,0.2); border: none; color: white; padding: 8px 20px; border-radius: 20px; cursor: pointer; font-size: 14px;">✕ إغلاق</button>
        </div>
        <div style="display: flex; gap: 10px;">
        <button id="aboutTab" class="tabBtn" style="background: rgba(255,255,255,0.2); color: white; border-radius: 20px; border: none; padding: 8px 20px; cursor: pointer; font-size: 14px;">حول</button>
            <button id="refreshBtn" style="background: rgba(255,255,255,0.2); border: none; color: white; padding: 8px 20px; border-radius: 20px; cursor: pointer; font-size: 14px;">⟳ تحديث</button>
            <button id="imeiTab" class="tabBtn" style="background: rgba(255,255,255,0.2); color: white; border-radius: 20px; border: none; padding: 8px 20px; cursor: pointer; font-size: 14px;"> IMEI تغير</button>
            <button id="atTab" class="tabBtn" style="background: rgba(255,255,255,0.2); color: white; border-radius: 20px; border: none; padding: 8px 20px; cursor: pointer; font-size: 14px;"> AT أوامر</button>
            <button id="neighbourTab" class="tabBtn" style="background: rgba(255,255,255,0.2); color: white; border-radius: 20px; border: none; padding: 8px 20px; cursor: pointer; font-size: 14px;">الأبراج القريبة</button>
            <button id="mainTab" class="tabBtn active" style="background: rgba(255,255,255,0.3); color: white; border-radius: 20px; border: none; padding: 8px 20px; cursor: pointer; font-size: 14px;">الرئيسية</button>
        </div>
    </div>
    <div id="signalContent" style="padding: 20px; cursor: default; max-height: 80vh; overflow-y: auto;">
        <div style="text-align: center; color: #888;">
            <div style="font-size: 20px; margin: 20px;">⟳</div>
            جاري تحميل البيانات...
        </div>
    </div>
`;


    document.body.appendChild(popup);

    // إضافة تأثيرات hover للأزرار
    const addHoverEffects = () => {
        const buttons = popup.querySelectorAll('button');
        buttons.forEach(btn => {
            btn.addEventListener('mouseover', function() {
                if (!this.classList.contains('active')) {
                    this.style.background = 'rgba(255,255,255,0.3)';
                }
            });
            btn.addEventListener('mouseout', function() {
                if (!this.classList.contains('active')) {
                    this.style.background = 'rgba(255,255,255,0.2)';
                }
            });
        });
    };
    addHoverEffects();

    // سحب النافذة
    let isDragging = false, dragOffset = { x: 0, y: 0 };
    popup.querySelector('#popupHeader').addEventListener('mousedown', function(e){
        isDragging = true;
        const rect = popup.getBoundingClientRect();
        dragOffset.x = e.clientX - rect.left;
        dragOffset.y = e.clientY - rect.top;
        document.body.style.userSelect = 'none';
    });
    document.addEventListener('mousemove', function(e){
        if (!isDragging) return;
        let newX = e.clientX - dragOffset.x, newY = e.clientY - dragOffset.y;
        const rect = popup.getBoundingClientRect();
        newX = Math.max(0, Math.min(newX, window.innerWidth-rect.width));
        newY = Math.max(0, Math.min(newY, window.innerHeight-rect.height));
        popup.style.left = newX + 'px'; popup.style.top = newY + 'px'; popup.style.transform = 'none';
    });
    document.addEventListener('mouseup', function(){ if (isDragging) { isDragging = false; document.body.style.userSelect = ''; }});

    // --- بيانات وتحديثات ---
    let cache = {signals: {lte:{}, nr:{}}, device: {}, ca: [], neighbour: null};
    let updateInterval = null;

    // --- جلب البيانات ---
    async function fetchDeviceInfo() {
        return new Promise((resolve) => {
            const iframe = document.createElement('iframe');
            iframe.style.display = 'none';
            iframe.src = '/main.html?8630#/status/deviceInfo';
            iframe.onload = function() {
                setTimeout(() => {
                    try {
                        const doc = iframe.contentDocument || iframe.contentWindow.document;
                        const rows = doc.querySelectorAll('tr');
                        let deviceData = {};
                        rows.forEach(tr => {
                            const th = tr.querySelector('th');
                            const td = tr.querySelector('td');
                            if (th && td) {
                                const key = th.textContent.trim();
                                const value = td.textContent.trim();
                                if (key === 'Manufacturer') deviceData.manufacturer = value;
                                else if (key === 'Software Version') deviceData.softwareVersion = value;
                                else if (key === 'CPU Temperature') {
                                    const tempMatch = value.match(/(\d+\.?\d*)/);
                                    deviceData.cpuTemperature = tempMatch ? parseFloat(tempMatch[1]) : null;
                                    deviceData.cpuTemperatureText = value;
                                }
                            }
                        });
                        document.body.removeChild(iframe);
                        resolve(deviceData);
                    } catch(e){ document.body.removeChild(iframe); resolve({}); }
                }, 2000);
            };
            document.body.appendChild(iframe);
        });
    }
    async function fetchCarrierAggregation() {
        return new Promise((resolve) => {
            const iframe = document.createElement('iframe');
            iframe.style.display = 'none';
            iframe.src = '/main.html?4009#/mobileNetwork/carrierAggregation';
            iframe.onload = function() {
                setTimeout(() => {
                    try {
                        const doc = iframe.contentDocument || iframe.contentWindow.document;
                        const pageContent = doc.querySelector('.page_content');
                        const table = pageContent && pageContent.querySelector('table.el-table__body');
                        let caData = [];
                        if (table){
                            const rows = Array.from(table.querySelectorAll('tr'));
                            let states = [], bands = [], arfcn = [], bandwidths = [];
                            rows.forEach(row => {
                                const cells = Array.from(row.querySelectorAll('td')).map(td => td.innerText.trim());
                                if (cells[0] === "State") states = cells.slice(1);
                                if (cells[0] === "Band") bands = cells.slice(1);
                                if (cells[0] === "Arfcn") arfcn = cells.slice(1);
                                if (cells[0] === "DL_BandWidth") bandwidths = cells.slice(1);
                            });
                            for (let i = 0; i < states.length; ++i) {
                                let st = (states[i] || '').toLowerCase();
                                if (st === "activated" || st === "actived") {
                                    let bandVal = (bands[i] || '').trim();
                                    let bandName = "";
                                    let isNR = false;
                                    if (/^n?\s*78$/i.test(bandVal)) {bandName="N78";isNR=true;}
                                    else if (/^n?\s*41$/i.test(bandVal)) {bandName="N41";isNR=true;}
                                    else if (/^n\d+$/i.test(bandVal)) {bandName=bandVal.toUpperCase();isNR=true;}
                                    else if (/^\d+$/.test(bandVal)) {bandName="B"+bandVal;isNR=false;}
                                    else bandName=bandVal;
                                    let bw = bandwidths[i] || '', freq = arfcn[i] || '';
                                    caData.push({
                                        band: bandName, bandwidth: bw, frequency: freq, isNR: isNR,
                                        sortKey: (isNR ? 1000 : 0) + (parseInt(bw.replace(/[^\d]/g, '')) || 0)
                                    });
                                }
                            }
                            caData.sort((a, b) => b.sortKey - a.sortKey);
                        }
                        document.body.removeChild(iframe);
                        resolve(caData);
                    } catch(e){ document.body.removeChild(iframe); resolve([]); }
                }, 2000);
            };
            document.body.appendChild(iframe);
        });
    }
    async function fetchSignalData() {
        return new Promise((resolve) => {
            const iframe = document.createElement('iframe');
            iframe.style.display = 'none';
            iframe.src = '/main.html#/mobileNetwork/rfSignal';
            iframe.onload = function() {
                setTimeout(() => {
                    try {
                        const doc = iframe.contentDocument || iframe.contentWindow.document;
                        let lte = {}, nr = {};
                        let boxes = Array.from(doc.querySelectorAll(".page_box_item"));
                        for (let box of boxes) {
                            let title = box.querySelector(".rfsignal_table1_title");
                            if (title && title.textContent.trim().toUpperCase().includes("LTE")) {
                                let rows = box.querySelectorAll(".rfsignal_table_content tr");
                                rows.forEach(tr => {
                                    let key = tr.querySelector('th')?.innerText.trim();
                                    let val = tr.querySelector('td')?.innerText.trim();
                                    if (key && val) lte[key] = val;
                                });
                            }
                            if (title && title.textContent.trim().toUpperCase().includes("5G NR")) {
                                let rows = box.querySelectorAll(".rfsignal_table_content tr");
                                rows.forEach(tr => {
                                    let key = tr.querySelector('th')?.innerText.trim();
                                    let val = tr.querySelector('td')?.innerText.trim();
                                    if (key && val) nr[key] = val;
                                });
                            }
                        }
                        document.body.removeChild(iframe);
                        resolve({lte, nr});
                    } catch(e){ document.body.removeChild(iframe); resolve({lte:{}, nr:{}}); }
                }, 2000);
            };
            document.body.appendChild(iframe);
        });
    }
    async function fetchNeighbourCells() {
        return new Promise((resolve) => {
            const iframe = document.createElement('iframe');
            iframe.style.display = 'none';
            iframe.src = '/main.html?8258#/mobileNetwork/rfSignal';
            iframe.onload = function() {
                setTimeout(() => {
                    try {
                        const doc = iframe.contentDocument || iframe.contentWindow.document;
                        const container = doc.querySelector('.rfsignal_neighbour_box');
                        const table = container && container.querySelector('.rfsignal_neighbour_table');
                        let rows = [];
                        if (table) {
                            rows = Array.from(table.querySelectorAll('tr')).map(row =>
                                Array.from(row.querySelectorAll('th,td')).map(cell => cell.innerText.trim())
                            );
                        }
                        document.body.removeChild(iframe);
                        resolve(rows.length > 0 ? rows : null);
                    } catch(e){ document.body.removeChild(iframe); resolve(null); }
                }, 2000);
            };
            document.body.appendChild(iframe);
        });
    }

    // ============ جدول الأبراج القريبة ============
function renderSingleTable(headers, dataRows) {
    let thead = '<tr>' + headers.map(cell =>
        `<th style="padding:8px 12px;color:#00bcd4;border-bottom:2px solid #444;font-size:13px;white-space:nowrap;">${cell}</th>`
    ).join('') + '</tr>';

    let tbody = '';
    for (let r = 0; r < dataRows.length; r++) {
        tbody += '<tr>';
        for (let c = 0; c < dataRows[r].length; c++) {
            let cell = dataRows[r][c];
            let style = 'padding:8px 12px;text-align:center;border-bottom:1px solid #333;font-size:12px;white-space:nowrap;';
            // فقط الأرقام تلوّن حسب نوع الصف
            if (c > 0) {
                const rowLabel = dataRows[r][0].toUpperCase();
                if (rowLabel === "RSRP") style += `color:${getColor.RSRP(parseFloat(cell))};font-weight:bold;`;
                else if (rowLabel === "SINR") style += `color:${getColor.SINR(parseFloat(cell))};font-weight:bold;`;
                else if (rowLabel === "RSRQ") style += `color:${getColor.RSRQ(parseFloat(cell))};font-weight:bold;`;
                else if (rowLabel === "RSSI") style += `color:${getColor.RSSI(parseFloat(cell))};font-weight:bold;`;
                else style += 'color:#fff;';
            } else {
                style += 'color:#00bcd4;font-weight:bold;';
            }
            tbody += `<td style="${style}">${cell}</td>`;
        }
        tbody += '</tr>';
    }

    return `
        <div style="overflow-x:auto;overflow-y:hidden;">
            <table style="width:100%;background:#232323;border-radius:8px;border-spacing:0;border-collapse:collapse;min-width:300px;">
                <thead>${thead}</thead>
                <tbody>${tbody}</tbody>
            </table>
        </div>
    `;
}


function renderNeighbourCellsTable(dataRows) {
    if (!dataRows || !dataRows.length) {
        return '<div style="text-align: center; color: #888; padding: 40px;">لا توجد بيانات أبراج قريبة متاحة</div>';
    }

    // أول صف: الهيدر (أول عمود = LABEL)
    const headers = dataRows[0];
    const dataRowsOnly = dataRows.slice(1);

    // نحدّد الأعمدة (بدون أول عمود LABEL)
    const dataCols = headers.length - 1;
    const half = Math.ceil(dataCols / 2);

    // تقسم الجدولين بالتساوي (مع LABEL)
    const firstHeaders = [headers[0], ...headers.slice(1, 1 + half)];
    const secondHeaders = [headers[0], ...headers.slice(1 + half)];
    const firstRows = dataRowsOnly.map(row => [row[0], ...row.slice(1, 1 + half)]);
    const secondRows = dataRowsOnly.map(row => [row[0], ...row.slice(1 + half)]);

    return `
        <div style="margin-bottom:16px;">
            ${renderSingleTable(firstHeaders, firstRows)}
        </div>
        <div>
            ${renderSingleTable(secondHeaders, secondRows)}
        </div>
    `;
}




    // ============ عرض البيانات (رئيسية / الأبراج القريبة) ============
    function renderMain(data, deviceData, caData) {
        let html = '';
        if (deviceData && Object.keys(deviceData).length > 0) {
            html += `
                <div style="margin-bottom: 25px;">
                    <h3 style="color:#00BCD4;font-size:16px;margin-bottom:15px;">معلومات الجهاز</h3>
                    <div style="background:#2a2a2a;border-radius:8px;padding:15px;">
                        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:15px;text-align:center;">
                            <div><div style="color:#888;font-size:12px;margin-bottom:5px;">المصنع</div>
                                <div style="font-size:16px;font-weight:bold;color:#fff;">${deviceData.manufacturer || 'N/A'}</div></div>
                            <div><div style="color:#888;font-size:12px;margin-bottom:5px;">إصدار البرنامج</div>
                                <div style="font-size:16px;font-weight:bold;color:#fff;">${deviceData.softwareVersion || 'N/A'}</div></div>
                            <div><div style="color:#888;font-size:12px;margin-bottom:5px;">حرارة المعالج</div>
                                <div style="font-size:16px;font-weight:bold;color:${getTemperatureColor(deviceData.cpuTemperature)};">
                                    ${deviceData.cpuTemperatureText || 'N/A'}
                                </div></div>
                        </div>
                    </div>
                </div>
            `;
        }
        // --- 5G
        if (data.nr && Object.keys(data.nr).length > 0) {
            html += `
                <div style="margin-bottom:20px;">
                    <h3 style="color:#00BCD4;font-size:16px;margin-bottom:15px;">5G</h3>
                    <div style="background:#2a2a2a;border-radius:8px;padding:15px;">
                        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:15px;text-align:center;">
                            <div><div style="color:#888;font-size:12px;margin-bottom:5px;">RSRP</div>
                                <div style="font-size:20px;font-weight:bold;color:${getColor.RSRP(parseNumber(data.nr.RSRP))};">${data.nr.RSRP || 'N/A'}</div></div>
                            <div><div style="color:#888;font-size:12px;margin-bottom:5px;">RSRQ</div>
                                <div style="font-size:20px;font-weight:bold;color:${getColor.RSRQ(parseNumber(data.nr.RSRQ))};">${data.nr.RSRQ || 'N/A'}</div></div>
                            <div><div style="color:#888;font-size:12px;margin-bottom:5px;">SINR</div>
                                <div style="font-size:20px;font-weight:bold;color:${getColor.SINR(parseNumber(data.nr.SINR))};">${data.nr.SINR || 'N/A'}</div></div>
                            <div><div style="color:#888;font-size:12px;margin-bottom:5px;">PCI</div>
                                <div style="font-size:20px;font-weight:bold;">${data.nr.PCI || 'N/A'}</div></div>
                        </div>
                        <div style="margin-top:15px;padding-top:15px;border-top:1px solid #444;text-align:center;">
                            <span style="color:#888;font-size:12px;">BAND: </span>
                            <span style="color:#fff;font-weight:bold;">${data.nr.BAND || 'N/A'}</span>
                        </div>
                    </div>
                </div>
            `;
        }
        // --- 4G
        if (data.lte && Object.keys(data.lte).length > 0) {
            html += `
                <div>
                    <h3 style="color:#00BCD4;font-size:16px;margin-bottom:15px;">4G</h3>
                    <div style="background:#2a2a2a;border-radius:8px;padding:15px;">
                        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:15px;text-align:center;">
                            <div><div style="color:#888;font-size:12px;margin-bottom:5px;">RSRP</div>
                                <div style="font-size:20px;font-weight:bold;color:${getColor.RSRP(parseNumber(data.lte.RSRP))};">${data.lte.RSRP || 'N/A'}</div></div>
                            <div><div style="color:#888;font-size:12px;margin-bottom:5px;">RSRQ</div>
                                <div style="font-size:20px;font-weight:bold;color:${getColor.RSRQ(parseNumber(data.lte.RSRQ))};">${data.lte.RSRQ || 'N/A'}</div></div>
                            <div><div style="color:#888;font-size:12px;margin-bottom:5px;">SINR</div>
                                <div style="font-size:20px;font-weight:bold;color:${getColor.SINR(parseNumber(data.lte.SINR))};">${data.lte.SINR || 'N/A'}</div></div>
                            <div><div style="color:#888;font-size:12px;margin-bottom:5px;">PCI</div>
                                <div style="font-size:20px;font-weight:bold;">${data.lte.PCI || 'N/A'}</div></div>
                        </div>
                        <div style="margin-top:15px;padding-top:15px;border-top:1px solid #444;text-align:center;">
                            <span style="color:#888;font-size:12px;">BAND: </span>
                            <span style="color:#fff;font-weight:bold;">${data.lte.BAND || 'N/A'}</span>
                        </div>
                    </div>
                </div>
            `;
        }
        // --- CA
        html += `
            <div style="margin-top:20px;">
                <h3 style="color:#00BCD4;font-size:16px;margin-bottom:15px;">قراءات الدمج</h3>
                <div style="background:#2a2a2a;border-radius:8px;padding:15px;">
                    <div style="text-align:center;">
                        <div style="color:#888;font-size:12px;margin-bottom:8px;">الترددات النشطة</div>
                        <div style="font-size:14px;font-weight:bold;color:#fff;word-wrap:break-word;line-height:1.4;">
                            ${formatCarrierAggregation(cache.ca)}
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.getElementById('signalContent').innerHTML = html;
    }

function renderNeighbourTab(neighbourCellsData) {
    let html = `
        <div style="color:orange;font-size:21px;font-weight:bold;margin-bottom:10px; text-align:center;">
            الأبراج القريبة (Neighbour Cells)
        </div>
    `;
    html += renderNeighbourCellsTable(neighbourCellsData);
    document.getElementById('signalContent').innerHTML = html;
}


    // --- فورمات دمج الترددات
    function getBandColor(band, isNR) { return isNR ? "#00e5ff" : "#76ff03"; }
    function formatCarrierAggregation(caData) {
        if (!caData || caData.length === 0) return 'غير متاح';
        return caData.map(item =>
            `<span style="color:${getBandColor(item.band, item.isNR)};font-weight:bold;">
                ${item.bandwidth}@${item.frequency} (${item.band})
            </span>`
        ).join(' <span style="color:#fff;font-weight:bold;">+</span> ');
    }

    // ============ إدارة التبويبات ============
// test at //

    let atCommandLastResult = "";
function renderATTab() {
    // 1- احفظ النص الحالي (لو موجود)
    let oldInput = "";
    const oldElem = document.getElementById('atCommandInput');
    if (oldElem) oldInput = oldElem.value;

    document.getElementById('signalContent').innerHTML = `
        <div style="color:#2ad9fa;font-size:20px;font-weight:bold;margin-bottom:14px; text-align:center;">أوامر AT للراوتر</div>
        <div style="max-width:480px;margin:0 auto 15px auto;display:flex;gap:8px;">
            <input id="atCommandInput" type="text" style="flex:1;padding:9px 15px;border-radius:8px;border:1px solid #2196F3;font-size:16px;background:#232323;color:#fff;" maxlength="128" placeholder="مثال: AT+CSQ">
            <button id="atCommandSendBtn" style="background:#2196F3;color:white;padding:9px 32px;border:none;border-radius:12px;cursor:pointer;font-weight:bold;font-size:16px;">إرسال</button>
        </div>
        <div id="atResultBox" style="margin-top:25px; background:#222; border-radius:10px; padding:15px 18px; min-height:70px; color:#fff; white-space:pre-line; font-family:Consolas,monospace; font-size:15px; box-shadow: 0 2px 8px #0002;">
            ${atCommandLastResult ? atCommandLastResult : '↡ النتيجة ستظهر هنا ↡'}
        </div>
    `;

    // 2- أرجع القيمة في مربع الإدخال لو فيه قيمة محفوظة
    if (oldInput) document.getElementById('atCommandInput').value = oldInput;

    document.getElementById('atCommandSendBtn').onclick = function() {
        let cmd = document.getElementById('atCommandInput').value.trim();
        if (!cmd || cmd.length < 2 || cmd.substr(0,2).toUpperCase() !== "AT") {
            atCommandLastResult = "❌ أدخل أمر AT يبدأ بـ AT";
            renderATTab();
            return;
        }
        atCommandLastResult = "⟳ جاري إرسال الأمر ...";
        renderATTab();
        let send = (typeof $post === "function" ? $post : (typeof unsafeWindow !== "undefined" ? unsafeWindow.$post : null));
        if (typeof send === "function") {
            send("set_at_command", {command: cmd}).then(function(response){
                atCommandLastResult = response.result ? response.result : "❌ لم يتم الحصول على رد من الراوتر";
                renderATTab();
            }).catch(function(){
                atCommandLastResult = "❌ خطأ في الاتصال أو التنفيذ";
                renderATTab();
            });
        } else {
            atCommandLastResult = "❌ دالة $post غير متاحة في هذه الصفحة. لازم تسوي السكربت ضمن صفحة الراوتر.";
            renderATTab();
        }
    };
}



    async function fetchCurrentIMEI() {
    return new Promise((resolve) => {
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = '/main.html?5071#/mobileNetwork/simInfo';
        iframe.onload = function() {
            setTimeout(() => {
                try {
                    const doc = iframe.contentDocument || iframe.contentWindow.document;
                    let imei = "";
                    const rows = doc.querySelectorAll('tr');
                    rows.forEach(tr => {
                        const th = tr.querySelector('th');
                        const td = tr.querySelector('td');
                        if (th && th.textContent.trim().toUpperCase() === "IMEI" && td) {
                            imei = td.textContent.trim();
                        }
                    });
                    document.body.removeChild(iframe);
                    resolve(imei);
                } catch(e){ document.body.removeChild(iframe); resolve(""); }
            }, 1200); // يكفي ثانية ونص للتحميل
        };
        document.body.appendChild(iframe);
    });
}





function renderIMEITab() {
    document.getElementById('signalContent').innerHTML = `
        <div style="color:#ffa726;font-size:20px;font-weight:bold;margin-bottom:14px; text-align:center;">تغيير IMEI للراوتر</div>
        <div style="max-width:420px;margin:0 auto 18px auto;display:flex;align-items:center;gap:8px;">
            <span style="color:#2ad9fa;font-size:18px;">IMEI :</span>
            <span id="currentIMEI" style="color:#fff;font-size:18px;font-family:Consolas,monospace;font-weight:bold;">
                ${imeiCurrentValue ? (imeiMasked ? maskIMEI(imeiCurrentValue) : imeiCurrentValue) : "جار التحميل..."}
            </span>
            <button id="toggleIMEIMaskBtn" style="background:rgba(255,255,255,0.13);border:none;color:#ffa726;padding:2px 14px;border-radius:7px;cursor:pointer;font-size:13px;">
                ${imeiMasked ? "إظهار" : "إخفاء"}
            </button>
        </div>
        <div style="max-width:420px;margin:0 auto 10px auto;display:flex;gap:8px;">
            <input id="imeiInput" type="text" style="flex:1;padding:9px 15px;border-radius:8px;border:1px solid #ffa726;font-size:16px;background:#232323;color:#fff;" maxlength="17" placeholder="ادخل IMEI الجديد">
            <button id="imeiSendBtn" style="background:#ffa726;color:white;padding:9px 32px;border:none;border-radius:12px;cursor:pointer;font-weight:bold;font-size:16px;">تغيير</button>
        </div>
        <div id="imeiResultBox" style="margin-top:20px; background:#222; border-radius:10px; padding:14px 18px; min-height:45px; color:#fff; white-space:pre-line; font-family:Consolas,monospace; font-size:15px; box-shadow: 0 2px 8px #0002;">
            ${imeiChangeResult ? imeiChangeResult : '↡ نتيجة التغيير ستظهر هنا ↡'}
        </div>
        <div style="text-align:center; margin-top:25px;">
            <button id="rebootBtn" style="background:#ff5722;color:white;padding:9px 36px;border:none;border-radius:12px;cursor:pointer;font-weight:bold;font-size:16px;">إعادة تشغيل الراوتر</button>
        </div>
        <div id="rebootResultBox" style="margin-top:16px; color:#fff; min-height:25px; font-size:15px; text-align:center;"></div>
    `;

    document.getElementById('imeiSendBtn').onclick = function() {
        let newImei = document.getElementById('imeiInput').value.trim();
        if (!/^\d{15}$/.test(newImei)) {
            imeiChangeResult = `<span style="color:#ff5252">❌ يجب إدخال رقم IMEI صحيح (15 رقم)</span>`;
            renderIMEITab();
            return;
        }
        imeiChangeResult = `<span style="color:#ffb300">⟳ جاري تنفيذ أمر التغيير ...</span>`;
        renderIMEITab();
        let send = (typeof $post === "function" ? $post : (typeof unsafeWindow !== "undefined" ? unsafeWindow.$post : null));
        if (typeof send === "function") {
            send("set_at_command", {command: `AT+EGMR=1,7,"${newImei}"`}).then(function(response){
                if ((response.result||"").toUpperCase().includes("OK")) {
                    imeiChangeResult = `<span style="color:#00e676;font-weight:bold;">✔️ تمت العملية بنجاح\n${response.result}</span>`;
                } else {
                    imeiChangeResult = `<span style="color:#ff5252;font-weight:bold;">❌ فشل التنفيذ:\n${response.result}</span>`;
                }
                renderIMEITab();
            }).catch(function(){
                imeiChangeResult = `<span style="color:#ff5252">❌ خطأ في الاتصال أو التنفيذ</span>`;
                renderIMEITab();
            });
        } else {
            imeiChangeResult = `<span style="color:#ff5252">❌ دالة $post غير متاحة في هذه الصفحة.</span>`;
            renderIMEITab();
        }
    };

    setTimeout(() => {
        let btn = document.getElementById('toggleIMEIMaskBtn');
        if (btn) {
            btn.onclick = function() {
                imeiMasked = !imeiMasked;
                renderIMEITab();
            }
        }
        // زر إعادة التشغيل
        let rebootBtn = document.getElementById('rebootBtn');
        if (rebootBtn) {
            rebootBtn.onclick = function() {
                let send = (typeof $post === "function" ? $post : (typeof unsafeWindow !== "undefined" ? unsafeWindow.$post : null));
                let box = document.getElementById('rebootResultBox');
                if (typeof send === "function") {
                    box.innerHTML = '<span style="color:#ffa726">⟳ جاري إرسال أمر إعادة التشغيل ...</span>';
                    send("do_cmd_web", {key: "REBOOT_WEB"}).then(function(response){
                        box.innerHTML = '<span style="color:#00e676">✔️ تم إرسال أمر إعادة التشغيل بنجاح!</span>';
                    }).catch(function(){
                        box.innerHTML = '<span style="color:#ff5252">❌ خطأ أثناء إرسال أمر إعادة التشغيل</span>';
                    });
                } else {
                    box.innerHTML = '<span style="color:#ff5252">❌ دالة $post غير متاحة في هذه الصفحة.</span>';
                }
            }
        }
    }, 30);
}

function maskIMEI(imei) {
    if (!imei || imei.length < 5) return imei;
    return '*'.repeat(imei.length - 5) + imei.slice(-5);
}




async function updateAll() {
    // يحدث فقط اذا انت على main أو neighbour
    if (currentTab === "main" || currentTab === "neighbour") {
        Promise.all([
            fetchSignalData(), fetchDeviceInfo(), fetchCarrierAggregation(), fetchNeighbourCells()
        ]).then(([signals, device, ca, neighbour]) => {
            cache.signals = signals;
            cache.device = device;
            cache.ca = ca;
            cache.neighbour = neighbour;

            if (currentTab === "main") {
                renderMain(signals, device, ca);
            } else if (currentTab === "neighbour") {
                renderNeighbourTab(neighbour);
            }
        });
    }
    // لو كنت على at أو imei، لا تسوي أي تحديث
}


function renderAboutTab() {
    document.getElementById('signalContent').innerHTML = `
        <div style="color:#2ad9fa;font-size:21px;font-weight:bold;margin-bottom:18px; text-align:center;">
            حول السكربت (About)
        </div>
        <div style="background:#232323; border-radius:12px; padding:28px 22px; max-width:480px; margin:0 auto 0 auto; box-shadow:0 2px 8px #0003; font-size:16px; line-height:1.9; color:#f8f8f8; text-align:center;">
            سكربت <span style="color:#ffa726; font-weight:bold;">فاير هوم</span> الاصدار الأول <b>1.0 (تجريبي)</b><br>
            قد يكون فيه بعض الأخطاء والقادم أجمل بإذن الله.<br>
            <div style="margin:12px 0 10px 0; color:#9aeaff;">
            <span style="color:#fff; font-weight:bold;">Fahad</span>
                <span style="color:#ffa726; font-weight:bold;">: برمجة وتطوير</span>
            </div>
            <div style="margin:12px 0 10px 0; color:#aaa;">
                إهداء إلى منتدى
                <a href="https://routers.world/" target="_blank" style="color:#2ad9fa;text-decoration:underline;font-weight:bold;">
                    عالم الراوترات
                </a>
            </div>
            <hr style="margin:15px 0 18px 0; border-color:#444;">
            <div style="font-size:13px;color:#bdbdbd;direction:ltr;text-align:left;max-width:420px;margin:0 auto 0 auto;">
            </div>
        </div>
    `;
}



    // زر فتح النافذة
    button.onclick = () => {
        popup.style.display = 'block';
        popup.style.top = '50%';
        popup.style.left = '50%';
        popup.style.transform = 'translate(-50%, -50%)';
        updateAll();
        if (updateInterval) clearInterval(updateInterval);
        updateInterval = setInterval(updateAll, 4000); // كل 4 ثواني
    };
    document.getElementById('closeBtn').onclick = () => {
        popup.style.display = 'none';
        if (updateInterval) clearInterval(updateInterval);
    };
    document.getElementById('refreshBtn').onclick = updateAll;

    // تبويبات
document.getElementById('mainTab').onclick = () => {
    currentTab = "main";
    document.getElementById('mainTab').classList.add('active');
    document.getElementById('neighbourTab').classList.remove('active');
    document.getElementById('atTab').classList.remove('active');
    renderMain(cache.signals, cache.device, cache.ca);
};
document.getElementById('neighbourTab').onclick = () => {
    currentTab = "neighbour";
    document.getElementById('mainTab').classList.remove('active');
    document.getElementById('neighbourTab').classList.add('active');
    document.getElementById('atTab').classList.remove('active');
    renderNeighbourTab(cache.neighbour);
};
document.getElementById('atTab').onclick = () => {
    currentTab = "at";
    document.getElementById('mainTab').classList.remove('active');
    document.getElementById('neighbourTab').classList.remove('active');
    document.getElementById('atTab').classList.add('active');
    renderATTab();
};

document.getElementById('aboutTab').onclick = () => {
    currentTab = "about";
    document.getElementById('mainTab').classList.remove('active');
    document.getElementById('neighbourTab').classList.remove('active');
    document.getElementById('atTab').classList.remove('active');
    document.getElementById('imeiTab').classList.remove('active');
    document.getElementById('aboutTab').classList.add('active');
    renderAboutTab();
};


document.getElementById('imeiTab').onclick = () => {
    currentTab = "imei";
    document.getElementById('mainTab').classList.remove('active');
    document.getElementById('neighbourTab').classList.remove('active');
    document.getElementById('atTab').classList.remove('active');
    document.getElementById('imeiTab').classList.add('active');
    imeiChangeResult = '';
    imeiCurrentValue = "جار التحميل...";
    renderIMEITab();
    fetchCurrentIMEI().then(val => {
        imeiCurrentValue = val;
        renderIMEITab();
    });
};


})();
