// Main page script extracted from HTML
let ws;
let ticks = [];
let winCount = 0, totalTrades = 0, sessionProfit = 0;
let isAiRunning = false, isTradeActive = false; 
let accuracyChart;
let smoothedConf = 0;
let poofConf = 0;
let tickCounter = 0;
let lastTradeTick = -10;
let lastTickTime = Date.now();
let selectedDigit = 0;
let historyRecords = {}; // Store detailed contract data by ID

// MODAL LOGIC
function handleOverlayClick(e, id) {
    if (e.target.id === id) {
        if (id === 'digitModal') closeDigitModal();
        if (id === 'txDetailModal') closeTxDetail();
    }
}

function openDigitModal(digit) {
    selectedDigit = digit;
    document.getElementById('modalTitle').innerText = `ACTION FOR DIGIT ${digit}`;
    openModal('digitModal');
}

function closeDigitModal() {
    closeModal('digitModal');
}

function closeTxDetail() {
    closeModal('txDetailModal');
}

function escapeHtml(s){
    return String(s)
        .replace(/&/g,'&amp;')
        .replace(/</g,'&lt;')
        .replace(/>/g,'&gt;')
        .replace(/"/g,'&quot;')
        .replace(/'/g,'&#39;');
}

function openModal(modalId){
    const modal = document.getElementById(modalId);
    if(!modal) return;
    const main = document.querySelector('.container');
    if(main) main.setAttribute('aria-hidden','true');
    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden','false');
    modal._previousActive = document.activeElement;
    const focusables = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    const nodes = Array.from(focusables).filter(n => !n.disabled && n.offsetParent !== null);
    if(nodes.length) nodes[0].focus();
    modal._onkeydown = function(e){
        if(e.key === 'Escape') { closeModal(modalId); }
        if(e.key === 'Tab'){
            if(nodes.length === 0) { e.preventDefault(); return; }
            const idx = nodes.indexOf(document.activeElement);
            if(e.shiftKey && idx === 0){ e.preventDefault(); nodes[nodes.length-1].focus(); }
            else if(!e.shiftKey && idx === nodes.length-1){ e.preventDefault(); nodes[0].focus(); }
        }
    };
    document.addEventListener('keydown', modal._onkeydown);
}

function closeModal(modalId){
    const modal = document.getElementById(modalId);
    if(!modal) return;
    const main = document.querySelector('.container');
    if(main) main.removeAttribute('aria-hidden');
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden','true');
    if(modal._onkeydown) document.removeEventListener('keydown', modal._onkeydown);
    try{ if(modal._previousActive) modal._previousActive.focus(); }catch(e){}
}

function showTxDetail(contractId) {
    const data = historyRecords[contractId];
    if (!data) return;

    const container = document.getElementById('txDetailContent');
    const isWin = parseFloat(data.profit) > 0;
    const type = data.contract_type && data.contract_type.includes('OVER') ? 'OVER' : 'UNDER';

    container.innerHTML = `
        <div class="detail-row"><span class="detail-label">Contract ID</span><span class="detail-val">${escapeHtml(data.contract_id)}</span></div>
        <div class="detail-row"><span class="detail-label">Market</span><span class="detail-val">${escapeHtml(data.display_name || 'Volatility Index')}</span></div>
        <div class="detail-row"><span class="detail-label">Trade Type</span><span class="detail-val">${escapeHtml(type + ' ' + data.barrier)}</span></div>
        <div class="detail-row"><span class="detail-label">Status</span><span class="detail-val" style="color:${isWin?'var(--success)':'var(--error)'}">${isWin?'WIN':'LOSS'}</span></div>
        <div class="detail-row"><span class="detail-label">Buy Price</span><span class="detail-val">$${parseFloat(data.buy_price).toFixed(2)}</span></div>
        <div class="detail-row"><span class="detail-label">Profit/Loss</span><span class="detail-val" style="color:${isWin?'var(--success)':'var(--error)'}">${isWin?'+':''}${parseFloat(data.profit).toFixed(2)}</span></div>
        <div class="detail-row"><span class="detail-label">Entry Spot</span><span class="detail-val">${escapeHtml(data.entry_tick_display_value)}</span></div>
        <div class="detail-row"><span class="detail-label">Exit Spot</span><span class="detail-val">${escapeHtml(data.exit_tick_display_value)}</span></div>
        <div class="detail-row"><span class="detail-label">Date/Time</span><span class="detail-val">${escapeHtml(new Date(data.purchase_time * 1000).toLocaleString())}</span></div>
    `;

    openModal('txDetailModal');
}

document.getElementById('modalBuyOver').onclick = () => {
    if (!document.getElementById('buyOver').disabled) {
        executeTradeSpecific('over', selectedDigit);
        closeDigitModal();
    } else {
        addLog("Please connect account first", "error");
    }
};

document.getElementById('modalBuyUnder').onclick = () => {
    if (!document.getElementById('buyUnder').disabled) {
        executeTradeSpecific('under', selectedDigit);
        closeDigitModal();
    } else {
        addLog("Please connect account first", "error");
    }
};

document.getElementById('modalBulkX').onclick = async () => {
    if (document.getElementById('buyOver').disabled) {
        addLog("Please connect account first", "error");
        return;
    }
    const bulk = parseInt(document.getElementById('bulk').value) || 1;
    let dir = document.getElementById('poofPrediction').innerText.includes("OVER") ? "over" : "under";
    const b = parseInt(document.getElementById('barrier').value);
    if (b === 0) dir = "over";
    if (b === 9) dir = "under";
    
    addLog(`Executing Bulk ${bulk}x on Digit ${selectedDigit}...`, "warning");
    for(let i=0; i<bulk; i++) {
        executeTradeSpecific(dir, selectedDigit);
        await new Promise(r => setTimeout(r, 50)); // Changed from 200ms to 50ms as requested
    }
    closeDigitModal();
};

document.getElementById('modalSetBarrier').onclick = () => {
    document.getElementById('barrier').value = selectedDigit;
    addLog(`Barrier Switch: ${selectedDigit}`, "success");
    closeDigitModal();
};

const digitFreqContainer = document.getElementById('digitFrequency');
for(let i=0; i<=9; i++) {
    const div = document.createElement('div');
    div.className = 'digit-box';
    div.id = `digit-${i}`;
    div.innerHTML = `<span class="digit-val">${i}</span><span class="digit-pct" id="pct-${i}">0%</span><div class="digit-bar" id="bar-${i}"></div>`;
    div.onclick = () => openDigitModal(i);
    div.tabIndex = 0;
    div.onkeydown = (e) => { if(e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDigitModal(i); } };
    digitFreqContainer.appendChild(div);
}

function safeSend(data) { if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data)); }

function initCharts() {
    if (accuracyChart) accuracyChart.destroy();
    const ctx = document.getElementById('accuracyChart').getContext('2d');
    accuracyChart = new Chart(ctx, {
        type: 'line',
        data: { labels: [], datasets: [{ data: [], borderColor: '#f472b6', borderWidth: 2, tension: 0.4, pointRadius: 2, fill: true, backgroundColor: 'rgba(244, 114, 182, 0.1)' }] },
        options: { 
            responsive: true, maintainAspectRatio: false, 
            animation: { duration: 0 },
            scales: { y: { min: 0, max: 100, grid: { color: '#1e293b' }, ticks: { color: '#94a3b8', font: { size: 9 } } }, x: { display: false } }, 
            plugins: { legend: { display: false } } 
        }
    });
}

function addLog(msg, type = 'info') {
    const log = document.getElementById('log');
    const entry = document.createElement('div');
    entry.className = `log-entry`;
    const color = type === 'success' ? '#10b981' : type === 'error' ? '#f43f5e' : type === 'warning' ? '#f59e0b' : '#3b82f6';
    entry.style.color = color;
    entry.innerHTML = `<span>[${new Date().toLocaleTimeString([], {hour12:false})}]</span> <span>${escapeHtml(msg)}</span>`;
    log.prepend(entry);
    if(log.childNodes.length > 50) log.lastChild.remove();
}

function resetTxUI() {
    document.getElementById('txStatus').innerText = "Idle";
    document.getElementById('txEntry').innerText = "-";
    document.getElementById('txTick').innerText = "-";
    document.getElementById('txTime').innerText = "-";
    document.getElementById('txResult').innerText = "-";
    document.getElementById('txResult').style.color = 'var(--text-main)';
}

function resetSystemUI(fullReset = true) {
    ticks = [];
    smoothedConf = 0; 
    poofConf = 0; 
    tickCounter = 0;
    lastTradeTick = -10;
    
    if (fullReset) {
        winCount = 0; 
        totalTrades = 0; 
        sessionProfit = 0;
        isAiRunning = false;
        isTradeActive = false;
        historyRecords = {};
        document.getElementById('balanceDisplay').innerText = "$0.00";
        document.getElementById('sessionProfit').innerText = "$0.00";
        document.getElementById('sessionProfit').style.color = "var(--text-main)";
        document.getElementById('historyList').innerHTML = '';
        if (accuracyChart) { accuracyChart.data.labels = []; accuracyChart.data.datasets[0].data = []; accuracyChart.update(); }
    }

    document.getElementById('aiConfidence').innerText = "0.0%";
    document.getElementById('boostFill').style.width = "0%";
    document.getElementById('aiStatusDisplay').innerText = "AI STANDBY";
    document.getElementById('aiStatusDisplay').style.color = "var(--text-dim)";
    document.getElementById('aiInsight').innerText = "Waiting for data...";
    document.getElementById('poofValue').innerText = "0.0%";
    document.getElementById('poofPrediction').innerText = "Calibrating (W:25)...";
    
    document.getElementById('rsiVal').innerText = "--";
    document.getElementById('volVal').innerText = "--";
    document.getElementById('trendVal').innerText = "--";
    document.getElementById('core1Val').innerText = "--";
    document.getElementById('core2Val').innerText = "--";
    document.getElementById('core3Val').innerText = "--";
    document.getElementById('core4Val').innerText = "--";

    for(let i=0; i<=9; i++) {
        document.getElementById(`bar-${i}`).style.height = `0%`;
        document.getElementById(`pct-${i}`).innerText = `0%`;
        document.getElementById(`digit-${i}`).classList.remove('active-tick');
    }

    resetTxUI();

    if (fullReset) {
        document.getElementById('aiBtn').innerText = "START AI ENGINE";
        document.getElementById('aiBtn').classList.add('btn-omega');
        document.getElementById('aiBtn').classList.remove('btn-error');
    }
}

function updateTxUI(data) {
    if (data.status) document.getElementById('txStatus').innerText = data.status;
    if (data.entry) document.getElementById('txEntry').innerText = data.entry;
    if (data.tick) document.getElementById('txTick').innerText = data.tick;
    if (data.time) document.getElementById('txTime').innerText = data.time;
    if (data.result !== undefined) {
        const el = document.getElementById('txResult');
        el.innerText = data.result;
        el.style.color = data.result.includes('WIN') ? 'var(--success)' : 'var(--error)';
    }
}

function addToHistory(contract) {
    historyRecords[contract.contract_id] = contract; // Store full object for popup
    
    const list = document.getElementById('historyList');
    const item = document.createElement('div');
    const profit = parseFloat(contract.profit);
    const stake = parseFloat(contract.buy_price);
    const isWin = profit > 0;
    const type = contract.contract_type.includes('OVER') ? 'OVER' : 'UNDER';
    const time = new Date(contract.purchase_time * 1000).toLocaleTimeString([], {hour12:false});

    item.className = `history-item ${isWin ? 'win' : 'loss'}`;
    item.onclick = () => showTxDetail(contract.contract_id);
    item.innerHTML = `
        <div class="hist-header">
            <span style="color: ${isWin ? 'var(--success)' : 'var(--error)'}">${escapeHtml(type + ' ' + contract.barrier)}</span>
            <span style="color: ${isWin ? 'var(--success)' : 'var(--error)'}">${isWin ? 'WIN' : 'LOSS'}</span>
        </div>
        <div class="hist-grid">
            <div class="hist-row"><span>Stake:</span><span>$${escapeHtml(stake.toFixed(2))}</span></div>
            <div class="hist-row"><span>Profit:</span><span style="color:${isWin?'var(--success)':'var(--error)'}">${escapeHtml((isWin?'+':'') + profit.toFixed(2))}</span></div>
            <div class="hist-row"><span>Time:</span><span>${escapeHtml(time)}</span></div>
            <div class="hist-row"><span>Click:</span><span>Details</span></div>
        </div>
    `;
    list.prepend(item);
    if(list.childNodes.length > 500) list.lastChild.remove();
}

document.getElementById('market').onchange = (e) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
        addLog(`Switching Market: ${e.target.value}`, "warning");
        safeSend({ forget_all: "ticks" }); 
        resetSystemUI(false); 
        safeSend({ ticks: e.target.value, subscribe: 1 }); 
    }
};

document.getElementById('connectBtn').onclick = () => {
    if (ws && ws.readyState < 2) { ws.close(); return; }
    const token = document.getElementById('apiToken').value.trim();
    if(!token) return addLog("API Token required", "error");
    if(document.getElementById('botPassword').value !== "641") return addLog("Invalid Access Key", "error");

    addLog("Connecting...", "warning");
    ws = new WebSocket('wss://ws.binaryws.com/websockets/v3?app_id=1089');
    ws.onopen = () => safeSend({ authorize: token });
    ws.onmessage = (msg) => {
        const data = JSON.parse(msg.data);
        if(data.error) return addLog(data.error.message, "error");
        if(data.msg_type === 'authorize') {
            document.getElementById('connectionStatus').classList.add('online');
            document.getElementById('connectBtn').innerText = "DISCONNECT";
            document.getElementById('connectBtn').classList.replace('btn-primary', 'btn-error');
            safeSend({ ticks: document.getElementById('market').value, subscribe: 1 });
            safeSend({ balance: 1, subscribe: 1 });
            safeSend({ proposal_open_contract: 1, subscribe: 1 });
            initCharts();
            document.querySelectorAll('.sidebar .btn').forEach(b => b.disabled = false);
            addLog("System Online", "success");
        }
        if(data.msg_type === 'balance') document.getElementById('balanceDisplay').innerText = `${data.balance.currency} ${data.balance.balance}`;
        if(data.msg_type === 'tick') processTick(data.tick);
        if(data.msg_type === 'buy') { isTradeActive = true; updateTxUI({ status: "Trade Active", time: new Date().toLocaleTimeString() }); }
        if(data.msg_type === 'proposal_open_contract') {
            const c = data.proposal_open_contract;
            if (c.entry_tick_display_value) document.getElementById('txEntry').innerText = c.entry_tick_display_value;
            if (c.exit_tick_display_value) document.getElementById('txTick').innerText = c.exit_tick_display_value;
            if(c?.is_sold) {
        const b = parseInt(c.barrier);
    
                isTradeActive = false;
                const p = parseFloat(c.profit);
                sessionProfit += p; totalTrades++;
                if(p > 0) winCount++;
                updateTxUI({ result: p > 0 ? `WIN +$${p.toFixed(2)}` : `LOSS $${p.toFixed(2)}` });
                addToHistory(c);
                updateAccountUI();
                setTimeout(() => { if(!isTradeActive) resetTxUI(); }, 5000);
            }
        }
    };
    ws.onclose = () => {
        document.getElementById('connectionStatus').classList.remove('online');
        document.getElementById('connectBtn').innerText = "CONNECT ACCOUNT";
        document.getElementById('connectBtn').classList.replace('btn-error', 'btn-primary');
        document.querySelectorAll('.sidebar .btn:not(#connectBtn)').forEach(b => b.disabled = true);
        resetSystemUI(true); 
    };
};

function processTick(tick) {
    if (!tick || !tick.quote) return;
    const digit = parseInt(tick.quote.toString().slice(-1));
    ticks.push(digit);
    if(ticks.length > 100) ticks.shift();
    tickCounter++; lastTickTime = Date.now();
    
    document.querySelectorAll('.digit-box').forEach(b => b.classList.remove('active-tick'));
    document.getElementById(`digit-${digit}`)?.classList.add('active-tick');

    const currentStats = Array(10).fill(0);
    ticks.forEach(d => currentStats[d]++);
    for(let i=0; i<=9; i++) {
        const pct = (currentStats[i] / ticks.length) * 100;
        document.getElementById(`bar-${i}`).style.height = `${pct}%`;
        document.getElementById(`pct-${i}`).innerText = `${pct.toFixed(0)}%`;
    }
    
    runAIAnalysis();
    runCoreEngines();
    
    const statusEl = document.getElementById('aiStatusDisplay');
    const ticksLeft = 10 - (tickCounter - lastTradeTick);
    if (isAiRunning) {
        if (ticksLeft > 0) { statusEl.innerText = `COOLING DOWN (${ticksLeft}t)`; statusEl.style.color = "var(--warning)"; }
        else { statusEl.innerText = "SCANNING OPPORTUNITY"; statusEl.style.color = "var(--success)"; }
    }
}

function runAIAnalysis() {
    if(ticks.length < 10) return; 
    const barrier = parseInt(document.getElementById('barrier').value);
    
    let gains = 0, losses = 0;
    for(let i = 1; i <= 14 && i < ticks.length; i++) {
        let diff = ticks[ticks.length - i] - (ticks[ticks.length - i - 1] || 0);
        if(diff >= 0) gains += diff; else losses -= diff;
    }
    const rsi = losses === 0 ? 100 : 100 - (100 / (1 + (gains / (losses || 1))));
    const recent = ticks.slice(-20);
    const mean = recent.reduce((a, b) => a + b, 0) / recent.length;
    const volatility = Math.sqrt(recent.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / recent.length);
    document.getElementById('rsiVal').innerText = rsi.toFixed(1);
    document.getElementById('volVal').innerText = volatility.toFixed(2);
    document.getElementById('trendVal').innerText = ticks.slice(-5).reduce((a,b)=>a+b)/5 > mean ? "BULL" : "BEAR";

    const poofWindow = ticks.slice(-25);
    let pOver = 0, pUnder = 0;
    poofWindow.forEach((d, idx) => { const weight = (idx + 1) / 25; if (d > barrier) pOver += weight; else if (d < barrier) pUnder += weight; });
    let decay = ((Date.now() - lastTickTime) / 1000) * 2.5;
    if ([0,1,9].includes(barrier)) decay -= 3.5; 
    poofConf = Math.max(Math.min((Math.max(pOver, pUnder) / (pOver + pUnder || 1)) * 100, 80) - decay, 0); 
    document.getElementById('poofValue').innerText = `${poofConf.toFixed(1)}%`;
    document.getElementById('poofPrediction').innerText = `Poof: ${pOver > pUnder ? "OVER" : "UNDER"} ${barrier}`;

    let rawConf = poofConf + (ticks.slice(-3).filter(d => (pOver > pUnder ? d > barrier : d < barrier)).length / 3 * 15);
    rawConf = Math.min(Math.max(rawConf - (volatility * 2), 0), 98.5);
    smoothedConf = (smoothedConf * 0.7) + (rawConf * 0.3);
    
    
    const memAdj = memoryBias(barrier);
    smoothedConf = Math.max(Math.min(smoothedConf + memAdj, 99), 0);
    document.getElementById('aiConfidence').innerText = `${smoothedConf.toFixed(1)}%`;
    
    document.getElementById('boostFill').style.width = `${smoothedConf}%`;
    document.getElementById('aiInsight').innerText = smoothedConf > 80 ? "Cluster detected. High signal quality." : "Scanning patterns...";
}

function runCoreEngines() {
    const barrier = parseInt(document.getElementById('barrier').value);
    const dist = ticks.slice(-10).reduce((acc, d) => acc + Math.abs(d - barrier), 0) / 10;
    document.getElementById('core1Val').innerText = dist < 2 ? "HIGH" : "LOW";
    document.getElementById('core2Val').innerText = Math.abs(ticks[ticks.length-1] - (ticks[ticks.length-2]||0)).toFixed(1);
    document.getElementById('core3Val').innerText = poofConf > 60 ? "LOCKED" : "SCAN";
    document.getElementById('core4Val').innerText = (ticks.slice(-10).reduce((a,b)=>a+b)/10).toFixed(1);
}

function updateAccountUI() {
    document.getElementById('sessionProfit').innerText = `$${sessionProfit.toFixed(2)}`;
    document.getElementById('sessionProfit').style.color = sessionProfit >= 0 ? 'var(--success)' : 'var(--error)';
    if(accuracyChart) {
        accuracyChart.data.labels.push(""); accuracyChart.data.datasets[0].data.push(totalTrades > 0 ? (winCount/totalTrades)*100 : 0);
        if(accuracyChart.data.labels.length > 20) { accuracyChart.data.labels.shift(); accuracyChart.data.datasets[0].data.shift(); }
        accuracyChart.update('none');
    }
}

async function executeTrade(dir) {
    const barrier = document.getElementById('barrier').value;
    executeTradeSpecific(dir, barrier);
}

async function executeTradeSpecific(dir, barrierValue) {
    if(!ws || ws.readyState !== 1) return;
    const stake = parseFloat(document.getElementById('stake').value);
    safeSend({
        buy: 1, price: stake,
        parameters: { 
            amount: stake, basis: 'stake', contract_type: dir === 'over' ? 'DIGITOVER' : 'DIGITUNDER', 
            currency: 'USD', duration: parseInt(document.getElementById('duration').value), 
            duration_unit: 't', symbol: document.getElementById('market').value, barrier: barrierValue.toString()
        }
    });
}

document.getElementById('buyOver').onclick = () => executeTrade('over');
document.getElementById('buyUnder').onclick = () => executeTrade('under');
document.getElementById('aiBtn').onclick = () => {
    isAiRunning = !isAiRunning;
    document.getElementById('aiBtn').innerText = isAiRunning ? "STOP AI ENGINE" : "START AI ENGINE";
    document.getElementById('aiBtn').classList.toggle('btn-omega', !isAiRunning);
    document.getElementById('aiBtn').classList.toggle('btn-error', isAiRunning);
    if(isAiRunning) autoLoop();
};

// ===== OMEGA CORE CONFIRMATION LOGIC =====
function coreConfirmations(mode) {
    const gravity = document.getElementById('core1Val').innerText;
    const velocity = parseFloat(document.getElementById('core2Val').innerText);
    const pattern = document.getElementById('core3Val').innerText;
    const volatility = parseFloat(document.getElementById('core4Val').innerText);

    const rules = {
        aggressive: { gravity: "HIGH", velocity: 1.2, pattern: "LOCKED", volatilityMax: 6.5 },
        adaptive:   { gravity: "HIGH", velocity: 0.9, pattern: "LOCKED", volatilityMax: 5.2 },
        conservative:{ gravity: "HIGH", velocity: 0.6, pattern: "LOCKED", volatilityMax: 4.0 }
    };

    const r = rules[mode];
    return gravity === r.gravity &&
           velocity >= r.velocity &&
           pattern === r.pattern &&
           volatility <= r.volatilityMax;
}

// ===== CORE DETAIL POPUPS =====
function showCoreDetail(core) {
    const map = {
        1: "OMEGA GRAVITY detects magnetic pull toward the barrier using recent digit clustering.",
        2: "VELOCITY BOOST measures acceleration between ticks to confirm momentum.",
        3: "PATTERN SYNC validates Poof engine alignment across windows.",
        4: "VOLATILITY FLOOR ensures noise is below execution risk threshold."
    };
    document.getElementById('txDetailContent').innerHTML =
        `<div class="detail-row"><span class="detail-val">${map[core]}</span></div>`;
    openModal('txDetailModal');
}

document.getElementById('core1Box').onclick = () => showCoreDetail(1);
document.getElementById('core2Box').onclick = () => showCoreDetail(2);
document.getElementById('core3Box').onclick = () => showCoreDetail(3);
document.getElementById('core4Box').onclick = () => showCoreDetail(4);

let backoffTicks = 0;

async function autoLoop() {
    if(!isAiRunning) return;
    const cdLimit = 10;
    const mode = document.getElementById('aiMode').value;
    let threshold = 85; 
    if (mode === 'aggressive') threshold = 78;
    if (mode === 'conservative') threshold = 91;

    if(smoothedConf >= threshold && !isTradeActive && (tickCounter - lastTradeTick) >= cdLimit && coreConfirmations(mode)) {
        let dir = document.getElementById('poofPrediction').innerText.includes("OVER") ? "over" : "under";
    const b = parseInt(document.getElementById('barrier').value);
    if (b === 0) dir = "over";
    if (b === 9) dir = "under";
        lastTradeTick = tickCounter; 
        const bulk = parseInt(document.getElementById('bulk').value) || 1;
        for(let i=0; i<bulk; i++) { 
            executeTrade(dir); 
            await new Promise(r => setTimeout(r, 50)); // Fast bulk execution
        }
    }
    setTimeout(() => { if(isAiRunning) autoLoop(); }, 200);
}
document.getElementById('clearHistory').onclick = () => { 
    document.getElementById('historyList').innerHTML = ''; 
    historyRecords = {};
};

/* ================== OMEGA PERSISTENT MEMORY EXTENSION ================== */
const MEMORY_KEY = "omega_ai_memory_v1";
const BLOCK_AFTER = 3;
const BLOCK_TIME = 30 * 60 * 1000;

function loadMemory(){ return JSON.parse(localStorage.getItem(MEMORY_KEY)||"{}"); }
function saveMemory(m){ localStorage.setItem(MEMORY_KEY, JSON.stringify(m)); }

function getBarrierMemory(market, barrier){
    const mem = loadMemory();
    mem[market] ??= {};
    mem[market][barrier] ??= {wins:0,losses:0,streak:0,lastUpdated:Date.now()};
    saveMemory(mem);
    return mem[market][barrier];
}

function applyDecay(entry){
    const hrs = (Date.now()-entry.lastUpdated)/3600000;
    if(hrs<1) return;
    const f = Math.pow(0.98, hrs);
    entry.wins*=f; entry.losses*=f;
    entry.lastUpdated = Date.now();
}

function isBarrierBlocked(market, barrier){
    const m = loadMemory();
    const e = m?.[market]?.[barrier];
    return e?.blockedUntil && Date.now() < e.blockedUntil;
}

/* override memoryBias */
memoryBias = function(barrier){
    const market = getMarket();
    const e = getBarrierMemory(market, barrier);
    applyDecay(e);
    if(isBarrierBlocked(market, barrier)) return -100;
    const t = e.wins+e.losses;
    if(t<3) return 0;
    const w = e.wins/t;
    if(w<0.4) return -8;
    if(w>0.65) return 6;
    return 0;
};

/* persist trade outcomes */
const _origAddToHistory = addToHistory;
addToHistory = function(contract){
    _origAddToHistory(contract);
    const market = getMarket();
    const barrier = parseInt(contract.barrier);
    const e = getBarrierMemory(market, barrier);
    applyDecay(e);
    if(parseFloat(contract.profit)>0){
        e.wins++; e.streak=Math.max(1,e.streak+1);
    }else{
        e.losses++; e.streak=Math.min(-1,e.streak-1);
        if(e.streak<=-BLOCK_AFTER) e.blockedUntil=Date.now()+BLOCK_TIME;
    }
    e.lastUpdated=Date.now();
    saveMemory(loadMemory());
};

/* block AI execution */
const _origAutoLoop = autoLoop;
autoLoop = async function(){
    const b = parseInt(document.getElementById('barrier').value);
    if(isBarrierBlocked(getMarket(), b)) return;
    await _origAutoLoop();
};
/* ================== END MEMORY EXTENSION ================== */
