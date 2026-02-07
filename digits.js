// digits.js - Modular Digit System Engine
// The Brain: Loads config from digits.json and exposes confidence/decay logic

let systemSettings = {};

async function initDigitSystem() {
    try {
        const res = await fetch('digits.json');
        systemSettings = await res.json();
        console.log("Omega Logic Loaded:", systemSettings.config);
    } catch (e) {
        console.error('Failed to load digits.json:', e);
    }
}

// The new core confidence calculator
// Exponential Decay: e^(-lambda * t)
function getDecayedConfidence(entry, isNewMarket) {
    if (!systemSettings.config) return 1;
    const { decay_constant, market_shift_multiplier } = systemSettings.config;
    const now = Date.now();
    const elapsedMinutes = (now - (entry?.lastUpdated || now)) / 60000;

    let lambda = decay_constant;
    if (isNewMarket) lambda *= market_shift_multiplier;

    return Math.exp(-lambda * elapsedMinutes);
}

// Get thresholds from config
function getFloors() {
    return systemSettings.config?.floors || { block: 0.4, hedge: 0.6, strong: 0.65 };
}

// Initialize on load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDigitSystem);
} else {
    initDigitSystem();
}
