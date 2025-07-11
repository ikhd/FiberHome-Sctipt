// ==UserScript==
// @name         FiberHome Script
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  سكربت شامل لراوترات FiberHome: مراقبة الإشارة، الأبراج القريبة، AT، IMEI، وتسجيل الدخول/الخروج تلقائياً
// @match        *://192.168.8.1/*
// @grant        none
// ==/UserScript==

(function () {
  "use strict";

  /*────────── متغيرات عامّة ──────────*/
  let currentTab = "main";
  let imeiMasked = true;
  let imeiCurrentValue = "";
  let imeiChangeResult = "";
  let atCommandLastResult = "";
  let updateInterval = null;
  const cache = { signals: { lte: {}, nr: {} }, device: {}, ca: [], neighbour: null };

  /*────────── أدوات الألوان والقيم ──────────*/
  function getTemperatureColor(t) {
    if (t == null) return "#666";
    if (t < 35) return "#00ff00";
    if (t < 45) return "#ffaa00";
    return "#ff0000";
  }
  const getColor = {
    RSRP: v => (v == null ? "#666" : v >= -80 ? "#00ff00" : v >= -90 ? "#90EE90" : v >= -100 ? "#ffcc00" : v >= -110 ? "#ff6600" : "#ff0000"),
    RSRQ: v => (v == null ? "#666" : v >= -10 ? "#00ff00" : v >= -15 ? "#90EE90" : v >= -20 ? "#ffcc00" : "#ff6600"),
    SINR: v => (v == null ? "#666" : v >= 20 ? "#00ff00" : v >= 13 ? "#90EE90" : v >= 0 ? "#ffcc00" : "#ff6600"),
    RSSI: v => (v == null ? "#666" : v >= -65 ? "#00ff00" : v >= -75 ? "#90EE90" : v >= -85 ? "#ffcc00" : "#ff6600")
  };
  const parseNumber = str => (!str ? null : parseFloat(str.replace(/[^\d.\-]/g, "")));

  /*────────── زر فتح اللوحة ──────────*/
const button = document.createElement("button");
button.innerHTML = "📡 سكربت فايبرهوم - عالم الراوترات";
button.style.cssText = `
  position: fixed; left: calc(50% - 100px); top: 10px;
  transform: translateX(-50%);
  background: #2196F3; color: #fff;
  border: none; padding: 13px 28px; border-radius: 25px; cursor: pointer;
  font-family: Arial, sans-serif; font-size: 17px; z-index: 9999;
  font-weight: bold; letter-spacing: 0.7px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.18); transition: all 0.3s ease;
`;
button.onmouseover = () => (button.style.background = "#1976D2");
button.onmouseout  = () => (button.style.background = "#2196F3");
document.body.appendChild(button);
  /*────────── نافذة المعلومات ──────────*/
  const popup = document.createElement("div");
  popup.style.cssText = `
    display:none;position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);
    background:#1a1a1a;border-radius:10px;box-shadow:0 10px 50px rgba(0,0,0,.5);
    z-index:10000;min-width:700px;max-width:900px;font-family:Arial,sans-serif;color:#fff;overflow:hidden;
  `;
  popup.innerHTML = `
    <div id="popupHeader" style="direction:ltr;background:linear-gradient(90deg,#2196F3 0%,#00BCD4 100%);padding:15px 20px 10px;display:flex;justify-content:space-between;align-items:center;">
      <div><button id="closeBtn" style="background:rgba(255,255,255,.2);border:none;color:#fff;padding:8px 20px;border-radius:20px;cursor:pointer;font-size:14px;">✕ إغلاق</button></div>
      <div style="display:flex;gap:10px;">
        <button id="aboutTab"     class="tabBtn" style="background:rgba(255,255,255,.2);color:#fff;border-radius:20px;border:none;padding:8px 20px;cursor:pointer;font-size:14px;">حول</button>
        <button id="refreshBtn"                    style="background:rgba(255,255,255,.2);border:none;color:#fff;padding:8px 20px;border-radius:20px;cursor:pointer;font-size:14px;">⟳ تحديث</button>
        <button id="imeiTab"      class="tabBtn" style="background:rgba(255,255,255,.2);color:#fff;border-radius:20px;border:none;padding:8px 20px;cursor:pointer;font-size:14px;">IMEI تغيير</button>
        <button id="atTab"        class="tabBtn" style="background:rgba(255,255,255,.2);color:#fff;border-radius:20px;border:none;padding:8px 20px;cursor:pointer;font-size:14px;">أوامر AT</button>
        <button id="neighbourTab" class="tabBtn" style="background:rgba(255,255,255,.2);color:#fff;border-radius:20px;border:none;padding:8px 20px;cursor:pointer;font-size:14px;">الأبراج القريبة</button>
        <button id="mainTab"      class="tabBtn active" style="background:rgba(255,255,255,.3);color:#fff;border-radius:20px;border:none;padding:8px 20px;cursor:pointer;font-size:14px;">الرئيسية</button>
      </div>
    </div>
    <div id="signalContent" style="padding:20px;cursor:default;max-height:80vh;overflow-y:auto;">
      <div style="text-align:center;color:#888;">
        <div style="font-size:20px;margin:20px;">⟳</div>جاري تحميل البيانات...
      </div>
    </div>
  `;
  document.body.appendChild(popup);

  /*────────── Hover للأزرار في الـ popup ──────────*/
  const addHoverEffects = () => {
    popup.querySelectorAll("button").forEach(btn => {
      btn.addEventListener("mouseover", function () {
        if (!this.classList.contains("active")) this.style.background = "rgba(255,255,255,.3)";
      });
      btn.addEventListener("mouseout", function () {
        if (!this.classList.contains("active")) this.style.background = "rgba(255,255,255,.2)";
      });
    });
  };
  addHoverEffects();

  /*────────── سحب النافذة ──────────*/
  (() => {
    let isDragging = false, off = { x: 0, y: 0 };
    popup.querySelector("#popupHeader").addEventListener("mousedown", e => {
      isDragging = true;
      const r = popup.getBoundingClientRect();
      off.x = e.clientX - r.left;
      off.y = e.clientY - r.top;
      document.body.style.userSelect = "none";
    });
    document.addEventListener("mousemove", e => {
      if (!isDragging) return;
      let x = Math.max(0, Math.min(e.clientX - off.x, window.innerWidth  - popup.offsetWidth ));
      let y = Math.max(0, Math.min(e.clientY - off.y, window.innerHeight - popup.offsetHeight));
      popup.style.left = x + "px";
      popup.style.top  = y + "px";
      popup.style.transform = "none";
    });
    document.addEventListener("mouseup", () => { if (isDragging) { isDragging=false; document.body.style.userSelect=""; }});
  })();

  /*────────── دوال جلب البيانات عبر iframes ──────────*/
  const waitAnd = (ms, fn) => setTimeout(fn, ms);

  function fetchDeviceInfo() {
    return new Promise(resolve => {
      const iframe = document.createElement("iframe");
      iframe.style.display = "none";
      iframe.src = "/main.html?8630#/status/deviceInfo";
      iframe.onload = () => waitAnd(1500, () => {
        try {
          const d = iframe.contentDocument || iframe.contentWindow.document;
          const rows = d.querySelectorAll("tr");
          const dev = {};
          rows.forEach(tr => {
            const k = tr.querySelector("th")?.textContent.trim();
            const v = tr.querySelector("td")?.textContent.trim();
            if (!k || !v) return;
            if (k === "Manufacturer")      dev.manufacturer    = v;
            else if (k === "Software Version") dev.softwareVersion = v;
            else if (k === "CPU Temperature") {
              const m = v.match(/(\d+\.?\d*)/);
              dev.cpuTemperature     = m ? parseFloat(m[1]) : null;
              dev.cpuTemperatureText = v;
            }
          });
          iframe.remove(); resolve(dev);
        } catch { iframe.remove(); resolve({}); }
      });
      document.body.appendChild(iframe);
    });
  }

  function fetchCarrierAggregation() {
    return new Promise(resolve => {
      const iframe = document.createElement("iframe");
      iframe.style.display = "none";
      iframe.src = "/main.html?4009#/mobileNetwork/carrierAggregation";
      iframe.onload = () => waitAnd(1500, () => {
        try {
          const d = iframe.contentDocument || iframe.contentWindow.document;
          const table = d.querySelector(".page_content table.el-table__body");
          const ca = [];
          if (table) {
            const rows = [...table.querySelectorAll("tr")];
            let states=[], bands=[], arfcn=[], bws=[];
            rows.forEach(r => {
              const cells = [...r.querySelectorAll("td")].map(td=>td.innerText.trim());
              if (cells[0]==="State")        states = cells.slice(1);
              else if (cells[0]==="Band")    bands  = cells.slice(1);
              else if (cells[0]==="Arfcn")   arfcn  = cells.slice(1);
              else if (cells[0]==="DL_BandWidth") bws  = cells.slice(1);
            });
            for (let i=0;i<states.length;i++){
              const st=(states[i]||"").toLowerCase();
              if(st!=="activated"&&st!=="actived")continue;
              const b  =(bands[i]||"").trim();
              const bw = bws[i]||"", fq=arfcn[i]||"";
              let isNR=false, bandName="";
              if (/^n?\s*78$/i.test(b)){bandName="N78";isNR=true;}
              else if (/^n?\s*41$/i.test(b)){bandName="N41";isNR=true;}
              else if (/^n\d+$/i.test(b)){bandName=b.toUpperCase();isNR=true;}
              else if (/^\d+$/.test(b)){bandName="B"+b;}
              else bandName=b;
              ca.push({band:bandName,bandwidth:bw,frequency:fq,isNR,sortKey:(isNR?1e3:0)+(parseInt(bw)||0)});
            }
            ca.sort((a,b)=>b.sortKey-a.sortKey);
          }
          iframe.remove(); resolve(ca);
        } catch { iframe.remove(); resolve([]); }
      });
      document.body.appendChild(iframe);
    });
  }

  function fetchSignalData() {
    return new Promise(resolve => {
      const iframe = document.createElement("iframe");
      iframe.style.display = "none";
      iframe.src = "/main.html#/mobileNetwork/rfSignal";
      iframe.onload = () => waitAnd(1500, () => {
        try {
          const d = iframe.contentDocument || iframe.contentWindow.document;
          const boxes = [...d.querySelectorAll(".page_box_item")];
          const lte={}, nr={};
          boxes.forEach(b=>{
            const t=b.querySelector(".rfsignal_table1_title")?.textContent.trim().toUpperCase();
            const rows=[...b.querySelectorAll(".rfsignal_table_content tr")];
            rows.forEach(tr=>{
              const k=tr.querySelector("th")?.innerText.trim();
              const v=tr.querySelector("td")?.innerText.trim();
              if(!k||!v)return;
              if(t.includes("LTE")) lte[k]=v;
              else if(t.includes("5G NR")) nr[k]=v;
            });
          });
          iframe.remove(); resolve({lte,nr});
        } catch { iframe.remove(); resolve({lte:{},nr:{}}); }
      });
      document.body.appendChild(iframe);
    });
  }

  function fetchNeighbourCells() {
    return new Promise(resolve => {
      const iframe=document.createElement("iframe");
      iframe.style.display="none";
      iframe.src="/main.html?8258#/mobileNetwork/rfSignal";
      iframe.onload=()=>waitAnd(1500,()=>{
        try{
          const d=iframe.contentDocument||iframe.contentWindow.document;
          const table=d.querySelector(".rfsignal_neighbour_table");
          const rows=table?[...table.querySelectorAll("tr")].map(r=>[...r.querySelectorAll("th,td")].map(c=>c.innerText.trim())):[];
          iframe.remove(); resolve(rows.length?rows:null);
        }catch{iframe.remove();resolve(null);}
      });
      document.body.appendChild(iframe);
    });
  }

  /*────────── Helper: جدول الأبراج القريبة ──────────*/
  function renderSingleTable(headers, rows) {
    const th = headers.map(h=>`<th style="padding:8px 12px;color:#00bcd4;border-bottom:2px solid #444;font-size:13px;white-space:nowrap;">${h}</th>`).join("");
    const tb = rows.map(r=>{
      return "<tr>"+r.map((cell,c)=>{
        let style='padding:8px 12px;text-align:center;border-bottom:1px solid #333;font-size:12px;white-space:nowrap;';
        if(c>0){
          const lbl=r[0].toUpperCase();
          if(lbl==="RSRP") style+=`color:${getColor.RSRP(parseFloat(cell))};font-weight:bold;`;
          else if(lbl==="SINR") style+=`color:${getColor.SINR(parseFloat(cell))};font-weight:bold;`;
          else if(lbl==="RSRQ") style+=`color:${getColor.RSRQ(parseFloat(cell))};font-weight:bold;`;
          else if(lbl==="RSSI") style+=`color:${getColor.RSSI(parseFloat(cell))};font-weight:bold;`;
          else style+='color:#fff;';
        }else style+='color:#00bcd4;font-weight:bold;';
        return `<td style="${style}">${cell}</td>`;
      }).join("")+"</tr>";
    }).join("");
    return `<div style="overflow-x:auto"><table style="width:100%;background:#232323;border-radius:8px;border-spacing:0;border-collapse:collapse;min-width:300px;"><thead><tr>${th}</tr></thead><tbody>${tb}</tbody></table></div>`;
  }
  function renderNeighbourCellsTable(data){
    if(!data||!data.length) return '<div style="text-align:center;color:#888;padding:40px;">لا توجد بيانات أبراج قريبة متاحة</div>';
    const headers=data[0], body=data.slice(1);
    const half=Math.ceil((headers.length-1)/2);
    const firstH=[headers[0],...headers.slice(1,1+half)];
    const secondH=[headers[0],...headers.slice(1+half)];
    const firstR=body.map(r=>[r[0],...r.slice(1,1+half)]);
    const secondR=body.map(r=>[r[0],...r.slice(1+half)]);
    return `<div style="margin-bottom:16px;">${renderSingleTable(firstH,firstR)}</div><div>${renderSingleTable(secondH,secondR)}</div>`;
  }

  /*────────── عرض التبويبات ──────────*/
  const getBandColor = (band,isNR)=>isNR?"#00e5ff":"#76ff03";
  const formatCA = ca => !ca.length?"غير متاح":ca.map(i=>`<span style="color:${getBandColor(i.band,i.isNR)};font-weight:bold;">${i.bandwidth}@${i.frequency} (${i.band})</span>`).join(' <span style="color:#fff;font-weight:bold;">+</span> ');

  function renderMain(data, dev, ca){
    let html="";
    /* معلومات الجهاز */
    if(Object.keys(dev).length){
      html+=`
        <div style="margin-bottom:25px;">
          <h3 style="color:#00BCD4;font-size:16px;margin-bottom:15px;">معلومات الجهاز</h3>
          <div style="background:#2a2a2a;border-radius:8px;padding:15px;">
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:15px;text-align:center;">
              <div><div style="color:#888;font-size:12px;margin-bottom:5px;">المصنع</div><div style="font-size:16px;font-weight:bold;">${dev.manufacturer||"N/A"}</div></div>
              <div><div style="color:#888;font-size:12px;margin-bottom:5px;">إصدار البرنامج</div><div style="font-size:16px;font-weight:bold;">${dev.softwareVersion||"N/A"}</div></div>
              <div><div style="color:#888;font-size:12px;margin-bottom:5px;">حرارة المعالج</div><div style="font-size:16px;font-weight:bold;color:${getTemperatureColor(dev.cpuTemperature)};">${dev.cpuTemperatureText||"N/A"}</div></div>
            </div>
          </div>
        </div>`;
    }
    /* 5G */
    if(Object.keys(data.nr).length){
      html+=`
        <div style="margin-bottom:20px;">
          <h3 style="color:#00BCD4;font-size:16px;margin-bottom:15px;">5G</h3>
          <div style="background:#2a2a2a;border-radius:8px;padding:15px;">
            <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:15px;text-align:center;">
              <div><div style="color:#888;font-size:12px;margin-bottom:5px;">RSRP</div><div style="font-size:20px;font-weight:bold;color:${getColor.RSRP(parseNumber(data.nr.RSRP))};">${data.nr.RSRP||"N/A"}</div></div>
              <div><div style="color:#888;font-size:12px;margin-bottom:5px;">RSRQ</div><div style="font-size:20px;font-weight:bold;color:${getColor.RSRQ(parseNumber(data.nr.RSRQ))};">${data.nr.RSRQ||"N/A"}</div></div>
              <div><div style="color:#888;font-size:12px;margin-bottom:5px;">SINR</div><div style="font-size:20px;font-weight:bold;color:${getColor.SINR(parseNumber(data.nr.SINR))};">${data.nr.SINR||"N/A"}</div></div>
              <div><div style="color:#888;font-size:12px;margin-bottom:5px;">PCI</div><div style="font-size:20px;font-weight:bold;">${data.nr.PCI||"N/A"}</div></div>
            </div>
            <div style="margin-top:15px;padding-top:15px;border-top:1px solid #444;text-align:center;">
              <span style="color:#888;font-size:12px;">BAND: </span><span style="font-weight:bold;">${data.nr.BAND||"N/A"}</span>
            </div>
          </div>
        </div>`;
    }
    /* 4G */
    if(Object.keys(data.lte).length){
      html+=`
        <div>
          <h3 style="color:#00BCD4;font-size:16px;margin-bottom:15px;">4G</h3>
          <div style="background:#2a2a2a;border-radius:8px;padding:15px;">
            <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:15px;text-align:center;">
              <div><div style="color:#888;font-size:12px;margin-bottom:5px;">RSRP</div><div style="font-size:20px;font-weight:bold;color:${getColor.RSRP(parseNumber(data.lte.RSRP))};">${data.lte.RSRP||"N/A"}</div></div>
              <div><div style="color:#888;font-size:12px;margin-bottom:5px;">RSRQ</div><div style="font-size:20px;font-weight:bold;color:${getColor.RSRQ(parseNumber(data.lte.RSRQ))};">${data.lte.RSRQ||"N/A"}</div></div>
              <div><div style="color:#888;font-size:12px;margin-bottom:5px;">SINR</div><div style="font-size:20px;font-weight:bold;color:${getColor.SINR(parseNumber(data.lte.SINR))};">${data.lte.SINR||"N/A"}</div></div>
              <div><div style="color:#888;font-size:12px;margin-bottom:5px;">PCI</div><div style="font-size:20px;font-weight:bold;">${data.lte.PCI||"N/A"}</div></div>
            </div>
            <div style="margin-top:15px;padding-top:15px;border-top:1px solid #444;text-align:center;">
              <span style="color:#888;font-size:12px;">BAND: </span><span style="font-weight:bold;">${data.lte.BAND||"N/A"}</span>
            </div>
          </div>
        </div>`;
    }
    /* CA */
    html+=`
      <div style="margin-top:20px;">
        <h3 style="color:#00BCD4;font-size:16px;margin-bottom:15px;">قراءات الدمج</h3>
        <div style="background:#2a2a2a;border-radius:8px;padding:15px;text-align:center;">
          <div style="color:#888;font-size:12px;margin-bottom:8px;">الترددات النشطة</div>
          <div style="font-size:14px;font-weight:bold;line-height:1.4;">${formatCA(ca)}</div>
        </div>
      </div>`;
    document.getElementById("signalContent").innerHTML = html;
  }

  function renderNeighbourTab(data){
    document.getElementById("signalContent").innerHTML =
      `<div style="color:orange;font-size:21px;font-weight:bold;margin-bottom:10px;text-align:center;">الأبراج القريبة (Neighbour Cells)</div>` +
      renderNeighbourCellsTable(data);
  }

  /*────────── تبويب أوامر AT ──────────*/
  function renderATTab(){
    const oldVal=document.getElementById("atCommandInput")?.value||"";
    document.getElementById("signalContent").innerHTML=`
      <div style="color:#2ad9fa;font-size:20px;font-weight:bold;margin-bottom:14px;text-align:center;">أوامر AT للراوتر</div>
      <div style="max-width:480px;margin:0 auto 15px;display:flex;gap:8px;">
        <input id="atCommandInput" type="text" maxlength="128" placeholder="مثال: AT+CSQ" style="flex:1;padding:9px 15px;border-radius:8px;border:1px solid #2196F3;font-size:16px;background:#232323;color:#fff;">
        <button id="atCommandSendBtn" style="background:#2196F3;color:white;padding:9px 32px;border:none;border-radius:12px;cursor:pointer;font-weight:bold;font-size:16px;">إرسال</button>
      </div>
      <div id="atResultBox" style="margin-top:25px;background:#222;border-radius:10px;padding:15px 18px;min-height:70px;color:#fff;white-space:pre-line;font-family:Consolas,monospace;font-size:15px;box-shadow:0 2px 8px #0002;">${atCommandLastResult||"↡ النتيجة ستظهر هنا ↡"}</div>`;
    if(oldVal) document.getElementById("atCommandInput").value=oldVal;

    document.getElementById("atCommandSendBtn").onclick=()=>{
      const cmd=document.getElementById("atCommandInput").value.trim();
      if(!/^AT/i.test(cmd)){
        atCommandLastResult="❌ أدخل أمر AT يبدأ بـ AT";
        renderATTab(); return;
      }
      atCommandLastResult="⟳ جاري إرسال الأمر ..."; renderATTab();
      const send=typeof $post==="function"? $post : unsafeWindow?.$post;
      if(typeof send==="function"){
        send("set_at_command",{command:cmd}).then(r=>{
          atCommandLastResult=r.result?r.result:"❌ لم يتم الحصول على رد من الراوتر";
          renderATTab();
        }).catch(()=>{
          atCommandLastResult="❌ خطأ في الاتصال أو التنفيذ"; renderATTab();
        });
      }else{
        atCommandLastResult="❌ دالة $post غير متاحة في هذه الصفحة."; renderATTab();
      }
    };
  }

  /*────────── تبويب IMEI ──────────*/
  const maskIMEI = i => !i||i.length<5?i:"*".repeat(i.length-5)+i.slice(-5);

  function fetchCurrentIMEI(){
    return new Promise(resolve=>{
      const iframe=document.createElement("iframe");
      iframe.style.display="none";
      iframe.src="/main.html?5071#/mobileNetwork/simInfo";
      iframe.onload=()=>waitAnd(1000,()=>{
        try{
          const d=iframe.contentDocument||iframe.contentWindow.document;
          let imei=""; d.querySelectorAll("tr").forEach(tr=>{
            if(tr.querySelector("th")?.textContent.trim().toUpperCase()==="IMEI")
              imei=tr.querySelector("td")?.textContent.trim();
          });
          iframe.remove(); resolve(imei);
        }catch{iframe.remove();resolve("");}
      });
      document.body.appendChild(iframe);
    });
  }

  function renderIMEITab(){
    document.getElementById("signalContent").innerHTML=`
      <div style="color:#ffa726;font-size:20px;font-weight:bold;margin-bottom:14px;text-align:center;">تغيير IMEI للراوتر</div>
      <div style="max-width:420px;margin:0 auto 18px;display:flex;align-items:center;gap:8px;">
        <span style="color:#2ad9fa;font-size:18px;">IMEI :</span>
        <span id="currentIMEI" style="color:#fff;font-size:18px;font-family:Consolas,monospace;font-weight:bold;">${imeiCurrentValue?(imeiMasked?maskIMEI(imeiCurrentValue):imeiCurrentValue):"جار التحميل..."}</span>
        <button id="toggleIMEIMaskBtn" style="background:rgba(255,255,255,.13);border:none;color:#ffa726;padding:2px 14px;border-radius:7px;cursor:pointer;font-size:13px;">${imeiMasked?"إظهار":"إخفاء"}</button>
      </div>
      <div style="max-width:420px;margin:0 auto 10px;display:flex;gap:8px;">
        <input id="imeiInput" type="text" maxlength="17" placeholder="ادخل IMEI الجديد" style="flex:1;padding:9px 15px;border-radius:8px;border:1px solid #ffa726;font-size:16px;background:#232323;color:#fff;">
        <button id="imeiSendBtn" style="background:#ffa726;color:white;padding:9px 32px;border:none;border-radius:12px;cursor:pointer;font-weight:bold;font-size:16px;">تغيير</button>
      </div>
      <div id="imeiResultBox" style="margin-top:20px;background:#222;border-radius:10px;padding:14px 18px;min-height:45px;color:#fff;white-space:pre-line;font-family:Consolas,monospace;font-size:15px;box-shadow:0 2px 8px #0002;">${imeiChangeResult||"↡ نتيجة التغيير ستظهر هنا ↡"}</div>
      <div style="text-align:center;margin-top:25px;">
        <button id="rebootBtn" style="background:#ff5722;color:white;padding:9px 36px;border:none;border-radius:12px;cursor:pointer;font-weight:bold;font-size:16px;">إعادة تشغيل الراوتر</button>
      </div>
      <div id="rebootResultBox" style="margin-top:16px;color:#fff;min-height:25px;font-size:15px;text-align:center;"></div>`;

    /* الأحداث */
    document.getElementById("toggleIMEIMaskBtn").onclick=()=>{imeiMasked=!imeiMasked;renderIMEITab();};

    document.getElementById("imeiSendBtn").onclick=()=>{
      const newI=document.getElementById("imeiInput").value.trim();
      if(!/^\d{15}$/.test(newI)){ imeiChangeResult="❌ يجب إدخال رقم IMEI صحيح (15 رقم)"; renderIMEITab(); return;}
      imeiChangeResult="⟳ جاري تنفيذ أمر التغيير ..."; renderIMEITab();
      const send=typeof $post==="function"?$post:unsafeWindow?.$post;
      if(typeof send==="function"){
        send("set_at_command",{command:`AT+EGMR=1,7,"${newI}"`}).then(r=>{
          imeiChangeResult=(r.result||"").toUpperCase().includes("OK")?"✔️ تمت العملية بنجاح\n"+r.result:"❌ فشل التنفيذ:\n"+r.result;
          renderIMEITab();
        }).catch(()=>{ imeiChangeResult="❌ خطأ في الاتصال أو التنفيذ"; renderIMEITab(); });
      }else{ imeiChangeResult="❌ دالة $post غير متاحة في هذه الصفحة."; renderIMEITab(); }
    };

    document.getElementById("rebootBtn").onclick=()=>{
      const box=document.getElementById("rebootResultBox");
      const send=typeof $post==="function"?$post:unsafeWindow?.$post;
      if(typeof send==="function"){
        box.innerHTML="⟳ جاري إرسال أمر إعادة التشغيل ...";
        send("do_cmd_web",{key:"REBOOT_WEB"}).then(()=>box.innerHTML="✔️ تم إرسال أمر إعادة التشغيل بنجاح!").catch(()=>box.innerHTML="❌ خطأ أثناء إرسال أمر إعادة التشغيل");
      }else box.innerHTML="❌ دالة $post غير متاحة في هذه الصفحة.";
    };
  }

  /*────────── تبويب حول ──────────*/
  function renderAboutTab(){
    document.getElementById("signalContent").innerHTML=`
      <div style="color:#2ad9fa;font-size:21px;font-weight:bold;margin-bottom:18px;text-align:center;">حول السكربت (About)</div>
      <div style="background:#232323;border-radius:12px;padding:28px 22px;max-width:480px;margin:0 auto;box-shadow:0 2px 8px #0003;font-size:16px;line-height:1.9;color:#f8f8f8;text-align:center;">
        سكربت <span style="color:#ffa726;font-weight:bold;">فايبرهوم</span> الإصدار <b>1.1</b><br>
        تم تطويره لصالح منتدى <a href="https://routers.world/" target="_blank" style="color:#2ad9fa;text-decoration:underline;font-weight:bold;">عالم الراوترات</a>.<br>
        <hr style="margin:15px 0;border-color:#444;">
        <span style="font-size:13px;color:#bdbdbd;direction:ltr;">Developer: Fahad — Enjoy! 🚀</span>
        <span style="font-size:13px;color:#bdbdbd;direction:ltr;">Modded: Khalid - Tw: @REMiX_KSA</span>
      </div>`;
  }

  /*────────── تحديث شامل (كل 4 ثوانٍ) ──────────*/
  function updateAll(){
    if(currentTab==="main"||currentTab==="neighbour"){
      Promise.all([fetchSignalData(),fetchDeviceInfo(),fetchCarrierAggregation(),fetchNeighbourCells()])
        .then(([sig,dev,ca,nei])=>{
          cache.signals=sig; cache.device=dev; cache.ca=ca; cache.neighbour=nei;
          if(currentTab==="main")      renderMain(sig,dev,ca);
          else if(currentTab==="neighbour") renderNeighbourTab(nei);
        });
    }
  }

  /*────────── تبويبات & أزرار الرأس ──────────*/
  const setActive = id=>{
    document.querySelectorAll(".tabBtn").forEach(b=>b.classList.remove("active")&&(b.style.background="rgba(255,255,255,.2)"));
    const el=document.getElementById(id); el.classList.add("active"); el.style.background="rgba(255,255,255,.3)";
  };
  document.getElementById("mainTab").onclick=()=>{currentTab="main";setActive("mainTab");renderMain(cache.signals,cache.device,cache.ca);};
  document.getElementById("neighbourTab").onclick=()=>{currentTab="neighbour";setActive("neighbourTab");renderNeighbourTab(cache.neighbour);};
  document.getElementById("atTab").onclick=()=>{currentTab="at";setActive("atTab");renderATTab();};
  document.getElementById("imeiTab").onclick=()=>{
    currentTab="imei";setActive("imeiTab");imeiChangeResult="";imeiCurrentValue="جار التحميل...";renderIMEITab();
    fetchCurrentIMEI().then(v=>{imeiCurrentValue=v;renderIMEITab();});
  };
  document.getElementById("aboutTab").onclick=()=>{currentTab="about";setActive("aboutTab");renderAboutTab();};

  /*────────── فتح وغلق اللوحة ──────────*/
  button.onclick=()=>{
    popup.style.display="block";
    popup.style.top="50%"; popup.style.left="50%"; popup.style.transform="translate(-50%,-50%)";
    updateAll(); if(updateInterval)clearInterval(updateInterval); updateInterval=setInterval(updateAll,4000);
  };
  document.getElementById("closeBtn").onclick=()=>{popup.style.display="none"; if(updateInterval)clearInterval(updateInterval);};
  document.getElementById("refreshBtn").onclick=updateAll;

  /*════════════ أزرار تسجيل الدخول/الخروج ════════════*/
  window.addEventListener("load",()=>{
    const makeBtn=(txt,bg,left,fn)=>{
      const btn=document.createElement("button"); btn.textContent=txt; btn.onclick=fn;
      btn.style.cssText=`
        position:fixed;left:${left};top:10px;transform:translateX(-50%);
        background:${bg};color:#fff;border:none;padding:13px 20px;border-radius:25px;cursor:pointer;
        font-family:Arial,sans-serif;font-size:17px;z-index:9999;font-weight:bold;letter-spacing:.7px;
        box-shadow:0 2px 10px rgba(0,0,0,.18);transition:all .3s ease;
      `;
      const shade=(c,a)=>{let p=c[0]==="#";c=p?c.slice(1):c;let n=parseInt(c,16),r=(n>>16)+a,g=((n>>8)&0xff)+a,b=(n&0xff)+a;
                          return(p?"#":"")+((1<<24)+(Math.max(0,Math.min(255,r))<<16)+(Math.max(0,Math.min(255,g))<<8)+Math.max(0,Math.min(255,b))).toString(16).slice(1);};
      btn.onmouseover=()=>btn.style.background=shade(bg,-20);
      btn.onmouseout =()=>btn.style.background=bg;
      document.body.appendChild(btn); return btn;
    };
    const isLoggedIn=()=>{
      const el=document.querySelector(".fh-logout");
      if(el){const st=getComputedStyle(el);const r=el.getBoundingClientRect();return r.width&&r.height&&st.display!=="none"&&st.visibility!=="hidden"&&st.opacity!=="0";}
      return window.location.hash.includes("/home");
    };
    const loginBtn = makeBtn("🔐 تسجيل الدخول","#4CAF50","calc(50% + 180px)",()=>{
      const inputs=document.querySelectorAll("input.el-input__inner");
      const realBtn=[...document.querySelectorAll("button.el-button")].find(b=>b.textContent.trim().toLowerCase()==="login");
      if(inputs.length<2||!realBtn){alert("⚠️ تعذّر العثور على حقول أو زر Login!");return;}
      inputs[0].value="superadmin"; inputs[0].dispatchEvent(new Event("input",{bubbles:true}));
      inputs[1].value="F1ber$dm";   inputs[1].dispatchEvent(new Event("input",{bubbles:true}));
      setTimeout(()=>realBtn.click(),300);
    });
    const logoutBtn= makeBtn("🚪 تسجيل الخروج","#f44336","calc(50% + 180px)",()=>{
      document.querySelector(".fh-logout")?.click();
      const poll=setInterval(()=>{
        [...document.querySelectorAll("span")].find(s=>s.textContent.trim().toLowerCase()==="confirm")?.click();
        if(!isLoggedIn()) {updateBtns();clearInterval(poll);}
      },300);
    });
    const updateBtns=()=>{loginBtn.style.display=isLoggedIn()?"none":"inline-block";logoutBtn.style.display=isLoggedIn()?"inline-block":"none";};
    new MutationObserver(updateBtns).observe(document.body,{childList:true,subtree:true}); updateBtns();
  });
})();
