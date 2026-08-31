// ==========================================================
// 1. INDEXEDDB MEDIA STORAGE HELPER
// ==========================================================
function openMediaDB() {
    return new Promise((resolve, reject) => {
        if (!('indexedDB' in window)) {
            return reject(new Error('IndexedDB not supported'));
        }
        const req = indexedDB.open('VerseSurfMediaDB', 1);
        req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('images')) {
                db.createObjectStore('images', { keyPath: 'id' });
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

function generateThumbnail(file, maxWidth = 240, maxHeight = 135) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const tempUrl = URL.createObjectURL(file);

        img.onload = () => {
            URL.revokeObjectURL(tempUrl); 
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;

            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width = width * ratio;
            height = height * ratio;

            canvas.width = Math.max(1, Math.floor(width));
            canvas.height = Math.max(1, Math.floor(height));

            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            canvas.toBlob((blob) => {
                resolve(blob || file);
            }, 'image/jpeg', 0.75); 
        };

        img.onerror = () => {
            URL.revokeObjectURL(tempUrl);
            reject(new Error("Thumbnail generation failed."));
        };
        img.src = tempUrl;
    });
}

async function saveImageToDB(file) {
    const db = await openMediaDB();
    const id = 'idb_' + Date.now();
    let thumbBlob = null;
    try {
        thumbBlob = await generateThumbnail(file);
    } catch (err) {
        thumbBlob = file;
    }

    return new Promise((resolve, reject) => {
        const tx = db.transaction('images', 'readwrite');
        const store = tx.objectStore('images');
        store.put({ 
            id, 
            name: file.name, 
            blob: file, 
            thumbnail: thumbBlob, 
            createdAt: Date.now() 
        });
        tx.oncomplete = () => resolve(id);
        tx.onerror = () => reject(tx.error);
    });
}

async function getAllImagesFromDB() {
    try {
        const db = await openMediaDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('images', 'readonly');
            const store = tx.objectStore('images');
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => reject(req.error);
        });
    } catch (e) {
        return [];
    }
}

async function getImageFromDB(id) {
    try {
        const db = await openMediaDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('images', 'readonly');
            const store = tx.objectStore('images');
            const req = store.get(id);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    } catch (e) {
        return null;
    }
}

async function deleteImageFromDB(id) {
    try {
        const db = await openMediaDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('images', 'readwrite');
            const store = tx.objectStore('images');
            store.delete(id);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    } catch (e) {
        console.error("IndexedDB delete error:", e);
    }
}

async function resolveBackgroundUrl(bgRef) {
    if (!bgRef) return '';
    if (bgRef.startsWith('idb_')) {
        const record = await getImageFromDB(bgRef);
        if (record && record.blob) {
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = () => resolve('');
                reader.readAsDataURL(record.blob);
            });
        }
        return '';
    }
    return bgRef;
}

// ==========================================================
// 2. TEXT FORMATTING & WORSHIP PARSER
// ==========================================================
function escapeHTML(str) {
    return String(str).replace(/[&<>'"]/g, tag => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
    }[tag] || tag));
}

function formatContent(text) {
    if (!text) return '';
    
    // Normalize newlines
    let normalized = String(text).replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // Step 1: Tokenize LaTeX math formulas ($$ and $)
    const mathTokens = [];

    // Block Math: $$ ... $$
    let processed = normalized.replace(/\$\$(.*?)\$\$/gs, (match, equation) => {
        const token = `___KATEX_BLOCK_${mathTokens.length}___`;
        try {
            if (typeof katex !== 'undefined') {
                mathTokens.push(katex.renderToString(equation.trim(), { displayMode: true, throwOnError: false }));
            } else {
                mathTokens.push(`<div class="katex-display">${escapeHTML(equation.trim())}</div>`);
            }
        } catch (e) {
            mathTokens.push(escapeHTML(match));
        }
        return token;
    });

    // Inline Math: $ ... $ (Cross-browser safe capture group, avoiding lookbehind syntax error)
    processed = processed.replace(/\$(?!\s|\d)([^$\n]*?[^\s$])\$/g, (match, equation) => {
        const token = `___KATEX_INLINE_${mathTokens.length}___`;
        try {
            if (typeof katex !== 'undefined') {
                mathTokens.push(katex.renderToString(equation.trim(), { displayMode: false, throwOnError: false }));
            } else {
                mathTokens.push(`<span class="katex">${escapeHTML(equation.trim())}</span>`);
            }
        } catch (e) {
            mathTokens.push(escapeHTML(match));
        }
        return token;
    });

    // Step 2: Safe HTML escape of text
    let html = escapeHTML(processed);

    // Step 3: Responsive Scripture Role Markers (English & Traditional Chinese)
    html = html.replace(/【(Leader|領|啟|Reader)】/gi, match => `<span class="role-leader">${match}</span>`)
               .replace(/【(People|Congregation|應)】/gi, match => `<span class="role-congregation">${match}</span>`)
               .replace(/【(All|眾|Everyone)】/gi, match => `<span class="role-all">${match}</span>`);

    // Step 4: Markdown Formatting & Citations
    html = html.replace(/^&gt;\s*(.*)(\r?\n)?/gm, '<div class="citation">$1</div>');
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    // Step 5: Bilingual / Secondary Subtitles Formatting (lines starting with /, in half-width parens, or in full-width parens)
    html = html.replace(/^(\/|\([^\)]*\)|（[^）]*）)(.*)$/gm, '<span class="bilingual-sub">$1$2</span>');

    // Step 6: Line breaks and verse number spacing
    html = html.replace(/\n(?=\s*\d+)/g, '<br><span class="verse-space"></span>');
    html = html.replace(/\n/g, '<br>');

    // Step 7: Re-insert KaTeX rendered HTML tokens using function replacer to avoid '$' regex replacement issues
    mathTokens.forEach((renderedHtml, idx) => {
        html = html.replace(`___KATEX_BLOCK_${idx}___`, () => renderedHtml);
        html = html.replace(`___KATEX_INLINE_${idx}___`, () => renderedHtml);
    });

    return html;
}

function parseTextToSlides(text) {
    if (!text || typeof text !== 'string') return [];
    const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const blocks = normalized.split(/\n\s*\n/);
    const parsedSlides = blocks.flatMap((block, blockIndex) => {
        let label = '';
        let content = block.trim();
        if (!content) return [];

        if (content.startsWith('#')) {
            const blockLines = content.split('\n');
            label = blockLines[0].replace(/^#+\s*/, '').trim();
            content = blockLines.slice(1).join('\n').trim();
        }

        const rollingMatch = label.match(/^rolling(?:\s+(\d+))?$/i);            
        if (rollingMatch) {
            let linesPerSlide = 2;
            if (rollingMatch[1]) {
                const parsedNum = parseInt(rollingMatch[1], 10);
                if (!isNaN(parsedNum) && parsedNum > 0) linesPerSlide = parsedNum;
            }

            const rawLines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);
            let citation = '';
            let verses = [...rawLines];

            if (verses.length > 0 && verses[0].startsWith('>')) {
                citation = verses.shift().trim() + '\n';
            }

            if (verses.length === 0) {
                return [{ label: "Scripture", content: citation.trim() }];
            }

            if (verses.length <= linesPerSlide) {
                return [{ label: "Scripture", content: (citation + verses.join('\n')).trim() }];
            }

            const rollingSlides = [];
            for (let i = 0; i < verses.length; i += linesPerSlide) {
                const chunk = verses.slice(i, i + linesPerSlide);
                const chunkText = chunk.join('\n');
                
                let verseLabel = '';
                const firstMatch = chunk[0].match(/^(?:v\.?\s*|\b)(\d+)|^(【.*?】)/i);
                const lastMatch = chunk[chunk.length - 1].match(/^(?:v\.?\s*|\b)(\d+)|^(【.*?】)/i);
                
                const firstVal = firstMatch ? (firstMatch[1] || firstMatch[2] || firstMatch[0]) : '';
                const lastVal = lastMatch ? (lastMatch[1] || lastMatch[2] || lastMatch[0]) : '';

                if (firstVal && lastVal && firstVal !== lastVal) {
                    verseLabel = `${firstVal}-${lastVal}`;
                } else if (firstVal) {
                    verseLabel = firstVal;
                } else {
                    verseLabel = `Part ${Math.floor(i / linesPerSlide) + 1}`;
                }

                rollingSlides.push({ label: verseLabel, content: (citation + chunkText).trim() });
            }

            return rollingSlides;
        }

        const defaultLabel = (blockIndex === 0 && !label) ? "Title" : label;
        return [{ label: defaultLabel, content }];
    }).filter(s => s && (s.content || s.label));
    
    parsedSlides.forEach((s, idx) => s.id = idx);
    return parsedSlides;
}

// ==========================================================
// 3. HYBRID COMMUNICATION BUS (BroadcastChannel + WebRTC P2P)
// ==========================================================
const urlParams = new URLSearchParams(window.location.search);
const isProjector = urlParams.get('mode') === 'projector';
const isRemote = urlParams.get('mode') === 'remote';
let targetRoom = urlParams.get('room') || (isRemote ? localStorage.getItem('versesurf_last_room') : null);

class PresentationBus {
    constructor() {
        this.p2pConnections = [];
        this.onMessageHandlers = [];
        this.roomId = null;
        this.peer = null;

        if ('BroadcastChannel' in window) {
            this.localChannel = new BroadcastChannel('versesurf_channel');
            this.localChannel.onmessage = (e) => this.dispatchMessage(e.data, 'local');
        } else {
            this.localChannel = { postMessage: () => {}, onmessage: null };
        }

        this.initP2P();
    }

    initP2P() {
        if (typeof Peer === 'undefined') return;

        if (isRemote) {
            this.peer = new Peer();
            this.peer.on('open', () => {
                if (targetRoom) {
                    this.connectToRoom(targetRoom);
                } else {
                    this.updateRemoteStatusUI('no-room');
                }
            });
            this.peer.on('error', (err) => {
                console.warn('Remote PeerJS error:', err);
                this.updateRemoteStatusUI('error');
            });
        } else if (isProjector && targetRoom) {
            this.peer = new Peer();
            this.peer.on('open', () => {
                const conn = this.peer.connect(targetRoom, { reliable: true });
                conn.on('open', () => {
                    this.p2pConnections.push(conn);
                    conn.send({ type: 'PROJECTOR_READY' });
                });
                conn.on('data', (data) => this.dispatchMessage(data, 'p2p'));
                conn.on('close', () => {
                    this.p2pConnections = this.p2pConnections.filter(c => c !== conn);
                });
            });
            this.peer.on('error', (err) => console.warn('Projector PeerJS error:', err));
        } else if (!isRemote && (!isProjector || !targetRoom)) {
            const createHostPeer = (prefix = 'vs-') => {
                const generatedRoom = prefix + Math.random().toString(36).substring(2, 6);
                this.roomId = generatedRoom;
                this.peer = new Peer(generatedRoom);

                this.peer.on('open', (id) => {
                    this.roomId = id;
                    const pillText = document.getElementById('p2p-pill-text');
                    const roomCodeDisplay = document.getElementById('room-code-display');
                    if (pillText) pillText.textContent = `P2P: ${id}`;
                    if (roomCodeDisplay) roomCodeDisplay.textContent = id;
                    this.updateRemoteCountUI();
                });

                this.peer.on('connection', (conn) => {
                    conn.on('open', () => {
                        if (!this.p2pConnections.includes(conn)) {
                            this.p2pConnections.push(conn);
                        }
                        this.updateRemoteCountUI();
                        if (window.syncFullStateToRemote) window.syncFullStateToRemote(conn);
                    });
                    conn.on('data', (data) => {
                        if (data && (data.type === 'REMOTE_JOINED' || data.type === 'REMOTE_REQUEST_SYNC')) {
                            if (window.syncFullStateToRemote) window.syncFullStateToRemote(conn);
                        }
                        this.dispatchMessage(data, 'p2p');
                    });
                    conn.on('close', () => {
                        this.p2pConnections = this.p2pConnections.filter(c => c !== conn);
                        this.updateRemoteCountUI();
                    });
                    conn.on('error', () => {
                        this.p2pConnections = this.p2pConnections.filter(c => c !== conn);
                        this.updateRemoteCountUI();
                    });
                });

                this.peer.on('error', (err) => {
                    console.warn('Host PeerJS error:', err);
                    if (err.type === 'unavailable-id') {
                        setTimeout(() => createHostPeer('vs-'), 300);
                    }
                });
            };

            createHostPeer();
        }
    }

    connectToRoom(roomId) {
        if (!roomId || !this.peer) return;
        targetRoom = roomId.trim().toLowerCase();
        // Updated LocalStorage key
        localStorage.setItem('versesurf_last_room', targetRoom);

        this.updateRemoteStatusUI('connecting', targetRoom);

        this.p2pConnections.forEach(c => { try { c.close(); } catch(e){} });
        this.p2pConnections = [];

        const conn = this.peer.connect(targetRoom, { reliable: true });

        conn.on('open', () => {
            this.p2pConnections.push(conn);
            conn.send({ type: 'REMOTE_JOINED' });
            this.updateRemoteStatusUI('connected', targetRoom);
            const connectCard = document.getElementById('remote-connect-card');
            if (connectCard) connectCard.style.display = 'none';
        });

        conn.on('data', (data) => this.dispatchMessage(data, 'p2p'));

        conn.on('close', () => {
            this.p2pConnections = this.p2pConnections.filter(c => c !== conn);
            this.updateRemoteStatusUI('disconnected', targetRoom);
        });

        conn.on('error', (err) => {
            console.warn('Connection error:', err);
            this.updateRemoteStatusUI('disconnected', targetRoom);
        });
    }

    updateRemoteStatusUI(status, roomId = targetRoom) {
        const tag = document.getElementById('remote-room-label');
        const latency = document.getElementById('remote-latency');
        const reconnectBtn = document.getElementById('remote-reconnect-btn');
        const connectCard = document.getElementById('remote-connect-card');

        if (status === 'connected') {
            if (tag) tag.textContent = `ROOM: ${roomId}`;
            if (latency) {
                latency.textContent = `● Connected`;
                latency.style.color = 'var(--success-color)';
            }
            if (reconnectBtn) reconnectBtn.style.display = 'none';
            if (connectCard) connectCard.style.display = 'none';
        } else if (status === 'connecting') {
            if (tag) tag.textContent = `ROOM: ${roomId}`;
            if (latency) {
                latency.textContent = `● Connecting...`;
                latency.style.color = 'var(--warning-color)';
            }
            if (reconnectBtn) reconnectBtn.style.display = 'none';
        } else if (status === 'no-room') {
            if (tag) tag.textContent = `ROOM: None`;
            if (latency) {
                latency.textContent = `● Disconnected`;
                latency.style.color = '#71717a';
            }
            if (connectCard) connectCard.style.display = 'block';
            if (reconnectBtn) reconnectBtn.style.display = 'none';
        } else {
            if (tag) tag.textContent = `ROOM: ${roomId || 'Disconnected'}`;
            if (latency) {
                latency.textContent = `● Offline`;
                latency.style.color = 'var(--live-color)';
            }
            if (reconnectBtn) reconnectBtn.style.display = 'inline-block';
            if (connectCard) connectCard.style.display = 'block';
        }
    }

    updateRemoteCountUI() {
        const count = this.p2pConnections.length;
        const pillText = document.getElementById('p2p-pill-text');
        const statusEl = document.getElementById('connected-remotes-status');
        const p2pDot = document.getElementById('p2p-dot');

        if (pillText) pillText.textContent = `P2P: ${this.roomId || 'Ready'} (${count} 📱)`;
        if (statusEl) statusEl.textContent = `📱 ${count} Stage Remote(s) Connected`;
        if (p2pDot) {
            p2pDot.classList.toggle('offline', count === 0);
        }
    }

    broadcast(data) {
        this.localChannel.postMessage(data);
        this.p2pConnections.forEach(conn => {
            if (conn.open) {
                try {
                    conn.send(data);
                } catch (err) {
                    console.warn("Failed to send to peer:", err);
                }
            }
        });
    }

    dispatchMessage(data, source) {
        this.onMessageHandlers.forEach(h => h(data, source));
    }

    onMessage(handler) {
        this.onMessageHandlers.push(handler);
    }
}

const bus = new PresentationBus();
const navKeys = ['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'enter', ' ', 'escape', 'backspace', 'pagedown', 'pageup', 'v', 'c', 'b', 'p', 'e', 't', '.'];

// ==========================================================
// 4. PROJECTOR DISPLAY SCREEN ENGINE
// ==========================================================
if (isProjector) {
    document.title = "Projector Screen - VerseSurf";
    const projUI = document.getElementById('projector-ui');
    const projOverlay = document.getElementById('projector-overlay');
    const projBlackout = document.getElementById('projector-blackout');
    const projContent = document.getElementById('projector-content');
    let currentLiveState = null;

    async function applyProjectorTheme(data) {
        if (!data) return;
        const themeClass = data.theme || 'theme-dark';
        const layoutClass = data.layoutStyle || 'layout-center';
        
        if (themeClass === 'theme-custom') {
            projUI.className = `projector theme-custom ${layoutClass}`;
            projUI.style.backgroundColor = data.customBgColor || '#000000';
            if (data.customBg) {
                const resolvedBg = await resolveBackgroundUrl(data.customBg);
                projUI.style.backgroundImage = resolvedBg ? `url("${resolvedBg}")` : 'none';
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

        if (data.isBlackout) {
            projBlackout.classList.add('active');
        } else {
            projBlackout.classList.remove('active');
        }
    }

    function toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => console.warn(err));
        } else {
            document.exitFullscreen().catch(err => console.warn(err));
        }
    }

    bus.onMessage((data) => {
        if (!data) return;

        if (data.type === 'UPDATE_SLIDE') {
            currentLiveState = { index: data.liveIndex, songId: data.liveSongId, isBlackout: !!data.isBlackout };
            applyProjectorTheme(data);
            projContent.style.setProperty('--tune-w', (data.tuneW || 100) + 'vw');
            projContent.style.setProperty('--tune-x', (data.tuneX || 0) + 'vw');
            projContent.style.setProperty('--tune-y', (data.tuneY || 0) + 'vh');
            
            projContent.classList.remove('fade-animation');
            void projContent.offsetWidth;
            projContent.innerHTML = data.html || '';
            projContent.style.fontSize = data.fontSize || '5vw';
            projContent.classList.add('fade-animation');

        } else if (data.type === 'UPDATE_TUNE') {
            projContent.style.setProperty('--tune-w', (data.w || 100) + 'vw');
            projContent.style.setProperty('--tune-x', (data.x || 0) + 'vw');
            projContent.style.setProperty('--tune-y', (data.y || 0) + 'vh');

        } else if (data.type === 'CLEAR_SLIDE') {
            currentLiveState = null;
            projContent.innerHTML = '';
            applyProjectorTheme(data);

        } else if (data.type === 'SET_BLACKOUT') {
            if (data.blackout) projBlackout.classList.add('active');
            else projBlackout.classList.remove('active');

        } else if (data.type === 'DASHBOARD_BOOT') {
            if (currentLiveState) bus.broadcast({ type: 'PROJECTOR_SYNC', state: currentLiveState });
            else bus.broadcast({ type: 'PROJECTOR_READY' });
        }
    });

    bus.broadcast({ type: 'PROJECTOR_READY' });
    window.addEventListener('DOMContentLoaded', () => bus.broadcast({ type: 'PROJECTOR_READY' }));
    window.addEventListener('load', () => bus.broadcast({ type: 'PROJECTOR_READY' }));

    projUI.addEventListener('dblclick', toggleFullscreen);

    document.addEventListener('keydown', (e) => {
        const key = e.key.toLowerCase();
        if (key === 'f' || key === 'f11') {
            toggleFullscreen();
            e.preventDefault();
            return;
        }
        if (navKeys.includes(key) || (key >= '0' && key <= '9')) {
            bus.broadcast({ type: 'PROJECTOR_KEYPRESS', key });
            e.preventDefault();
        }
    });

} else if (isRemote) {
    // ==========================================================
    // 5. MOBILE STAGE REMOTE CONTROLLER ENGINE
    // ==========================================================
    document.title = "Stage Remote - VerseSurf";
    document.body.classList.add('remote-mode');
    document.documentElement.classList.add('is-remote');
    document.getElementById('mobile-remote-ui').style.display = 'flex';
    document.getElementById('dashboard-ui').style.display = 'none';

    const remoteSongSelect = document.getElementById('remote-song-select');
    const remotePrevSongBtn = document.getElementById('remote-prev-song-btn');
    const remoteNextSongBtn = document.getElementById('remote-next-song-btn');
    const remoteSlideIndicator = document.getElementById('remote-slide-indicator');
    const remoteLiveText = document.getElementById('remote-live-text');
    const remoteNextText = document.getElementById('remote-next-text');
    const remoteChipsBar = document.getElementById('remote-chips-bar');
    const remoteTimer = document.getElementById('remote-timer');
    const remoteBlackoutBtn = document.getElementById('remote-blackout-btn');
    const remoteRoomInput = document.getElementById('remote-room-input');
    const remoteConnectBtn = document.getElementById('remote-connect-btn');
    const remoteReconnectBtn = document.getElementById('remote-reconnect-btn');

    let timerSeconds = 0;
    setInterval(() => {
        timerSeconds++;
        const mins = String(Math.floor(timerSeconds / 60)).padStart(2, '0');
        const secs = String(timerSeconds % 60).padStart(2, '0');
        remoteTimer.textContent = `⏱️ ${mins}:${secs}`;
    }, 1000);

    function triggerHaptic() {
        if ('vibrate' in navigator) {
            try { navigator.vibrate(25); } catch(e){}
        }
    }

    document.getElementById('remote-prev-btn').onclick = () => { triggerHaptic(); bus.broadcast({ type: 'CMD_STEP_LIVE', direction: -1 }); };
    document.getElementById('remote-next-btn').onclick = () => { triggerHaptic(); bus.broadcast({ type: 'CMD_STEP_LIVE', direction: 1 }); };
    document.getElementById('remote-live-btn').onclick = () => { triggerHaptic(); bus.broadcast({ type: 'CMD_GO_LIVE' }); };
    document.getElementById('remote-clear-btn').onclick = () => { triggerHaptic(); bus.broadcast({ type: 'CMD_CLEAR_TEXT' }); };
    remoteBlackoutBtn.onclick = () => { triggerHaptic(); bus.broadcast({ type: 'CMD_TOGGLE_BLACKOUT' }); };

    if (remotePrevSongBtn) {
        remotePrevSongBtn.onclick = () => { triggerHaptic(); bus.broadcast({ type: 'CMD_PREV_SONG' }); };
    }
    if (remoteNextSongBtn) {
        remoteNextSongBtn.onclick = () => { triggerHaptic(); bus.broadcast({ type: 'CMD_NEXT_SONG' }); };
    }
    if (remoteSongSelect) {
        remoteSongSelect.onchange = () => {
            triggerHaptic();
            const songId = Number(remoteSongSelect.value);
            bus.broadcast({ type: 'CMD_SELECT_SONG', songId });
        };
    }

    const connectToRoomFromInput = () => {
        const val = remoteRoomInput.value.trim();
        if (val) {
            bus.connectToRoom(val);
        }
    };
    if (remoteConnectBtn) remoteConnectBtn.onclick = connectToRoomFromInput;
    if (remoteRoomInput) {
        remoteRoomInput.onkeydown = (e) => {
            if (e.key === 'Enter') connectToRoomFromInput();
        };
    }
    if (remoteReconnectBtn) {
        remoteReconnectBtn.onclick = () => {
            if (targetRoom) bus.connectToRoom(targetRoom);
            else {
                const card = document.getElementById('remote-connect-card');
                if (card) card.style.display = 'block';
            }
        };
    }

    document.getElementById('remote-exit-btn').onclick = () => {
        const url = new URL(window.location.href);
        url.searchParams.delete('mode');
        url.searchParams.delete('room');
        window.location.href = url.toString();
    };

    bus.onMessage((data) => {
        if (!data) return;

        if (data.type === 'SYNC_STATE' || data.type === 'UPDATE_SLIDE') {
            if (data.songList && remoteSongSelect) {
                remoteSongSelect.innerHTML = '';
                data.songList.forEach(s => {
                    const opt = document.createElement('option');
                    opt.value = s.id;
                    opt.textContent = `${s.index + 1}. ${s.title}${s.isLive ? ' 🔴' : ''}`;
                    if (s.isActive) opt.selected = true;
                    remoteSongSelect.appendChild(opt);
                });
            }

            if (data.isBlackout) {
                remoteSlideIndicator.textContent = "LIVE: Blackout";
                remoteLiveText.innerHTML = "<i>⬛ Display screen is in Blackout</i>";
                remoteBlackoutBtn.classList.add('active');
            } else if (data.liveSlide && data.liveSlide.html) {
                const slideLabel = data.liveSlide.label ? `[${data.liveSlide.label}]` : `Slide ${data.liveIndex + 1}`;
                remoteSlideIndicator.textContent = `LIVE: ${slideLabel} (${data.liveIndex + 1}/${data.totalSlides})`;
                remoteLiveText.innerHTML = data.liveSlide.html;
                remoteBlackoutBtn.classList.remove('active');
            } else {
                remoteSlideIndicator.textContent = "LIVE: Screen Clear";
                remoteLiveText.innerHTML = "<i>🚫 Screen text is clear</i>";
                remoteBlackoutBtn.classList.remove('active');
            }

            if (data.nextSlide) {
                const nextLabel = data.nextSlide.label ? `[${data.nextSlide.label}] ` : '';
                remoteNextText.innerHTML = `${nextLabel}${data.nextSlide.rawText ? escapeHTML(data.nextSlide.rawText.replace(/\n/g, ' ')) : '-'}`;
            } else {
                remoteNextText.textContent = '-';
            }

            if (data.sectionChips) {
                remoteChipsBar.innerHTML = '';
                data.sectionChips.forEach(chip => {
                    const btn = document.createElement('button');
                    btn.className = 'remote-chip-btn';
                    btn.textContent = chip.label;
                    btn.onclick = () => {
                        triggerHaptic();
                        bus.broadcast({ type: 'CMD_GO_LIVE', targetIndex: chip.index });
                    };
                    remoteChipsBar.appendChild(btn);
                });
            }
        } else if (data.type === 'CLEAR_SLIDE') {
            remoteSlideIndicator.textContent = "LIVE: Screen Clear";
            remoteLiveText.innerHTML = "<i>🚫 Screen text is clear</i>";
        } else if (data.type === 'SET_BLACKOUT') {
            remoteBlackoutBtn.classList.toggle('active', data.blackout);
            if (data.blackout) {
                remoteSlideIndicator.textContent = "LIVE: Blackout";
                remoteLiveText.innerHTML = "<i>⬛ Display screen is in Blackout</i>";
            }
        }
    });

    bus.broadcast({ type: 'REMOTE_REQUEST_SYNC' });

} else {
    // ==========================================================
    // 6. MAIN DASHBOARD OPERATOR STUDIO ENGINE
    // ==========================================================
    const editor = document.getElementById('lyric-editor');
    const slideList = document.getElementById('slide-list');
    const setlistContainer = document.getElementById('setlist-container');
    const songCountEl = document.getElementById('song-count');
    const themeSelect = document.getElementById('theme-select');
    const layoutSelect = document.getElementById('layout-select');
    const fontSizeSlider = document.getElementById('font-size-slider');

    const blackoutBtn = document.getElementById('blackout-btn');
    const clearScreenBtn = document.getElementById('clear-screen-btn');
    const castBtn = document.getElementById('cast-btn');
    const mobileModeBtn = document.getElementById('mobile-mode-btn');

    const customToolbar = document.getElementById('custom-theme-toolbar');
    const customTextColor = document.getElementById('custom-text-color');
    const customBgColor = document.getElementById('custom-bg-color');
    const toolbarThumb = document.getElementById('toolbar-thumb');
    const openMediaBinBtn = document.getElementById('open-media-bin-btn');
    const clearCustomBgBtn = document.getElementById('clear-custom-bg-btn');
    const dimBgCheckbox = document.getElementById('dim-bg-checkbox');

    const tuneToolbar = document.getElementById('tune-toolbar');
    const toggleTuneBtn = document.getElementById('toggle-tune-btn');
    const tuneW = document.getElementById('tune-w-slider');
    const tuneX = document.getElementById('tune-x-slider');
    const tuneY = document.getElementById('tune-y-slider');
    const tuneWVal = document.getElementById('tune-w-val');
    const tuneXVal = document.getElementById('tune-x-val');
    const tuneYVal = document.getElementById('tune-y-val');
    const resetTuneBtn = document.getElementById('reset-tune-btn');

    const pairingModal = document.getElementById('remote-pairing-modal');
    const closePairingBtn = document.getElementById('close-pairing-modal-btn');
    const qrcodeContainer = document.getElementById('qrcode-container');
    const copyRemoteLinkBtn = document.getElementById('copy-remote-link-btn');

    const modal = document.getElementById('media-bin-modal');
    const closeMediaBin = document.getElementById('close-media-bin');
    const localImageUpload = document.getElementById('local-image-upload');
    const localImageGrid = document.getElementById('local-image-grid');
    const onlineImgUrl = document.getElementById('online-img-url');
    const applyOnlineUrlBtn = document.getElementById('apply-online-url-btn');
    const urlValidationStatus = document.getElementById('url-validation-status');
    const searchInput = document.getElementById('search-input');
    const jumpHud = document.getElementById('jump-hud');
    const jumpHudNum = document.getElementById('jump-hud-num');

    // Undo delete toast elements (Stack-based for sequential undos)
    const undoToast = document.getElementById('undo-toast');
    const undoText = document.getElementById('undo-text');
    const undoBtn = document.getElementById('undo-btn');
    const deletedSongs = [];
    let undoTimeout = null;
    let debounceTimer = null;

    // Default Sunday Worship Sample Setlist (English)
    const defaultSundaySetlist = [
        {
            id: 1, theme: "theme-blue-wash", layoutStyle: "layout-center",
            tuneW: 100, tuneX: 0, tuneY: 0, fontSize: "5.5",
            customColor: "#ffffff", customBgColor: "#000000", customBg: "", dimBg: false,
            title: "崇拜宣召 / 靜默祈禱", lyrics: "崇拜宣召\n\n# Call to Worship\n普天下當向耶和華歡呼！\n當樂意事奉耶和華，當向他歌唱！\n\n# 靜默祈禱\n請安靜預備心，全心全意敬拜上帝\nPlease prepare your hearts for worship"
        },
        {
            id: 2, theme: "theme-traditional", layoutStyle: "layout-center",
            tuneW: 100, tuneX: 0, tuneY: 0, fontSize: "5",
            customColor: "#ffffff", customBgColor: "#000000", customBg: "", dimBg: false,
            title: "祢真偉大 (How Great Thou Art)", lyrics: "祢真偉大 (How Great Thou Art)\n\n# Verse 1\n主啊我神，我每逢舉目觀看\n(O Lord my God, when I in awesome wonder)\n祢手所造，一切奇妙大工\n(Consider all the worlds Thy hands have made)\n\n# Chorus\n我心神唱出，讚美祢歌聲\n(Then sings my soul, my Savior God, to Thee)\n何等偉大，何等偉大\n(How great Thou art, how great Thou art)\n\n# Verse 2\n當我想到，神竟不吝惜獨生子\n(And when I think that God, His Son not sparing)\n差祂受死，赦免我的罪孽\n(Sent Him to die, I scarce can take it in)\n\n# Ending\n何等偉大，何等偉大！\n(How great Thou art, how great Thou art!)"
        },
        {
            id: 3, theme: "theme-dark", layoutStyle: "layout-center",
            tuneW: 100, tuneX: 0, tuneY: 0, fontSize: "5",
            customColor: "#ffffff", customBgColor: "#000000", customBg: "", dimBg: false,
            title: "恩典之路 (The Path of Grace)", lyrics: "恩典之路\n\n# Verse 1\n祢是我的主，引導我走義路\n高山或低谷，祢都與我同在\n\n# Chorus\n一步又一步，這是恩典之路\n祢愛、祢手將我緊緊抓住\n\n# Bridge\n光明照射在黑暗之處\n祢是我一生的祝福"
        },
        {
            id: 4, theme: "theme-scripture", layoutStyle: "layout-top-left",
            tuneW: 75, tuneX: 0, tuneY: 0, fontSize: "4.5",
            customColor: "#ffffff", customBgColor: "#000000", customBg: "", dimBg: false,
            title: "啟應經文：詩篇 23:1-6", lyrics: "啟應經文：詩篇 23:1-6\n\n# rolling 2\n> 詩篇 23:1-6 (啟應經文)\n【啟】耶和華是我的牧者，我必不致缺乏。\n【應】他使我躺臥在青草地上，領我在可安歇的水邊。\n【啟】他使我的靈魂甦醒，為自己的名引導我走義路。\n【應】我雖然行過死蔭的幽谷，也不怕遭害，因為你與我同在；你的杖，你的竿，都安慰我。\n【啟】在我敵人面前，你為我擺設筵席；你用油膏了我的頭，使我的福杯滿溢。\n【眾】我一生一世必有恩惠慈愛隨著我；我且要住在耶和華的殿中，直到永遠。"
        },
        {
            id: 5, theme: "theme-dark", layoutStyle: "layout-center",
            tuneW: 100, tuneX: 0, tuneY: 0, fontSize: "5",
            customColor: "#ffffff", customBgColor: "#000000", customBg: "", dimBg: false,
            title: "堂會消息 / 家事報告", lyrics: "堂會消息\n\n# 報告 1\n週五青年團契聚會\n時間：本週五晚上 7:30\n地點：副堂 (歡迎全體青年參加)\n\n# 報告 2\n主日崇拜奉獻提醒\n支持教會宣教及各項事工發展\n願神賜福甘心樂意奉獻的人"
        }
    ];

    let setlist = [];
    let slides = [];
    let previewIndex = 0;
    let cachedBgUrl = '';

    // Live Engine State
    let liveIndex = -1;
    let liveSongId = null;
    let liveSlides = [];
    let liveCachedBgUrl = '';
    let isBlackout = false;

    function sanitizeSetlist(list) {
        if (!Array.isArray(list) || list.length === 0) return [];
        const seenIds = new Set();
        return list.map((song, idx) => {
            let validId = (!isNaN(Number(song.id)) && song.id !== null && song.id !== undefined && song.id !== '') ? Number(song.id) : (Date.now() + idx);
            while (seenIds.has(validId)) {
                validId = Date.now() + Math.floor(Math.random() * 10000) + idx;
            }
            seenIds.add(validId);
            return {
                id: validId,
                theme: song.theme || "theme-dark",
                layoutStyle: song.layoutStyle || "layout-center",
                tuneW: song.tuneW !== undefined ? Number(song.tuneW) : 100,
                tuneX: song.tuneX !== undefined ? Number(song.tuneX) : 0,
                tuneY: song.tuneY !== undefined ? Number(song.tuneY) : 0,
                fontSize: String(song.fontSize || "5"),
                customColor: song.customColor || "#ffffff",
                customBgColor: song.customBgColor || "#000000",
                customBg: song.customBg || "",
                dimBg: !!song.dimBg,
                title: song.title || "Untitled",
                lyrics: song.lyrics || "Untitled\n\n# Verse 1\n"
            };
        });
    }

    try {
        // Updated LocalStorage keys
        const storedData = localStorage.getItem('versesurf_setlist');
        if (!storedData) {
            setlist = sanitizeSetlist(defaultSundaySetlist);
        } else {
            setlist = sanitizeSetlist(JSON.parse(storedData));
        }
    } catch (e) {
        console.error("Corrupted setlist detected:", e);
        const recoveryUI = document.getElementById('recovery-ui');
        const dashboardUI = document.getElementById('dashboard-ui');
        if (dashboardUI) dashboardUI.style.display = 'none';
        if (recoveryUI) recoveryUI.classList.remove('hidden');

        const emResetBtn = document.getElementById('emergency-reset-btn');
        if (emResetBtn) {
            emResetBtn.onclick = () => {
                localStorage.removeItem('versesurf_setlist');
                localStorage.removeItem('versesurf_active_song');
                window.location.reload();
            };
        }

        const emImportBtn = document.getElementById('emergency-import-btn');
        const emImportFile = document.getElementById('emergency-import-file');
        if (emImportBtn && emImportFile) {
            emImportBtn.onclick = () => {
                emImportFile.value = '';
                emImportFile.click();
            };
            emImportFile.onchange = (ev) => {
                const file = ev.target.files && ev.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (fileEv) => {
                    try {
                        const imported = JSON.parse(fileEv.target.result);
                        if (Array.isArray(imported) && imported.length > 0) {
                            localStorage.setItem('versesurf_setlist', JSON.stringify(sanitizeSetlist(imported)));
                            window.location.reload();
                        }
                    } catch (err) {
                        alert("Invalid backup file format.");
                    }
                };
                reader.readAsText(file);
            };
        }

        throw new Error("Boot halted due to corrupted localStorage data.");
    }

    if (!setlist || setlist.length === 0) setlist = sanitizeSetlist(defaultSundaySetlist);

    const storedActiveId = Number(localStorage.getItem('versesurf_active_song'));
    let activeSongId = setlist.some(s => Number(s.id) === storedActiveId) ? storedActiveId : setlist[0]?.id;

    function getActiveSong() {
        return setlist.find(s => Number(s.id) === Number(activeSongId)) || setlist[0];
    }

    function saveSetlist() {
        try {
            localStorage.setItem('versesurf_setlist', JSON.stringify(setlist));
            localStorage.setItem('versesurf_active_song', String(activeSongId));
        } catch (e) {
            console.error("Storage full:", e);
        }
    }

    async function updateCachedBg() {
        const activeSong = getActiveSong();
        cachedBgUrl = activeSong ? await resolveBackgroundUrl(activeSong.customBg) : '';
    }

    function getSyncStatePayload() {
        const activeSong = getActiveSong();
        const liveSong = (liveSongId !== null) ? setlist.find(s => Number(s.id) === Number(liveSongId)) : activeSong;

        const liveSlide = (liveIndex !== -1 && liveSlides[liveIndex]) ? {
            label: liveSlides[liveIndex].label,
            html: formatContent(liveSlides[liveIndex].content),
            rawText: liveSlides[liveIndex].content
        } : null;

        const nextSlide = slides[previewIndex] ? {
            label: slides[previewIndex].label,
            html: formatContent(slides[previewIndex].content),
            rawText: slides[previewIndex].content
        } : null;

        const sectionChips = slides.filter(s => s.label).map(s => ({
            label: s.label,
            index: slides.indexOf(s)
        }));

        const songList = setlist.map((s, idx) => ({
            id: s.id,
            index: idx,
            title: s.title || "Untitled",
            isActive: Number(s.id) === Number(activeSongId),
            isLive: Number(s.id) === Number(liveSongId)
        }));

        return {
            type: 'SYNC_STATE',
            roomCode: bus.roomId,
            songTitle: activeSong ? activeSong.title : "Untitled",
            songId: activeSong ? activeSong.id : 0,
            liveSongTitle: liveSong ? liveSong.title : (activeSong ? activeSong.title : "Untitled"),
            liveSongId,
            liveIndex,
            previewIndex,
            liveSlide,
            nextSlide,
            sectionChips,
            songList,
            isBlackout,
            totalSlides: (liveIndex !== -1 && liveSlides.length > 0) ? liveSlides.length : slides.length
        };
    }

    window.syncFullStateToRemote = function(conn) {
        if (conn && conn.open) {
            try {
                conn.send(getSyncStatePayload());
            } catch (err) {
                console.warn("Failed to sync state to peer:", err);
            }
        }
    };

    function broadcastState() {
        bus.broadcast(getSyncStatePayload());
    }

    function showUndoToast(song, index) {
        deletedSongs.push({ song, index });
        if (!undoToast) return;
        
        if (undoText) undoText.textContent = `Deleted "${song.title || 'Untitled'}".`;
        undoToast.style.display = 'flex';
        clearTimeout(undoTimeout);
        undoTimeout = setTimeout(() => {
            if (undoToast) undoToast.style.display = 'none';
            deletedSongs.length = 0;
        }, 6000);
    }

    if (undoBtn) {
        undoBtn.onclick = () => {
            if (deletedSongs.length === 0) return;
            const lastDeleted = deletedSongs.pop();
            const { song: restoredSong, index: restoredIndex } = lastDeleted;

            if (setlist.length === 1 && (!setlist[0].title || setlist[0].title === 'Untitled') && (!setlist[0].lyrics || setlist[0].lyrics === 'Untitled\n\n# Verse 1\n')) {
                setlist = [];
            }

            const insertIdx = Math.min(restoredIndex !== null && restoredIndex !== undefined ? restoredIndex : setlist.length, setlist.length);
            setlist.splice(insertIdx, 0, restoredSong);
            saveSetlist();
            renderSetlist();
            loadSong(restoredSong.id);

            if (deletedSongs.length > 0) {
                const nextItem = deletedSongs[deletedSongs.length - 1];
                if (undoText) undoText.textContent = `Deleted "${nextItem.song.title || 'Untitled'}".`;
                clearTimeout(undoTimeout);
                undoTimeout = setTimeout(() => {
                    if (undoToast) undoToast.style.display = 'none';
                    deletedSongs.length = 0;
                }, 6000);
            } else {
                if (undoToast) undoToast.style.display = 'none';
                clearTimeout(undoTimeout);
            }
        };
    }

    // ==========================================
    // Setlist Reordering & Drag-and-Drop
    // ==========================================
    let draggedIndex = null;
    let isDragging = false;
    let dragJustEnded = false;

    function reorderSetlist(fromIndex, toIndex, position) {
        if (fromIndex === null || fromIndex === undefined) return;
        if (fromIndex < 0 || fromIndex >= setlist.length) return;
        if (toIndex < 0 || toIndex >= setlist.length) return;
        if (fromIndex === toIndex && (position === 'top' ? fromIndex === 0 : fromIndex === setlist.length - 1)) return;

        const item = setlist.splice(fromIndex, 1)[0];
        let insertIdx = (fromIndex > toIndex) ? toIndex : (toIndex - 1);
        if (position === 'bottom') {
            insertIdx += 1;
        }
        insertIdx = Math.max(0, Math.min(insertIdx, setlist.length));
        setlist.splice(insertIdx, 0, item);
        
        saveSetlist();
        renderSetlist();
        broadcastState();
    }

    function renderSetlist() {
        setlistContainer.innerHTML = '';
        songCountEl.textContent = setlist.length;
        const query = searchInput ? searchInput.value.toLowerCase().trim() : '';

        setlist.forEach((song, index) => {
            const el = document.createElement('div');
            const isActive = Number(song.id) === Number(activeSongId);
            const isLive = Number(song.id) === Number(liveSongId);
            el.className = `song-item ${isActive ? 'active' : ''} ${isLive ? 'is-live' : ''}`;
            el.dataset.index = index;
            el.dataset.songId = song.id;
            el.draggable = true;
            
            const handle = document.createElement('span');
            handle.className = 'drag-handle';
            handle.innerHTML = '⋮⋮';
            handle.title = 'Drag to reorder';

            const titleSpan = document.createElement('span');
            titleSpan.className = 'song-title-text';
            titleSpan.textContent = `${index + 1}. ${song.title || "Untitled"}`;
            titleSpan.style.flex = '1';
            titleSpan.style.overflow = 'hidden';
            titleSpan.style.textOverflow = 'ellipsis';
            titleSpan.style.whiteSpace = 'nowrap';
            titleSpan.style.pointerEvents = 'none';

            const liveBadge = document.createElement('span');
            liveBadge.textContent = 'LIVE';
            liveBadge.className = 'sidebar-live-badge';
            liveBadge.style.pointerEvents = 'none';

            const delBtn = document.createElement('button');
            delBtn.className = 'delete-btn';
            delBtn.innerHTML = '×';
            delBtn.title = "Delete Song";
            delBtn.onclick = (e) => {
                e.stopPropagation();
                if (Number(song.id) === Number(liveSongId)) {
                    alert("⚠️ This song is currently live on screen. Clear text (Esc) before deleting.");
                    return;
                }
                const songToDelete = song;
                const deleteIndex = index;
                setlist = setlist.filter(s => Number(s.id) !== Number(song.id));
                if (setlist.length === 0) setlist = sanitizeSetlist([{}]);
                
                showUndoToast(songToDelete, deleteIndex);
                if (Number(activeSongId) === Number(song.id)) {
                    const nextActive = setlist[Math.min(deleteIndex, setlist.length - 1)];
                    loadSong(nextActive.id);
                } else {
                    saveSetlist();
                    renderSetlist();
                    broadcastState();
                }
            };

            // HTML5 Drag & Drop Reordering
            el.addEventListener('dragstart', (e) => {
                draggedIndex = index;
                isDragging = true;
                dragJustEnded = false;
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', String(index));
                el.classList.add('dragging');
            });

            el.addEventListener('dragend', () => {
                el.classList.remove('dragging');
                document.querySelectorAll('.song-item').forEach(i => i.classList.remove('drag-over-top', 'drag-over-bottom'));
                isDragging = false;
                dragJustEnded = true;
                setTimeout(() => { dragJustEnded = false; }, 200);
            });

            el.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                if (draggedIndex === null || draggedIndex === index) return;
                
                const rect = el.getBoundingClientRect();
                const isBottom = e.clientY > (rect.top + rect.height / 2);
                if (isBottom) {
                    el.classList.remove('drag-over-top');
                    el.classList.add('drag-over-bottom');
                } else {
                    el.classList.remove('drag-over-bottom');
                    el.classList.add('drag-over-top');
                }
            });

            el.addEventListener('dragleave', () => {
                el.classList.remove('drag-over-top', 'drag-over-bottom');
            });

            el.addEventListener('drop', (e) => {
                e.preventDefault();
                e.stopPropagation();
                el.classList.remove('drag-over-top', 'drag-over-bottom');
                if (draggedIndex === null || draggedIndex === index) return;
                
                const rect = el.getBoundingClientRect();
                const isBottom = e.clientY > (rect.top + rect.height / 2);
                reorderSetlist(draggedIndex, index, isBottom ? 'bottom' : 'top');
                draggedIndex = null;
            });

            // Touch Screen Drag Support on Drag Handle
            handle.addEventListener('touchstart', (e) => {
                if (e.touches.length !== 1) return;
                draggedIndex = index;
                el.classList.add('dragging');
                isDragging = true;
            }, { passive: true });

            handle.addEventListener('touchmove', (e) => {
                if (draggedIndex === null || !e.touches[0]) return;
                e.preventDefault();
                const touchY = e.touches[0].clientY;
                const touchX = e.touches[0].clientX;
                const elements = document.elementsFromPoint(touchX, touchY);
                const target = elements ? elements.find(elem => elem.classList && elem.classList.contains('song-item') && elem !== el) : null;
                
                document.querySelectorAll('.song-item').forEach(i => i.classList.remove('drag-over-top', 'drag-over-bottom'));
                if (target) {
                    const rect = target.getBoundingClientRect();
                    const isBottom = touchY > (rect.top + rect.height / 2);
                    if (isBottom) target.classList.add('drag-over-bottom');
                    else target.classList.add('drag-over-top');
                }
            }, { passive: false });

            handle.addEventListener('touchend', (e) => {
                if (draggedIndex === null) return;
                el.classList.remove('dragging');
                
                const changedTouch = e.changedTouches ? e.changedTouches[0] : null;
                if (changedTouch) {
                    const elements = document.elementsFromPoint(changedTouch.clientX, changedTouch.clientY);
                    const target = elements ? elements.find(elem => elem.classList && elem.classList.contains('song-item') && elem !== el) : null;
                    if (target) {
                        const targetIdx = Number(target.dataset.index);
                        const rect = target.getBoundingClientRect();
                        const isBottom = changedTouch.clientY > (rect.top + rect.height / 2);
                        target.classList.remove('drag-over-top', 'drag-over-bottom');
                        reorderSetlist(draggedIndex, targetIdx, isBottom ? 'bottom' : 'top');
                    }
                }
                
                document.querySelectorAll('.song-item').forEach(i => i.classList.remove('drag-over-top', 'drag-over-bottom'));
                draggedIndex = null;
                isDragging = false;
                dragJustEnded = true;
                setTimeout(() => { dragJustEnded = false; }, 200);
            });

            handle.addEventListener('touchcancel', () => {
                el.classList.remove('dragging');
                document.querySelectorAll('.song-item').forEach(i => i.classList.remove('drag-over-top', 'drag-over-bottom'));
                draggedIndex = null;
                isDragging = false;
            });

            el.onclick = () => {
                if (isDragging || dragJustEnded) return;
                loadSong(song.id);
            };

            el.appendChild(handle);
            el.appendChild(titleSpan);
            el.appendChild(liveBadge);
            el.appendChild(delBtn);

            if (query) {
                const matches = (song.title || '').toLowerCase().includes(query) || (song.lyrics || '').toLowerCase().includes(query);
                el.style.display = matches ? 'flex' : 'none';
            }

            setlistContainer.appendChild(el);
        });

        updateSelection();
    }

    setlistContainer.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    });

    setlistContainer.addEventListener('drop', (e) => {
        if (e.target === setlistContainer && draggedIndex !== null) {
            e.preventDefault();
            reorderSetlist(draggedIndex, setlist.length - 1, 'bottom');
            draggedIndex = null;
        }
    });

    async function loadSong(id) {
        if (debounceTimer) clearTimeout(debounceTimer);
        activeSongId = Number(id);
        saveSetlist();
        const song = getActiveSong();
        if (!song) return;

        editor.value = song.lyrics || '';
        themeSelect.value = song.theme || 'theme-dark';
        layoutSelect.value = song.layoutStyle || 'layout-center';
        fontSizeSlider.value = song.fontSize || '5';
        previewIndex = 0;

        await updateCachedBg();
        updateCustomToolbarUI();
        updateTuneUI();
        parseText();
        broadcastState();
    }

    function updateCustomToolbarUI() {
        const song = getActiveSong();
        if (song && song.theme === 'theme-custom') {
            customToolbar.classList.add('show-toolbar');
            customTextColor.value = song.customColor || "#ffffff";
            customBgColor.value = song.customBgColor || "#000000";
            dimBgCheckbox.checked = !!song.dimBg;
            if (song.customBg) {
                toolbarThumb.style.backgroundImage = `url('${cachedBgUrl}')`;
                toolbarThumb.style.display = 'block';
                clearCustomBgBtn.style.display = 'inline-block';
            } else {
                toolbarThumb.style.display = 'none';
                clearCustomBgBtn.style.display = 'none';
            }
        } else {
            customToolbar.classList.remove('show-toolbar'); 
        }
    }

    function updateTuneUI() {
        const activeSong = getActiveSong();
        if (!activeSong) return;
        tuneW.value = activeSong.tuneW;
        tuneX.value = activeSong.tuneX;
        tuneY.value = activeSong.tuneY;
        tuneWVal.textContent = tuneW.value + 'vw';
        tuneXVal.textContent = tuneX.value + 'vw';
        tuneYVal.textContent = tuneY.value + 'vh';
    }

    function parseText() {
        const text = (editor.value || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        const lines = text.split('\n');
        const firstLine = (lines[0] || '').trim();
        const activeSong = getActiveSong();
        if (!activeSong) return;
        
        const cleanTitle = firstLine.startsWith('#') ? firstLine.replace(/^#+\s*/, '').trim() : firstLine;
        activeSong.title = cleanTitle || "Untitled";
        activeSong.lyrics = text;
        saveSetlist();

        const targetItem = setlistContainer.querySelector(`.song-item[data-song-id="${activeSong.id}"] .song-title-text`);
        if (targetItem) {
            const curIdx = setlist.findIndex(s => Number(s.id) === Number(activeSong.id));
            targetItem.textContent = `${curIdx + 1}. ${activeSong.title}`;
        }

        slides = parseTextToSlides(text);
        
        if (Number(activeSong.id) === Number(liveSongId)) {
            liveSlides = [...slides];
            if (liveIndex >= liveSlides.length) liveIndex = Math.max(0, liveSlides.length - 1);
            
            if (liveIndex !== -1 && liveSlides[liveIndex]) {
                const slide = liveSlides[liveIndex];
                bus.broadcast({ 
                    type: 'UPDATE_SLIDE',
                    liveIndex,
                    liveSongId,
                    html: formatContent(slide.content), 
                    theme: activeSong.theme,
                    layoutStyle: activeSong.layoutStyle,
                    fontSize: (activeSong.fontSize || '5') + 'vw',
                    customColor: activeSong.customColor,
                    customBgColor: activeSong.customBgColor,
                    customBg: liveCachedBgUrl,
                    dimBg: activeSong.dimBg,
                    tuneW: activeSong.tuneW,
                    tuneX: activeSong.tuneX,
                    tuneY: activeSong.tuneY,
                    isBlackout
                });
            }
        }

        renderSlideList();
        broadcastState();
    }

    function renderQuickJumpBar() {
        const jumpBar = document.getElementById('quick-jump-bar');
        jumpBar.innerHTML = '';
        const sectionSlides = slides.filter(s => s.label);
        if (sectionSlides.length === 0) {
            jumpBar.style.display = 'none';
            return;
        }

        jumpBar.style.display = 'flex';
        sectionSlides.forEach(slide => {
            const btn = document.createElement('button');
            btn.className = 'jump-btn';
            const labelLower = slide.label.toLowerCase();
            if (labelLower.includes('verse') || labelLower.startsWith('v')) btn.classList.add('tag-verse');
            else if (labelLower.includes('chorus') || labelLower.startsWith('c') || labelLower.includes('refrain')) btn.classList.add('tag-chorus');
            else if (labelLower.includes('bridge') || labelLower.startsWith('b')) btn.classList.add('tag-bridge');
            else if (labelLower.includes('pre')) btn.classList.add('tag-pre');
            else if (labelLower.includes('end') || labelLower.includes('outro') || labelLower.includes('coda')) btn.classList.add('tag-ending');

            btn.textContent = slide.label;
            btn.onclick = () => {
                const targetIdx = slides.indexOf(slide);
                if (targetIdx !== -1) { previewIndex = targetIdx; updateSelection(); broadcastState(); }
            };
            btn.ondblclick = () => {
                const targetIdx = slides.indexOf(slide);
                if (targetIdx !== -1) goLive(targetIdx);
            };
            jumpBar.appendChild(btn);
        });
    }

    function renderSlideList() {
        slideList.innerHTML = '';
        slides.forEach((slide, index) => {
            const el = document.createElement('div');
            el.className = 'slide-card';
            
            let innerHTML = `<div class="status-badge">LIVE</div>`;
            if (slide.label) innerHTML += `<div class="slide-label">${escapeHTML(slide.label)}</div>`;
            innerHTML += `<div class="slide-content">${formatContent(slide.content)}</div>`;
            
            el.innerHTML = innerHTML;
            el.onclick = () => { previewIndex = index; updateSelection(); broadcastState(); };
            el.ondblclick = () => goLive(index);
            slideList.appendChild(el);
        });
        
        renderQuickJumpBar();
        updateSelection(); 
    }

    function updateSelection() {
        Array.from(slideList.children).forEach((el, index) => {
            el.classList.toggle('preview', index === previewIndex);
            el.classList.toggle('live', index === liveIndex && Number(activeSongId) === Number(liveSongId));
        });
        
        Array.from(setlistContainer.children).forEach((el, index) => {
            const song = setlist[index];
            if (!song) return;
            const isActive = Number(song.id) === Number(activeSongId);
            const isLive = Number(song.id) === Number(liveSongId);
            el.className = `song-item ${isActive ? 'active' : ''} ${isLive ? 'is-live' : ''}`;
            
            const titleSpan = el.querySelector('.song-title-text');
            if (titleSpan) {
                titleSpan.textContent = `${index + 1}. ${song.title || "Untitled"}`;
            }
        });

        const activeEl = slideList.children[previewIndex];
        if (activeEl) activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        
        const activeSetlistItem = setlistContainer.querySelector('.song-item.active');
        if (activeSetlistItem) {
            activeSetlistItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }

    function goLive(index) {
        liveIndex = index;
        previewIndex = index;
        liveSongId = Number(activeSongId);
        liveSlides = [...slides];
        const activeSong = getActiveSong();
        liveCachedBgUrl = cachedBgUrl; 
        isBlackout = false;
        blackoutBtn.classList.remove('active');

        updateSelection();
        const slide = liveSlides[liveIndex];
        if (!slide || !activeSong) return;

        bus.broadcast({ 
            type: 'UPDATE_SLIDE',
            liveIndex,
            liveSongId,
            html: formatContent(slide.content), 
            theme: activeSong.theme,
            layoutStyle: activeSong.layoutStyle,
            fontSize: (activeSong.fontSize || '5') + 'vw',
            customColor: activeSong.customColor,
            customBgColor: activeSong.customBgColor,
            customBg: liveCachedBgUrl,
            dimBg: activeSong.dimBg,
            tuneW: activeSong.tuneW,
            tuneX: activeSong.tuneX,
            tuneY: activeSong.tuneY,
            isBlackout: false
        });

        broadcastState();
    }

    function stepLive(direction) {
        if (liveIndex === -1) {
            if (slides.length > 0) goLive(previewIndex >= 0 ? previewIndex : 0);
            return;
        }
        const newIndex = liveIndex + direction;
        if (newIndex < 0 || newIndex >= liveSlides.length) return;

        liveIndex = newIndex;
        if (Number(activeSongId) === Number(liveSongId)) previewIndex = liveIndex;
        updateSelection();

        const slide = liveSlides[liveIndex];
        const liveSong = setlist.find(s => Number(s.id) === Number(liveSongId)) || getActiveSong();
        if (!liveSong || !slide) return;

        bus.broadcast({ 
            type: 'UPDATE_SLIDE',
            liveIndex,
            liveSongId,
            html: formatContent(slide.content), 
            theme: liveSong.theme,
            layoutStyle: liveSong.layoutStyle,
            fontSize: (liveSong.fontSize || '5') + 'vw',
            customColor: liveSong.customColor,
            customBgColor: liveSong.customBgColor,
            customBg: liveCachedBgUrl, 
            dimBg: liveSong.dimBg,
            tuneW: liveSong.tuneW,
            tuneX: liveSong.tuneX,
            tuneY: liveSong.tuneY,
            isBlackout
        });

        broadcastState();
    }

    function toggleBlackout() {
        isBlackout = !isBlackout;
        blackoutBtn.classList.toggle('active', isBlackout);
        bus.broadcast({ type: 'SET_BLACKOUT', blackout: isBlackout });
        broadcastState();
    }

    function clearScreen() {
        if (liveSongId === null && !isBlackout) return;
        const liveSong = setlist.find(s => Number(s.id) === Number(liveSongId)) || getActiveSong();
        isBlackout = false;
        blackoutBtn.classList.remove('active');

        bus.broadcast({ 
            type: 'CLEAR_SLIDE',
            theme: liveSong ? liveSong.theme : 'theme-dark',
            layoutStyle: liveSong ? liveSong.layoutStyle : 'layout-center',
            customColor: liveSong ? liveSong.customColor : '#ffffff',
            customBgColor: liveSong ? liveSong.customBgColor : '#000000',
            customBg: liveCachedBgUrl,
            dimBg: liveSong ? liveSong.dimBg : false,
            isBlackout: false
        });

        liveIndex = -1;
        liveSongId = null;
        liveSlides = [];
        liveCachedBgUrl = '';
        updateSelection();
        broadcastState();
    }

    function jumpToSection(keywords) {
        const searchTerms = Array.isArray(keywords) ? keywords : [keywords];
        const matches = [];
        slides.forEach((s, idx) => {
            const labelLower = (s.label || '').toLowerCase();
            if (searchTerms.some(term => labelLower.startsWith(term) || labelLower === term)) {
                matches.push(idx);
            }
        });

        if (matches.length > 0) {
            let nextIdx = matches.find(idx => idx > previewIndex);
            if (nextIdx === undefined) nextIdx = matches[0];
            previewIndex = nextIdx;
            updateSelection();
            broadcastState();
        }
    }

    // --- MULTI-DIGIT BUFFER ENGINE ---
    let numberBuffer = '';
    let numberTimeout = null;

    function executeNumericJump(numStr) {
        jumpHud.style.display = 'none';
        numberBuffer = '';
        
        let idx = slides.findIndex(s => (s.label || '').trim() === numStr);
        if (idx === -1) idx = slides.findIndex(s => (s.label || '').toLowerCase() === `verse ${numStr}` || (s.label || '').toLowerCase() === `v${numStr}`);
        
        if (idx === -1) {
            const slideNum = parseInt(numStr, 10) - 1;
            if (slideNum >= 0 && slideNum < slides.length) idx = slideNum;
        }

        if (idx !== -1) {
            previewIndex = idx;
            updateSelection();
            broadcastState();
        }
    }

    function handleNavigationKey(key) {
        if (key >= '0' && key <= '9') {
            numberBuffer += key;
            jumpHudNum.textContent = numberBuffer;
            jumpHud.style.display = 'inline-flex';
            clearTimeout(numberTimeout);
            numberTimeout = setTimeout(() => {
                executeNumericJump(numberBuffer);
            }, 400);
            return;
        }

        if (numberBuffer) {
            if (key === 'enter') {
                clearTimeout(numberTimeout);
                executeNumericJump(numberBuffer);
                return;
            }
            if (key === 'escape' || key === 'backspace') {
                clearTimeout(numberTimeout);
                numberBuffer = '';
                jumpHud.style.display = 'none';
                return;
            }
        }

        if (key === 'arrowup') { previewIndex = Math.max(0, previewIndex - 1); updateSelection(); broadcastState(); }
        if (key === 'arrowdown') { previewIndex = Math.min(slides.length - 1, previewIndex + 1); updateSelection(); broadcastState(); }

        if (key === 'pagedown') {
            const curIdx = setlist.findIndex(s => Number(s.id) === Number(activeSongId));
            if (curIdx < setlist.length - 1) loadSong(setlist[curIdx + 1].id);
        }
        if (key === 'pageup') {
            const curIdx = setlist.findIndex(s => Number(s.id) === Number(activeSongId));
            if (curIdx > 0) loadSong(setlist[curIdx - 1].id);
        }

        if (key === 'v') jumpToSection(['verse', 'v']);
        if (key === 'c') jumpToSection(['chorus', 'c', 'refrain']);
        if (key === 'b') jumpToSection(['bridge', 'b']);
        if (key === 'p') jumpToSection(['pre', 'p-c', 'pre-chorus']);
        if (key === 'e') jumpToSection(['ending', 'outro', 'coda', 'e']);
        if (key === 't') jumpToSection(['intro', 'tag', 'title', 't']);

        if (key === 'enter') {
            if (slides.length > 0 && previewIndex >= 0 && previewIndex < slides.length) goLive(previewIndex);
        }

        if (key === ' ' || key === 'arrowright') stepLive(1);
        if (key === 'arrowleft') stepLive(-1);
        if (key === 'escape' || key === 'backspace') clearScreen();
        if (key === '.') toggleBlackout();
    }

    bus.onMessage((data) => {
        if (!data) return;
        
        if (data.type === 'PROJECTOR_READY') {
            if (liveIndex !== -1 && liveSongId !== null) {
                const liveSong = setlist.find(s => Number(s.id) === Number(liveSongId)) || getActiveSong();
                if (liveSong && liveSlides[liveIndex]) {
                    bus.broadcast({ 
                        type: 'UPDATE_SLIDE',
                        liveIndex,
                        liveSongId,
                        html: formatContent(liveSlides[liveIndex].content), 
                        theme: liveSong.theme,
                        layoutStyle: liveSong.layoutStyle,
                        fontSize: (liveSong.fontSize || '5') + 'vw',
                        customColor: liveSong.customColor,
                        customBgColor: liveSong.customBgColor,
                        customBg: liveCachedBgUrl, 
                        dimBg: liveSong.dimBg,
                        tuneW: liveSong.tuneW,
                        tuneX: liveSong.tuneX,
                        tuneY: liveSong.tuneY,
                        isBlackout
                    });
                }
            } else {
                const activeSong = getActiveSong();
                bus.broadcast({ 
                    type: 'CLEAR_SLIDE',
                    theme: activeSong ? activeSong.theme : 'theme-dark',
                    layoutStyle: activeSong ? activeSong.layoutStyle : 'layout-center',
                    customColor: activeSong ? activeSong.customColor : '#ffffff',
                    customBgColor: activeSong ? activeSong.customBgColor : '#000000',
                    customBg: cachedBgUrl, 
                    dimBg: activeSong ? activeSong.dimBg : false,
                    isBlackout: false
                });
            }
        }
        else if (data.type === 'REMOTE_JOINED' || data.type === 'REMOTE_REQUEST_SYNC') {
            broadcastState();
        }
        else if (data.type === 'CMD_STEP_LIVE') stepLive(data.direction);
        else if (data.type === 'CMD_GO_LIVE') goLive(data.targetIndex !== undefined ? data.targetIndex : previewIndex);
        else if (data.type === 'CMD_CLEAR_TEXT') clearScreen();
        else if (data.type === 'CMD_TOGGLE_BLACKOUT') toggleBlackout();
        else if (data.type === 'CMD_SELECT_SONG') {
            if (data.songId && setlist.some(s => Number(s.id) === Number(data.songId))) {
                loadSong(Number(data.songId));
            }
        }
        else if (data.type === 'CMD_PREV_SONG') {
            const curIdx = setlist.findIndex(s => Number(s.id) === Number(activeSongId));
            if (curIdx > 0) loadSong(setlist[curIdx - 1].id);
        }
        else if (data.type === 'CMD_NEXT_SONG') {
            const curIdx = setlist.findIndex(s => Number(s.id) === Number(activeSongId));
            if (curIdx < setlist.length - 1) loadSong(setlist[curIdx + 1].id);
        }
        else if (data.type === 'PROJECTOR_KEYPRESS') handleNavigationKey(data.key);
    });

    window.addEventListener('click', (e) => {
        if (e.target === pairingModal) pairingModal.style.display = 'none';
        if (e.target === modal) modal.style.display = 'none';
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            let modalClosed = false;
            if (pairingModal && pairingModal.style.display === 'flex') {
                pairingModal.style.display = 'none';
                modalClosed = true;
            }
            if (modal && modal.style.display === 'flex') {
                modal.style.display = 'none';
                modalClosed = true;
            }
            if (modalClosed) {
                e.preventDefault();
                return;
            }
        }

        const active = document.activeElement;
        const isInput = active && (['INPUT', 'TEXTAREA', 'SELECT'].includes(active.tagName) || active.isContentEditable);
        if (isInput) return;

        const key = e.key.toLowerCase();
        if (navKeys.includes(key) || (key >= '0' && key <= '9')) {
            e.preventDefault();
            handleNavigationKey(key);
        }
    });

    document.querySelectorAll('.quick-tag-btn').forEach(btn => {
        btn.onclick = () => {
            const tag = btn.dataset.tag;
            const start = editor.selectionStart;
            const end = editor.selectionEnd;
            const val = editor.value;
            editor.value = val.substring(0, start) + `\n\n${tag}\n` + val.substring(end);
            editor.focus();
            const newCursor = start + tag.length + 3;
            try { editor.setSelectionRange(newCursor, newCursor); } catch(e){}
            const activeSong = getActiveSong();
            if (activeSong) activeSong.lyrics = editor.value;
            parseText();
        };
    });

    editor.addEventListener('input', () => {
        const activeSong = getActiveSong();
        if (activeSong) {
            activeSong.lyrics = editor.value;
        }
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => { parseText(); }, 80);
    });

    searchInput.addEventListener('input', () => {
        renderSetlist();
    });

    document.getElementById('add-song-btn').onclick = () => {
        const newId = Date.now();
        const newSong = sanitizeSetlist([{
            id: newId,
            title: "New Song",
            lyrics: "New Song\n\n# Verse 1\nEnter song lyrics here..."
        }])[0];
        setlist.push(newSong);
        saveSetlist();
        renderSetlist();
        loadSong(newSong.id);
    };

    const exportBtn = document.getElementById('export-btn');
    if (exportBtn) {
        exportBtn.onclick = (e) => {
            e.preventDefault();
            try {
                const jsonStr = JSON.stringify(setlist, null, 2);
                const blob = new Blob([jsonStr], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                const dateStr = new Date().toISOString().slice(0, 10);
                a.download = `versesurf_setlist_${dateStr}.json`;
                document.body.appendChild(a);
                a.click();
                setTimeout(() => {
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                }, 100);
            } catch (err) {
                console.error("Export error:", err);
                alert("Export failed: " + err.message);
            }
        };
    }

    const importBtn = document.getElementById('import-btn');
    const importFile = document.getElementById('import-file');
    if (importBtn && importFile) {
        importBtn.onclick = (e) => {
            e.preventDefault();
            importFile.value = '';
            importFile.click();
        };

        importFile.onchange = (e) => {
            const file = e.target.files && e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const imported = JSON.parse(event.target.result);
                    if (Array.isArray(imported) && imported.length > 0) {
                        if (confirm("Importing will replace your current setlist. Continue?")) {
                            setlist = sanitizeSetlist(imported);
                            saveSetlist();
                            renderSetlist();
                            if (setlist.length > 0) {
                                loadSong(setlist[0].id);
                            }
                            alert("✓ Setlist imported successfully!");
                        }
                    } else {
                        alert("Invalid file format. Please select a valid VerseSurf JSON file.");
                    }
                } catch (err) {
                    console.error("Import parse error:", err);
                    alert("Could not read JSON file. Please check file contents.");
                }
            };
            reader.readAsText(file);
        };
    }

    const resetSetlistBtn = document.getElementById('reset-setlist-btn');
    if (resetSetlistBtn) {
        resetSetlistBtn.onclick = (e) => {
            e.preventDefault();
            if (confirm("Reset setlist to default Sunday Worship samples? Current custom songs will be overwritten (Export backup first if needed).")) {
                setlist = sanitizeSetlist(defaultSundaySetlist);
                saveSetlist();
                renderSetlist();
                if (setlist.length > 0) {
                    loadSong(setlist[0].id);
                }
            }
        };
    }

    fontSizeSlider.addEventListener('input', () => {
        const song = getActiveSong();
        if (!song) return;
        song.fontSize = fontSizeSlider.value;
        saveSetlist();
        if (liveIndex !== -1 && Number(activeSongId) === Number(liveSongId)) {
            const slide = liveSlides[liveIndex];
            if (slide) {
                bus.broadcast({ 
                    type: 'UPDATE_SLIDE',
                    liveIndex,
                    liveSongId,
                    html: formatContent(slide.content), 
                    theme: song.theme,
                    layoutStyle: song.layoutStyle,
                    fontSize: (song.fontSize || '5') + 'vw',
                    customColor: song.customColor,
                    customBgColor: song.customBgColor,
                    customBg: liveCachedBgUrl,
                    dimBg: song.dimBg,
                    tuneW: song.tuneW,
                    tuneX: song.tuneX,
                    tuneY: song.tuneY,
                    isBlackout
                });
            }
        }
    });

    themeSelect.addEventListener('change', () => {
        const song = getActiveSong();
        if (!song) return;
        song.theme = themeSelect.value;
        saveSetlist();
        updateCustomToolbarUI();
        if (liveIndex !== -1 && Number(activeSongId) === Number(liveSongId)) {
            const slide = liveSlides[liveIndex];
            if (slide) {
                bus.broadcast({ 
                    type: 'UPDATE_SLIDE',
                    liveIndex,
                    liveSongId,
                    html: formatContent(slide.content), 
                    theme: song.theme,
                    layoutStyle: song.layoutStyle,
                    fontSize: (song.fontSize || '5') + 'vw',
                    customColor: song.customColor,
                    customBgColor: song.customBgColor,
                    customBg: liveCachedBgUrl,
                    dimBg: song.dimBg,
                    tuneW: song.tuneW,
                    tuneX: song.tuneX,
                    tuneY: song.tuneY,
                    isBlackout
                });
            }
        }
    });

    layoutSelect.addEventListener('change', () => {
        const song = getActiveSong();
        if (!song) return;
        song.layoutStyle = layoutSelect.value;
        const opt = layoutSelect.options[layoutSelect.selectedIndex];
        song.tuneW = parseInt(opt.dataset.defaultW, 10) || 100;
        song.tuneX = 0;
        song.tuneY = 0;
        saveSetlist();
        updateTuneUI();
        if (liveIndex !== -1 && Number(activeSongId) === Number(liveSongId)) {
            const slide = liveSlides[liveIndex];
            if (slide) {
                bus.broadcast({ 
                    type: 'UPDATE_SLIDE',
                    liveIndex,
                    liveSongId,
                    html: formatContent(slide.content), 
                    theme: song.theme,
                    layoutStyle: song.layoutStyle,
                    fontSize: (song.fontSize || '5') + 'vw',
                    customColor: song.customColor,
                    customBgColor: song.customBgColor,
                    customBg: liveCachedBgUrl,
                    dimBg: song.dimBg,
                    tuneW: song.tuneW,
                    tuneX: song.tuneX,
                    tuneY: song.tuneY,
                    isBlackout
                });
            }
        }
    });

    customTextColor.addEventListener('input', () => {
        const song = getActiveSong();
        if (!song) return;
        song.customColor = customTextColor.value;
        saveSetlist();
        if (liveIndex !== -1 && Number(activeSongId) === Number(liveSongId)) {
            const slide = liveSlides[liveIndex];
            if (slide) {
                bus.broadcast({ 
                    type: 'UPDATE_SLIDE',
                    liveIndex,
                    liveSongId,
                    html: formatContent(slide.content), 
                    theme: song.theme,
                    layoutStyle: song.layoutStyle,
                    fontSize: (song.fontSize || '5') + 'vw',
                    customColor: song.customColor,
                    customBgColor: song.customBgColor,
                    customBg: liveCachedBgUrl,
                    dimBg: song.dimBg,
                    tuneW: song.tuneW,
                    tuneX: song.tuneX,
                    tuneY: song.tuneY,
                    isBlackout
                });
            }
        }
    });

    customBgColor.addEventListener('input', () => {
        const song = getActiveSong();
        if (!song) return;
        song.customBgColor = customBgColor.value;
        saveSetlist();
        if (liveIndex !== -1 && Number(activeSongId) === Number(liveSongId)) {
            const slide = liveSlides[liveIndex];
            if (slide) {
                bus.broadcast({ 
                    type: 'UPDATE_SLIDE',
                    liveIndex,
                    liveSongId,
                    html: formatContent(slide.content), 
                    theme: song.theme,
                    layoutStyle: song.layoutStyle,
                    fontSize: (song.fontSize || '5') + 'vw',
                    customColor: song.customColor,
                    customBgColor: song.customBgColor,
                    customBg: liveCachedBgUrl,
                    dimBg: song.dimBg,
                    tuneW: song.tuneW,
                    tuneX: song.tuneX,
                    tuneY: song.tuneY,
                    isBlackout
                });
            }
        }
    });

    dimBgCheckbox.addEventListener('change', () => {
        const song = getActiveSong();
        if (!song) return;
        song.dimBg = dimBgCheckbox.checked;
        saveSetlist();
        if (liveIndex !== -1 && Number(activeSongId) === Number(liveSongId)) {
            const slide = liveSlides[liveIndex];
            if (slide) {
                bus.broadcast({ 
                    type: 'UPDATE_SLIDE',
                    liveIndex,
                    liveSongId,
                    html: formatContent(slide.content), 
                    theme: song.theme,
                    layoutStyle: song.layoutStyle,
                    fontSize: (song.fontSize || '5') + 'vw',
                    customColor: song.customColor,
                    customBgColor: song.customBgColor,
                    customBg: liveCachedBgUrl,
                    dimBg: song.dimBg,
                    tuneW: song.tuneW,
                    tuneX: song.tuneX,
                    tuneY: song.tuneY,
                    isBlackout
                });
            }
        }
    });

    clearCustomBgBtn.onclick = async () => {
        const song = getActiveSong();
        if (!song) return;
        song.customBg = '';
        saveSetlist();
        await updateCachedBg();
        updateCustomToolbarUI();
        if (liveIndex !== -1 && Number(activeSongId) === Number(liveSongId)) {
            liveCachedBgUrl = '';
            const slide = liveSlides[liveIndex];
            if (slide) {
                bus.broadcast({ 
                    type: 'UPDATE_SLIDE',
                    liveIndex,
                    liveSongId,
                    html: formatContent(slide.content), 
                    theme: song.theme,
                    layoutStyle: song.layoutStyle,
                    fontSize: (song.fontSize || '5') + 'vw',
                    customColor: song.customColor,
                    customBgColor: song.customBgColor,
                    customBg: '',
                    dimBg: song.dimBg,
                    tuneW: song.tuneW,
                    tuneX: song.tuneX,
                    tuneY: song.tuneY,
                    isBlackout
                });
            }
        }
    };

    function updateTuneVariables() {
        const song = getActiveSong();
        if (!song) return;
        song.tuneW = Number(tuneW.value);
        song.tuneX = Number(tuneX.value);
        song.tuneY = Number(tuneY.value);
        saveSetlist();

        tuneWVal.textContent = tuneW.value + 'vw';
        tuneXVal.textContent = tuneX.value + 'vw';
        tuneYVal.textContent = tuneY.value + 'vh';

        if (liveIndex !== -1 && Number(activeSongId) === Number(liveSongId)) {
            bus.broadcast({ type: 'UPDATE_TUNE', w: song.tuneW, x: song.tuneX, y: song.tuneY });
        }
    }

    [tuneW, tuneX, tuneY].forEach(slider => slider.addEventListener('input', updateTuneVariables));

    resetTuneBtn.onclick = () => {
        const opt = layoutSelect.options[layoutSelect.selectedIndex];
        const defaultW = opt ? parseInt(opt.dataset.defaultW, 10) : 100;
        tuneW.value = defaultW;
        tuneX.value = 0;
        tuneY.value = 0;
        updateTuneVariables();
    };

    let activeThumbUrls = [];
    async function renderLocalMediaGrid() {
        activeThumbUrls.forEach(url => URL.revokeObjectURL(url));
        activeThumbUrls = [];
        localImageGrid.innerHTML = '<span style="color:#777; font-size:0.85rem;">Loading stored images...</span>';
        const items = await getAllImagesFromDB();
        localImageGrid.innerHTML = '';

        if (items.length === 0) {
            localImageGrid.innerHTML = '<span style="color:#777; font-size:0.85rem;">No local images saved yet.</span>';
            return;
        }

        items.forEach(item => {
            const thumb = document.createElement('div');
            thumb.className = 'image-thumb';
            const targetBlob = item.thumbnail || item.blob;
            const objUrl = URL.createObjectURL(targetBlob);
            activeThumbUrls.push(objUrl);
            thumb.style.backgroundImage = `url('${objUrl}')`;
            thumb.title = item.name;

            const del = document.createElement('button');
            del.className = 'delete-thumb-btn';
            del.textContent = '🗑️';
            del.onclick = async (e) => {
                e.stopPropagation();
                if (confirm(`Delete "${item.name}" from local storage?`)) {
                    await deleteImageFromDB(item.id);

                    const song = getActiveSong();
                    if (song && song.customBg === item.id) {
                        song.customBg = '';
                        saveSetlist();
                        await updateCachedBg();
                        updateCustomToolbarUI();
                        if (liveIndex !== -1 && Number(activeSongId) === Number(liveSongId)) goLive(liveIndex);
                    }
                    renderLocalMediaGrid();
                }
            };

            thumb.onclick = async () => {
                const song = getActiveSong();
                if (!song) return;
                song.customBg = item.id;
                saveSetlist();
                await updateCachedBg();
                updateCustomToolbarUI();
                if (liveIndex !== -1 && Number(activeSongId) === Number(liveSongId)) goLive(liveIndex);
                modal.style.display = 'none';
            };

            thumb.appendChild(del);
            localImageGrid.appendChild(thumb);
        });
    }

    openMediaBinBtn.onclick = () => {
        modal.style.display = 'flex';
        renderLocalMediaGrid();
    };
    closeMediaBin.onclick = () => modal.style.display = 'none';

    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
            btn.classList.add('active');
            const targetId = btn.getAttribute('data-tab');
            document.getElementById(targetId).style.display = 'block';
            if (targetId === 'tab-local') renderLocalMediaGrid();
        };
    });

    localImageUpload.onchange = async (e) => {
        const file = e.target.files && e.target.files[0];
        if (file) {
            try {
                const id = await saveImageToDB(file);
                const song = getActiveSong();
                if (song) {
                    song.customBg = id;
                    saveSetlist();
                    await updateCachedBg();
                    updateCustomToolbarUI();
                    if (liveIndex !== -1 && Number(activeSongId) === Number(liveSongId)) goLive(liveIndex);
                }
            } catch (err) {
                alert("Could not save image.");
            } finally {
                modal.style.display = 'none';
                localImageUpload.value = '';
            }
        }
    };

    if (onlineImgUrl) {
        onlineImgUrl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                applyOnlineUrlBtn.click();
            }
        });
    }

    applyOnlineUrlBtn.onclick = async () => {
        const url = onlineImgUrl.value.trim();
        if (!url) return;

        if (urlValidationStatus) {
            urlValidationStatus.innerHTML = '<span style="color:var(--text-muted); font-size:0.8rem;">Testing image URL...</span>';
        }

        const img = new Image();
        img.onload = async () => {
            if (urlValidationStatus) urlValidationStatus.innerHTML = '<span style="color:var(--success-color); font-size:0.8rem;">✓ Image URL verified!</span>';
            const song = getActiveSong();
            if (song) {
                song.customBg = url;
                saveSetlist();
                await updateCachedBg();
                updateCustomToolbarUI();
                if (liveIndex !== -1 && Number(activeSongId) === Number(liveSongId)) goLive(liveIndex);
            }
            setTimeout(() => {
                modal.style.display = 'none';
                onlineImgUrl.value = '';
                if (urlValidationStatus) urlValidationStatus.innerHTML = '';
            }, 400);
        };
        img.onerror = () => {
            if (urlValidationStatus) {
                urlValidationStatus.innerHTML = '<span style="color:var(--live-color); font-size:0.8rem;">⚠️ Could not verify image URL. Applied anyway.</span>';
            }
            const song = getActiveSong();
            if (song) {
                song.customBg = url;
                saveSetlist();
                updateCachedBg();
                updateCustomToolbarUI();
                if (liveIndex !== -1 && Number(activeSongId) === Number(liveSongId)) goLive(liveIndex);
            }
            setTimeout(() => {
                modal.style.display = 'none';
                onlineImgUrl.value = '';
                if (urlValidationStatus) urlValidationStatus.innerHTML = '';
            }, 1500);
        };
        img.src = url;
    };

    function openPairingModal() {
        pairingModal.style.display = 'flex';
        qrcodeContainer.innerHTML = '';
        
        const roomId = bus.roomId;
        const roomCodeDisplay = document.getElementById('room-code-display');
        if (roomCodeDisplay) {
            roomCodeDisplay.textContent = roomId || 'Generating...';
        }

        if (!roomId) {
            qrcodeContainer.innerHTML = '<div style="padding:20px; color:#666; font-size:0.85rem;">Generating P2P Room ID...</div>';
            return;
        }

        const remoteUrl = new URL(window.location.href);
        remoteUrl.searchParams.set('mode', 'remote');
        remoteUrl.searchParams.set('room', roomId);
        remoteUrl.hash = ''; 
        const remoteUrlStr = remoteUrl.toString();
        
        if (typeof QRCode !== 'undefined') {
            try {
                new QRCode(qrcodeContainer, {
                    text: remoteUrlStr,
                    width: 170,
                    height: 170,
                    colorDark: "#000000",
                    colorLight: "#ffffff",
                    correctLevel: QRCode.CorrectLevel.M
                });
            } catch (e) {
                console.warn("QR code generation failed:", e);
                qrcodeContainer.innerHTML = `<a href="${remoteUrlStr}" target="_blank" style="color:var(--accent); font-size:0.85rem; word-break:break-all;">${remoteUrlStr}</a>`;
            }
        } else {
            qrcodeContainer.innerHTML = `<a href="${remoteUrlStr}" target="_blank" style="color:var(--accent); font-size:0.85rem; word-break:break-all;">${remoteUrlStr}</a>`;
        }
    }

    mobileModeBtn.onclick = openPairingModal;
    document.getElementById('p2p-status-pill').onclick = openPairingModal;
    closePairingBtn.onclick = () => pairingModal.style.display = 'none';

    copyRemoteLinkBtn.onclick = () => {
        const remoteUrl = new URL(window.location.href);
        remoteUrl.searchParams.set('mode', 'remote');
        remoteUrl.searchParams.set('room', bus.roomId);
        remoteUrl.hash = '';
        const remoteUrlStr = remoteUrl.toString();
        
        navigator.clipboard.writeText(remoteUrlStr).then(() => {
            copyRemoteLinkBtn.textContent = '✓ Link Copied!';
            setTimeout(() => copyRemoteLinkBtn.textContent = '📋 Copy Remote Link', 2000);
        }).catch(() => {
            prompt("Copy this remote link:", remoteUrlStr);
        });
    };

    castBtn.onclick = () => {
        const projUrl = new URL(window.location.href);
        projUrl.searchParams.set('mode', 'projector');
        projUrl.searchParams.delete('room'); 
        projUrl.hash = '';
        window.open(projUrl.toString(), 'projectorWindow', 'width=1280,height=720');
    };

    blackoutBtn.onclick = toggleBlackout;
    clearScreenBtn.onclick = clearScreen;
    toggleTuneBtn.onclick = () => tuneToolbar.classList.toggle('show-drawer');

    const enterRemoteBtn = document.getElementById('enter-remote-btn');
    const continueAnywayBtn = document.getElementById('continue-anyway-btn');
    if (enterRemoteBtn) {
        enterRemoteBtn.onclick = () => {
            const url = new URL(window.location.href);
            url.searchParams.set('mode', 'remote');
            window.location.href = url.toString();
        };
    }
    if (continueAnywayBtn) {
        continueAnywayBtn.onclick = () => {
            document.documentElement.classList.add('mobile-unlocked');
            document.body.classList.add('mobile-unlocked');
        };
    }

    renderSetlist();
    loadSong(activeSongId);
}

// ==========================================================
// 7. PWA SERVICE WORKER REGISTRATION
// ==========================================================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('VerseSurf SW ready:', reg.scope))
            .catch(err => console.warn('SW failed:', err));
    });
}