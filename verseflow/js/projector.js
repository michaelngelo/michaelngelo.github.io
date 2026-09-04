// ==========================================================
// PROJECTOR WINDOW ENGINE
// ==========================================================
(function() {
    // Only run this script if the window is in projector mode
    if (!VerseFlow.isProjector) return;

    document.title = "VerseFlow — Live Projector Display";

    const projUI = document.getElementById('projector-ui');
    const projOverlay = document.getElementById('projector-overlay');
    const projBlackout = document.getElementById('projector-blackout');
    const projContent = document.getElementById('projector-content');
    let currentLiveState = null;

    function applyProjectorTheme(data) {
        const themeClass = data.theme || 'theme-dark';
        const layoutClass = data.layoutStyle || 'layout-center';

        if (themeClass === 'theme-custom') {
            projUI.className = `projector theme-custom ${layoutClass}`;
            projUI.style.backgroundColor = data.customBgColor || '#000000';
            if (data.customBg) {
                projUI.style.backgroundImage = `url("${data.customBg}")`;
            } else {
                projUI.style.backgroundImage = 'none';
            }
            projOverlay.style.display = data.dimBg ? 'block' : 'none';
            projContent.style.color = data.customColor || '#ffffff';
        } else {
            projUI.style.backgroundColor = '';
            projUI.style.backgroundImage = '';
            projOverlay.style.display = 'none';
            projContent.style.color = '';
            projUI.className = `projector ${themeClass} ${layoutClass}`;
        }

        if (data && data.isBlackout) {
            if (projBlackout) projBlackout.classList.add('active');
        } else {
            if (projBlackout) projBlackout.classList.remove('active');
        }
    }

    VerseFlow.channel.onmessage = (e) => {
        if (e.data.type === 'UPDATE_SLIDE') {
            currentLiveState = { index: e.data.liveIndex, songId: e.data.liveSongId, isBlackout: !!e.data.isBlackout };
            applyProjectorTheme(e.data);
            projContent.style.setProperty('--tune-w', (e.data.tuneW || 100) + 'vw');
            projContent.style.setProperty('--tune-x', (e.data.tuneX || 0) + 'vw');
            projContent.style.setProperty('--tune-y', (e.data.tuneY || 0) + 'vh');
            projContent.classList.remove('fade-animation');
            void projContent.offsetWidth; // Force reflow
            projContent.innerHTML = e.data.html || '';
            projContent.style.fontSize = e.data.fontSize || '5vw';
            projContent.classList.add('fade-animation');
        } else if (e.data.type === 'UPDATE_TUNE') {
            projContent.style.setProperty('--tune-w', e.data.w + 'vw');
            projContent.style.setProperty('--tune-x', e.data.x + 'vw');
            projContent.style.setProperty('--tune-y', e.data.y + 'vh');
        } else if (e.data.type === 'CLEAR_SLIDE') {
            currentLiveState = null;
            projContent.innerHTML = '';
            applyProjectorTheme(e.data);
        } else if (e.data.type === 'SET_BLACKOUT') {
            if (projBlackout) {
                if (e.data.blackout) projBlackout.classList.add('active');
                else projBlackout.classList.remove('active');
            }
        } else if (e.data.type === 'DASHBOARD_BOOT') {
            if (currentLiveState) {
                VerseFlow.channel.postMessage({ type: 'PROJECTOR_SYNC', state: currentLiveState });
            } else {
                VerseFlow.channel.postMessage({ type: 'PROJECTOR_READY' });
            }
        }
    };

    window.addEventListener('DOMContentLoaded', () => {
        VerseFlow.channel.postMessage({ type: 'PROJECTOR_READY' });
    });

    // Fullscreen toggle on double click
    projUI.addEventListener('dblclick', () => {
        toggleFullscreen();
    });

    function toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => console.log(err));
        } else {
            document.exitFullscreen().catch(err => console.log(err));
        }
    }

    // Keyboard navigation from projector window forwarded to dashboard
    document.addEventListener('keydown', (e) => {
        const key = e.key.toLowerCase();
        if (key === 'f') {
            toggleFullscreen();
            e.preventDefault();
            return;
        }
        if (VerseFlow.navKeys.includes(key) || (key >= '0' && key <= '9')) {
            VerseFlow.channel.postMessage({ type: 'PROJECTOR_KEYPRESS', key: key });
            e.preventDefault();
        }
    });

})();