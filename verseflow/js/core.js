// ==========================================================
// CORE CONFIGURATION & GLOBAL NAMESPACE
// ==========================================================
window.VerseFlow = window.VerseFlow || {};

// Routing flag to determine which UI to run
VerseFlow.isProjector = new URLSearchParams(window.location.search).get('mode') === 'projector';

// Initialize Cross-Window Communication
if ('BroadcastChannel' in window) {
    VerseFlow.channel = new BroadcastChannel('verseflow_channel');
} else {
    console.warn("BroadcastChannel API not supported in this browser.");
    alert("⚠️ Dual-screen presentation requires BroadcastChannel support. Running in standalone local mode.");
    VerseFlow.channel = { postMessage: () => {}, onmessage: null };
}

// Global hotkeys allowed for navigation
VerseFlow.navKeys = ['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'enter', ' ', 'escape', 'backspace', 'pagedown', 'pageup', 'v', 'c', 'b', 'p', 'e', 't', '.'];

// ==========================================================
// SERVICE WORKER REGISTRATION & UPDATE NOTIFIER
// ==========================================================
VerseFlow.refreshing = false;
VerseFlow.isInitialInstall = false;

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then((registration) => {
                console.log('VerseFlow ServiceWorker active:', registration.scope);
            })
            .catch((error) => {
                console.warn('VerseFlow ServiceWorker failed:', error);
            });
    });

    VerseFlow.isInitialInstall = !navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (VerseFlow.refreshing) return;

        if (VerseFlow.isInitialInstall) {
            VerseFlow.isInitialInstall = false;
            return;
        }

        const brandLink = document.querySelector('.brand');
        if (brandLink) {
            brandLink.classList.add('update-ready');
        }
    });
}