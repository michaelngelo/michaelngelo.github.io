// ==========================================================
// INDEXEDDB STORAGE HELPER
// ==========================================================
function openMediaDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open('VerseFlowMediaDB', 1);
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

            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            canvas.toBlob((blob) => {
                resolve(blob);
            }, 'image/jpeg', 0.7); 
        };

        img.onerror = () => reject(new Error("Failed to load image for thumbnail generation."));
        img.src = tempUrl;
    });
}

async function saveImageToDB(file) {
    const db = await openMediaDB();
    const id = 'idb_' + Date.now();
    const thumbBlob = await generateThumbnail(file);
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
    const db = await openMediaDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('images', 'readonly');
        const store = tx.objectStore('images');
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
    });
}

async function getImageFromDB(id) {
    const db = await openMediaDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('images', 'readonly');
        const store = tx.objectStore('images');
        const req = store.get(id);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function deleteImageFromDB(id) {
    const db = await openMediaDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('images', 'readwrite');
        const store = tx.objectStore('images');
        store.delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
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
// MAIN APPLICATION LOGIC
// ==========================================================
const isProjector = new URLSearchParams(window.location.search).get('mode') === 'projector';

let channel;
if ('BroadcastChannel' in window) {
    channel = new BroadcastChannel('verseflow_channel');
} else {
    console.warn("BroadcastChannel API not supported in this browser.");
    alert("⚠️ Your browser does not support the dual-screen projector feature. The dashboard will function locally, but projecting is disabled.");
    channel = { postMessage: () => {}, onmessage: null };
}

const navKeys = ['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'enter', ' ', 'escape', 'backspace', 'pagedown', 'pageup', 'v', 'c', 'b', 'p', 'e', 't'];

if (isProjector) {
    document.title = "Projector - VerseFlow";
    document.getElementById('dashboard-ui').style.display = 'none';
    const projUI = document.getElementById('projector-ui');
    const projOverlay = document.getElementById('projector-overlay');
    const projContent = document.getElementById('projector-content');
    projUI.style.display = 'flex';
    let currentLiveState = null;

    function applyProjectorTheme(data) {
        const themeClass = data.theme;
        const layoutClass = data.layoutStyle;
        if (themeClass === 'theme-custom') {
            projUI.className = `projector theme-custom ${layoutClass}`;
            projUI.style.backgroundColor = data.customBgColor;
            if (data.customBg) {
                projUI.style.backgroundImage = `url("${data.customBg}")`;
            } else {
                projUI.style.backgroundImage = 'none';
            }
            projOverlay.style.display = data.dimBg ? 'block' : 'none';
            projContent.style.color = data.customColor;
        } else {
            projUI.style.backgroundColor = '';
            projUI.style.backgroundImage = '';
            projOverlay.style.display = 'none';
            projContent.style.color = '';
            projUI.className = `projector ${themeClass} ${layoutClass}`;
        }
    }

    channel.onmessage = (e) => {
        if (e.data.type === 'UPDATE_SLIDE') {
            currentLiveState = { index: e.data.liveIndex, songId: e.data.liveSongId };
            applyProjectorTheme(e.data);
            projContent.style.setProperty('--tune-w', e.data.tuneW + 'vw');
            projContent.style.setProperty('--tune-x', e.data.tuneX + 'vw');
            projContent.style.setProperty('--tune-y', e.data.tuneY + 'vh');
            projContent.classList.remove('fade-animation');
            void projContent.offsetWidth; 
            projContent.innerHTML = e.data.html;
            projContent.style.fontSize = e.data.fontSize;
            projContent.classList.add('fade-animation');
        } else if (e.data.type === 'UPDATE_TUNE') {
            projContent.style.setProperty('--tune-w', e.data.w + 'vw');
            projContent.style.setProperty('--tune-x', e.data.x + 'vw');
            projContent.style.setProperty('--tune-y', e.data.y + 'vh');
        } else if (e.data.type === 'CLEAR_SLIDE') {
            currentLiveState = null;
            projContent.innerHTML = '';
            applyProjectorTheme(e.data);
        } else if (e.data.type === 'DASHBOARD_BOOT') {
            if (currentLiveState) {
                channel.postMessage({ type: 'PROJECTOR_SYNC', state: currentLiveState });
            } else {
                channel.postMessage({ type: 'PROJECTOR_READY' });
            }
        }
    };

    window.addEventListener('DOMContentLoaded', () => {
        channel.postMessage({ type: 'PROJECTOR_READY' });
    });

    projUI.addEventListener('dblclick', () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => console.log(err));
        } else {
            document.exitFullscreen().catch(err => console.log(err));
        }
    });

    document.addEventListener('keydown', (e) => {
        const key = e.key.toLowerCase();
        if (navKeys.includes(key) || (key >= '0' && key <= '9')) {
            channel.postMessage({ type: 'PROJECTOR_KEYPRESS', key: key });
            e.preventDefault();
        }
    });

} else {
    // --- DASHBOARD LOGIC ---
    const editor = document.getElementById('lyric-editor');
    const slideList = document.getElementById('slide-list');
    const setlistContainer = document.getElementById('setlist-container');
    const themeSelect = document.getElementById('theme-select');
    const layoutSelect = document.getElementById('layout-select');
    const fontSizeSlider = document.getElementById('font-size-slider');

    const customToolbar = document.getElementById('custom-theme-toolbar');
    const customTextColor = document.getElementById('custom-text-color');
    const customBgColor = document.getElementById('custom-bg-color');
    const toolbarThumb = document.getElementById('toolbar-thumb');
    const openMediaBinBtn = document.getElementById('open-media-bin-btn');
    const clearCustomBgBtn = document.getElementById('clear-custom-bg-btn');
    const dimBgCheckbox = document.getElementById('dim-bg-checkbox');

    const modal = document.getElementById('media-bin-modal');
    const closeMediaBin = document.getElementById('close-media-bin');
    const localImageUpload = document.getElementById('local-image-upload');
    const localImageGrid = document.getElementById('local-image-grid');
    const onlineImgUrl = document.getElementById('online-img-url');
    const applyOnlineUrlBtn = document.getElementById('apply-online-url-btn');
    const urlValidationStatus = document.getElementById('url-validation-status');
    const searchInput = document.getElementById('search-input');

    const continueAnywayBtn = document.getElementById('continue-anyway-btn');
    if (continueAnywayBtn) {
        continueAnywayBtn.addEventListener('click', () => {
            document.getElementById('mobile-warning').style.display = 'none';
            document.getElementById('dashboard-ui').style.display = 'flex';
        });
    }

    let slides = [];
    let previewIndex = 0;
    let liveIndex = -1;
    let liveSongId = null;

    function sanitizeSetlist(list) {
        if (!Array.isArray(list)) return [];
        return list.map(song => ({
            id: (!isNaN(Number(song.id)) && song.id !== null) ? Number(song.id) : Date.now(),
            theme: song.theme || "theme-dark",
            layoutStyle: song.layoutStyle || "layout-center",
            tuneW: song.tuneW !== undefined ? song.tuneW : 100,
            tuneX: song.tuneX !== undefined ? song.tuneX : 0,
            tuneY: song.tuneY !== undefined ? song.tuneY : 0,
            fontSize: song.fontSize || "5",
            customColor: song.customColor || "#ffffff",
            customBgColor: song.customBgColor || "#000000",
            customBg: song.customBg || "",
            dimBg: !!song.dimBg,
            title: song.title || "Untitled",
            lyrics: song.lyrics || "Untitled\n\n# Verse 1\n"
        }));
    }

    const defaultSetlist = [
        {
            id: 1, theme: "theme-custom", layoutStyle: "layout-center",
            tuneW: 100, tuneX: 0, tuneY: 0, fontSize: "5",
            customColor: "#ffffff", customBgColor: "#000000", customBg: "./default-bg.avif", dimBg: true,
            title: "Amazing Grace", lyrics: "Amazing Grace\n\n# Verse 1\nAmazing grace, how sweet the sound\nThat saved a wretch like me\n\n# Chorus\nI once was lost, but now am found\nWas blind, but now I see"
        },
        {
            id: 2, theme: "theme-blue-wash", layoutStyle: "layout-center",
            tuneW: 100, tuneX: 0, tuneY: 0, fontSize: "5",
            customColor: "#ffffff", customBgColor: "#000000", customBg: "", dimBg: false,
            title: "歡迎 / Welcome", lyrics: "歡迎參加主日崇拜\n\n# 準備 \n請安靜預備心敬拜\nPlease prepare your heart for worship"
        },
        {
            id: 3, theme: "theme-traditional", layoutStyle: "layout-center",
            tuneW: 100, tuneX: 0, tuneY: 0, fontSize: "5",
            customColor: "#ffffff", customBgColor: "#000000", customBg: "", dimBg: false,
            title: "祢真偉大 (How Great Thou Art)", lyrics: "祢真偉大\n\n# Verse 1\n主啊我神，我每逢舉目觀看\n祢手所造，一切奇妙大工\n\n# Chorus\n我心神唱出，讚美祢歌聲\n何等偉大，何等偉大"
        },
        {
            id: 4, theme: "theme-scripture", layoutStyle: 'layout-top-left',
            tuneW: 65, tuneX: 0, tuneY: 0, fontSize: "5",
            customColor: "#ffffff", customBgColor: "#000000", customBg: "", dimBg: false,
            title: "詩篇 23:1-4", lyrics: "詩篇 23:1-4\n\n# Rolling\n> 詩篇 23:1-4\n1 耶和華是我的牧者，我必不致缺乏。\n2 他使我躺臥在青草地上，領我在可安歇的水邊。\n3 他使我的靈魂甦醒，為自己的名引導我走義路。\n4 我雖然行過死蔭的幽谷，也不怕遭害..."
        }
    ];

    let setlist = sanitizeSetlist(JSON.parse(localStorage.getItem('verseflow_setlist')) || defaultSetlist);
    let storedId = Number(localStorage.getItem('verseflow_active_song'));
    let activeSongId = (!isNaN(storedId) && storedId !== 0) ? storedId : setlist[0]?.id;

    const getActiveSong = () => setlist.find(s => s.id === activeSongId);

    function saveSetlist() {
        try {
            localStorage.setItem('verseflow_setlist', JSON.stringify(setlist));
        } catch (e) {
            console.error("Storage limit reached:", e);
            alert("⚠️ Browser storage is full! Your recent edits cannot be saved. Please export your setlist to make a backup, then delete some songs.");
        }
    }

    let draggedIndex = null;
    let deletedSongCache = null;
    let deletedSongIndex = -1;
    let undoTimeout = null;

    function renderSetlist() {
        setlistContainer.innerHTML = '';
        setlist.forEach((song, index) => {
            const el = document.createElement('div');
            el.className = `song-item ${song.id === activeSongId ? 'active' : ''}`;
            el.draggable = true;
            el.dataset.index = index;

            const handle = document.createElement('span');
            handle.className = 'drag-handle';
            handle.innerHTML = '⋮⋮';

            const titleSpan = document.createElement('span');
            titleSpan.textContent = song.title;
            titleSpan.style.flex = '1';

            const delBtn = document.createElement('button');
            delBtn.className = 'delete-btn';
            delBtn.innerHTML = '×';
            delBtn.onclick = (e) => {
                e.stopPropagation();

                if (song.id === liveSongId) {
                    alert("⚠️ This song is currently live on the projector. Please clear the screen (Esc) before deleting it.");
                    return;
                }

                if(confirm(`Delete "${song.title}"?`)) {
                    deletedSongIndex = index;
                    deletedSongCache = song;
                    
                    setlist = setlist.filter(s => s.id !== song.id);
                    if(setlist.length === 0) setlist = sanitizeSetlist([{}]);
                    if(activeSongId === song.id) loadSong(setlist[0].id);
                    else renderSetlist();
                    saveSetlist();
                    
                    const toast = document.getElementById('undo-toast');
                    toast.style.display = 'flex';
                    clearTimeout(undoTimeout);
                    undoTimeout = setTimeout(() => { toast.style.display = 'none'; }, 7000);
                }
            };

            el.addEventListener('dragstart', () => { draggedIndex = index; el.classList.add('dragging'); });
            el.addEventListener('dragend', () => { el.classList.remove('dragging'); document.querySelectorAll('.song-item').forEach(i => i.classList.remove('drag-over')); });
            el.addEventListener('dragover', (e) => { e.preventDefault(); el.classList.add('drag-over'); });
            el.addEventListener('dragleave', () => { el.classList.remove('drag-over'); });
            el.addEventListener('drop', (e) => {
                e.preventDefault();
                el.classList.remove('drag-over');
                if (draggedIndex === null || draggedIndex === index) return;
                const draggedSong = setlist.splice(draggedIndex, 1)[0];
                setlist.splice(index, 0, draggedSong);
                saveSetlist();
                renderSetlist();
            });

            el.appendChild(handle);
            el.appendChild(titleSpan);
            el.appendChild(delBtn);
            el.onclick = () => loadSong(song.id);
            setlistContainer.appendChild(el);
        });
    }

    async function updateCustomToolbarUI() {
        const song = getActiveSong();
        if (song.theme === 'theme-custom') {
            customToolbar.classList.add('show-toolbar');
            customTextColor.value = song.customColor;
            customBgColor.value = song.customBgColor;
            dimBgCheckbox.checked = song.dimBg;

            if (song.customBg) {
                const url = await resolveBackgroundUrl(song.customBg);
                toolbarThumb.style.backgroundImage = `url('${url}')`;
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

    function loadSong(id) {
        activeSongId = id;
        localStorage.setItem('verseflow_active_song', id);
        const song = getActiveSong();
        editor.value = song.lyrics;
        themeSelect.value = song.theme;
        layoutSelect.value = song.layoutStyle;
        fontSizeSlider.value = song.fontSize;
        previewIndex = 0;
        if (activeSongId !== liveSongId) liveIndex = -1;
        updateCustomToolbarUI();
        updateTuneUI();
        renderSetlist();
        parseText();
    }

    document.getElementById('add-song-btn').addEventListener('click', () => {
        const newSong = sanitizeSetlist([{ id: Date.now() }])[0];
        setlist.push(newSong);
        saveSetlist();
        loadSong(newSong.id);
    });

    document.getElementById('export-btn').addEventListener('click', () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(setlist));
        const downloadNode = document.createElement('a');
        downloadNode.setAttribute("href", dataStr);
        downloadNode.setAttribute("download", `verseflow_setlist_${new Date().toISOString().slice(0,10)}.json`);
        document.body.appendChild(downloadNode);
        downloadNode.click();
        downloadNode.remove();
    });

    const importBtn = document.getElementById('import-btn');
    const importFile = document.getElementById('import-file');
    importBtn.addEventListener('click', () => importFile.click());
    
    importFile.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const importedSetlist = JSON.parse(event.target.result);
                if (Array.isArray(importedSetlist) && importedSetlist.length > 0) {
                    if (confirm("Replace current setlist with imported data?")) {
                        setlist = sanitizeSetlist(importedSetlist);
                        saveSetlist();
                        loadSong(setlist[0].id);
                    }
                } else alert("Invalid setlist file format.");
            } catch (err) { alert("Error parsing JSON file. Make sure it is a valid VerseFlow export."); }
        };
        reader.readAsText(file);
        importFile.value = '';
    });

    searchInput.addEventListener('input', () => {
        const query = searchInput.value.toLowerCase().trim();
        const songItems = setlistContainer.querySelectorAll('.song-item');
        setlist.forEach((song, index) => {
            const itemEl = songItems[index];
            if (itemEl) {
                const matches = song.title.toLowerCase().includes(query) || song.lyrics.toLowerCase().includes(query);
                itemEl.style.display = matches ? 'flex' : 'none';
            }
        });
    });

    async function clearScreen() {
        liveIndex = -1;
        liveSongId = null;
        updateSelection();
        const activeSong = getActiveSong();
        const resolvedBg = await resolveBackgroundUrl(activeSong.customBg);
        channel.postMessage({ 
            type: 'CLEAR_SLIDE',
            theme: activeSong.theme,
            layoutStyle: activeSong.layoutStyle,
            customColor: activeSong.customColor,
            customBgColor: activeSong.customBgColor,
            customBg: resolvedBg,
            dimBg: activeSong.dimBg
        });
    }

    document.getElementById('clear-screen-btn').addEventListener('click', clearScreen);

    document.getElementById('undo-btn').addEventListener('click', () => {
        if (deletedSongCache) {
            setlist.splice(deletedSongIndex, 0, deletedSongCache);
            saveSetlist();
            renderSetlist();
            document.getElementById('undo-toast').style.display = 'none';
            deletedSongCache = null;
        }
    });

    function parseText() {
        const text = editor.value;
        const lines = text.split('\n');
        const firstLine = lines[0].trim();
        const activeSong = getActiveSong();
        
        if (activeSong.title !== firstLine) {
            activeSong.title = firstLine || "Untitled";
            activeSong.lyrics = text;
            saveSetlist();
            
            const activeSongEl = setlistContainer.querySelector('.song-item.active span:not(.drag-handle)');
            if (activeSongEl) activeSongEl.textContent = activeSong.title;
        } else {
            activeSong.lyrics = text;
            saveSetlist();
        }

        const blocks = text.split(/\n\s*\n/);
        slides = blocks.flatMap((block) => {
            let label = '';
            let content = block.trim();
            if (content.startsWith('#')) {
                const blockLines = content.split('\n');
                label = blockLines[0].replace('#', '').trim();
                content = blockLines.slice(1).join('\n').trim();
            }

            const rollingMatch = label.match(/^rolling(?:\s+(\d+))?$/i);            
            if (rollingMatch) {
                const linesPerSlide = rollingMatch[1] ? parseInt(rollingMatch[1], 10) : 2;
                const contentLines = content.split('\n');
                let citation = '';
                let verses = [...contentLines];

                if (verses.length > 0 && verses[0].trim().startsWith('>')) {
                    citation = verses.shift().trim() + '\n';
                }

                if (verses.length < linesPerSlide) return [{ label, content }];

                const rollingSlides = [];
                for (let i = 0; i < verses.length; i++) {
                    const chunk = verses.slice(i, i + linesPerSlide).join('\n');
                    const match = verses[i].trim().match(/^(\d+)/);
                    const verseLabel = match ? match[1] : (i === 0 ? label : '');
                    rollingSlides.push({ label: verseLabel, content: citation + chunk });
                }

                return rollingSlides;
            }

            return [{ label, content }];
        }).filter(s => s.content || s.label);
        
        slides.forEach((s, idx) => s.id = idx);
        renderSlideList();
    }
    
    function escapeHTML(str) {
        return str.replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag));
    }

    function formatContent(text) {
        let html = escapeHTML(text);
        html = html.replace(/\$\$(.*?)\$\$/gs, (match, equation) => {
            try { return katex.renderToString(equation, { displayMode: true, throwOnError: false }); } 
            catch (e) { return match; }
        });
        html = html.replace(/\$(.*?)\$/g, (match, equation) => {
            try { return katex.renderToString(equation, { displayMode: false, throwOnError: false }); } 
            catch (e) { return match; }
        });
        html = html.replace(/^&gt;\s*(.*)(\r?\n)?/gm, '<div class="citation">$1</div>');
        html = html.replace(/\n(?=\s*\d+)/g, '<br><span class="verse-space"></span>');
        html = html.replace(/\n/g, '<br>');
        html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        return html;
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
            btn.textContent = slide.label;
            
            btn.onclick = () => {
                const targetIndex = slides.indexOf(slide);
                if (targetIndex !== -1) { previewIndex = targetIndex; updateSelection(); }
            };

            btn.ondblclick = () => {
                const targetIndex = slides.indexOf(slide);
                if (targetIndex !== -1) { goLive(targetIndex); }
            };
            
            jumpBar.appendChild(btn);
        });
    }

    function renderSlideList() {
        slideList.innerHTML = '';
        slides.forEach((slide, index) => {
            const el = document.createElement('div');
            el.className = 'slide-card';
            if (index === previewIndex) el.classList.add('preview');
            if (index === liveIndex && activeSongId === liveSongId) el.classList.add('live');
            
            let innerHTML = `<div class="status-badge">LIVE</div>`;
            if (slide.label) innerHTML += `<div class="slide-label">${slide.label}</div>`;
            innerHTML += `<div class="slide-content">${formatContent(slide.content)}</div>`;
            
            el.innerHTML = innerHTML;
            el.onclick = () => { previewIndex = index; updateSelection(); };
            el.ondblclick = () => { goLive(index); };
            slideList.appendChild(el);
        });
        renderQuickJumpBar();
        scrollToPreview();
    }

    function updateSelection() {
        Array.from(slideList.children).forEach((el, index) => {
            el.classList.toggle('preview', index === previewIndex);
            el.classList.toggle('live', index === liveIndex && activeSongId === liveSongId);
        });
        
        Array.from(setlistContainer.children).forEach((el) => {
            const elId = setlist[el.dataset.index]?.id;
            el.classList.toggle('active', elId === activeSongId);
        });
        
        scrollToPreview();
    }

    function scrollToPreview() {
        const activeEl = slideList.children[previewIndex];
        if (activeEl) activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    async function goLive(index) {
        liveIndex = index;
        previewIndex = index;
        liveSongId = activeSongId; 
        updateSelection();
        
        const slide = slides[liveIndex];
        const activeSong = getActiveSong();
        const resolvedBg = await resolveBackgroundUrl(activeSong.customBg);

        channel.postMessage({ 
            type: 'UPDATE_SLIDE',
            liveIndex: liveIndex,
            liveSongId: liveSongId,
            html: formatContent(slide.content), 
            theme: activeSong.theme,
            layoutStyle: activeSong.layoutStyle,
            fontSize: activeSong.fontSize + 'vw',
            customColor: activeSong.customColor,
            customBgColor: activeSong.customBgColor,
            customBg: resolvedBg,
            dimBg: activeSong.dimBg,
            tuneW: activeSong.tuneW,
            tuneX: activeSong.tuneX,
            tuneY: activeSong.tuneY
        });
    }

    function jumpToSection(keywords) {
        const searchTerms = Array.isArray(keywords) ? keywords : [keywords];
        const matches = [];
        slides.forEach((s, idx) => {
            const labelLower = s.label.toLowerCase();
            if (searchTerms.some(term => labelLower.startsWith(term))) {
                matches.push(idx);
            }
        });

        if (matches.length > 0) {
            let nextIdx = matches.find(idx => idx > previewIndex);
            if (nextIdx === undefined) nextIdx = matches[0];
            previewIndex = nextIdx;
            updateSelection();
        }
    }

    const tuneToolbar = document.getElementById('tune-toolbar');
    const toggleTuneBtn = document.getElementById('toggle-tune-btn');
    const tuneW = document.getElementById('tune-w-slider');
    const tuneX = document.getElementById('tune-x-slider');
    const tuneY = document.getElementById('tune-y-slider');
    const tuneWVal = document.getElementById('tune-w-val');
    const tuneXVal = document.getElementById('tune-x-val');
    const tuneYVal = document.getElementById('tune-y-val');

    toggleTuneBtn.addEventListener('click', () => tuneToolbar.classList.toggle('show-drawer'));

    function updateTuneUI() {
        const activeSong = getActiveSong();
        tuneW.value = activeSong.tuneW;
        tuneX.value = activeSong.tuneX;
        tuneY.value = activeSong.tuneY;
        
        tuneWVal.textContent = tuneW.value + 'vw';
        tuneXVal.textContent = tuneX.value + 'vw';
        tuneYVal.textContent = tuneY.value + 'vh';
    }

    function updateTuneVariables() {
        const activeSong = getActiveSong();
        activeSong.tuneW = tuneW.value;
        activeSong.tuneX = tuneX.value;
        activeSong.tuneY = tuneY.value;
        saveSetlist();

        tuneWVal.textContent = tuneW.value + 'vw';
        tuneXVal.textContent = tuneX.value + 'vw';
        tuneYVal.textContent = tuneY.value + 'vh';

        if (liveIndex !== -1 && activeSongId === liveSongId) {
            channel.postMessage({ type: 'UPDATE_TUNE', w: tuneW.value, x: tuneX.value, y: tuneY.value });
        }
    }

    [tuneW, tuneX, tuneY].forEach(slider => {
        slider.addEventListener('input', updateTuneVariables);
    });

    document.getElementById('reset-tune-btn').addEventListener('click', () => {
        const selectedOption = layoutSelect.options[layoutSelect.selectedIndex];
        const defaultW = selectedOption ? parseInt(selectedOption.dataset.defaultW, 10) : 100;
        tuneW.value = defaultW;
        tuneX.value = 0;
        tuneY.value = 0;
        updateTuneVariables();
    });

    fontSizeSlider.addEventListener('input', () => {
        getActiveSong().fontSize = fontSizeSlider.value; 
        saveSetlist(); 
        if(liveIndex !== -1 && activeSongId === liveSongId) goLive(liveIndex);
    });

    themeSelect.addEventListener('change', () => { 
        getActiveSong().theme = themeSelect.value;
        saveSetlist();
        updateCustomToolbarUI();
        if(liveIndex !== -1 && activeSongId === liveSongId) goLive(liveIndex); 
    });

    layoutSelect.addEventListener('change', () => {
        const activeSong = getActiveSong();
        activeSong.layoutStyle = layoutSelect.value; 
        const selectedOption = layoutSelect.options[layoutSelect.selectedIndex];
        activeSong.tuneW = parseInt(selectedOption.dataset.defaultW, 10) || 100;
        activeSong.tuneX = 0;
        activeSong.tuneY = 0;
        saveSetlist(); 
        updateTuneUI();
        if(liveIndex !== -1 && activeSongId === liveSongId) goLive(liveIndex); 
    });

    customTextColor.addEventListener('input', () => {
        getActiveSong().customColor = customTextColor.value; 
        saveSetlist(); 
        if(liveIndex !== -1 && activeSongId === liveSongId) goLive(liveIndex);
    });

    customBgColor.addEventListener('input', () => {
        getActiveSong().customBgColor = customBgColor.value; 
        saveSetlist(); 
        if(liveIndex !== -1 && activeSongId === liveSongId) goLive(liveIndex);
    });

    dimBgCheckbox.addEventListener('change', () => {
        getActiveSong().dimBg = dimBgCheckbox.checked; 
        saveSetlist(); 
        if(liveIndex !== -1 && activeSongId === liveSongId) goLive(liveIndex);
    });

    clearCustomBgBtn.addEventListener('click', () => {
        getActiveSong().customBg = '';
        saveSetlist();
        updateCustomToolbarUI();
        if(liveIndex !== -1 && activeSongId === liveSongId) goLive(liveIndex);
    });

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
            
            const targetBlob = item.thumbnail ? item.thumbnail : item.blob;
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
                    const activeSong = getActiveSong();
                    if (activeSong.customBg === item.id) {
                        activeSong.customBg = '';
                        saveSetlist();
                        updateCustomToolbarUI();
                        if (liveIndex !== -1 && activeSongId === liveSongId) goLive(liveIndex);
                    }
                    renderLocalMediaGrid();
                }
            };

            thumb.onclick = () => {
                getActiveSong().customBg = item.id;
                saveSetlist();
                updateCustomToolbarUI();
                if (liveIndex !== -1 && activeSongId === liveSongId) goLive(liveIndex);
                modal.style.display = 'none';
            };

            thumb.appendChild(del);
            localImageGrid.appendChild(thumb);
        });
    }

    openMediaBinBtn.addEventListener('click', () => {
        modal.style.display = 'flex';
        const activeSong = getActiveSong();
        
        if (activeSong.customBg && !activeSong.customBg.startsWith('idb_')) {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
            document.querySelector('[data-tab="tab-online"]').classList.add('active');
            document.getElementById('tab-online').style.display = 'block';
            
            onlineImgUrl.value = activeSong.customBg;
            urlValidationStatus.innerHTML = '<span style="color: #4CAF50; font-size: 0.85rem;">Currently active link.</span>';
        } else {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
            document.querySelector('[data-tab="tab-local"]').classList.add('active');
            document.getElementById('tab-local').style.display = 'block';
            
            renderLocalMediaGrid();
        }
    });

    closeMediaBin.addEventListener('click', () => { modal.style.display = 'none'; });
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; });

    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
            btn.classList.add('active');
            const targetId = btn.getAttribute('data-tab');
            document.getElementById(targetId).style.display = 'block';
            if (targetId === 'tab-local') renderLocalMediaGrid();
        });
    });

    localImageUpload.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
            try {
                const id = await saveImageToDB(file);
                getActiveSong().customBg = id;
                saveSetlist();
                updateCustomToolbarUI();
                if (liveIndex !== -1 && activeSongId === liveSongId) goLive(liveIndex);
            } catch (error) {
                alert("Could not save image. Your browser storage might be full.");
            } finally {
                modal.style.display = 'none';
                localImageUpload.value = '';
            }
        }
    });

    function validateAndApplyUrl(url) {
        if (!url) {
            urlValidationStatus.innerHTML = '<span style="color: #ff6b6b; font-size: 0.85rem;">Please paste an image URL.</span>';
            return;
        }
        urlValidationStatus.innerHTML = '<span style="color: #aaa; font-size: 0.85rem;">⏳ Validating image link...</span>';

        const testImg = new Image();
        let timedOut = false;
        const timer = setTimeout(() => {
            timedOut = true;
            urlValidationStatus.innerHTML = '<span style="color: #ff6b6b; font-size: 0.85rem;">⚠️ Request timed out. Ensure link is accessible.</span>';
        }, 6000);

        testImg.onload = () => {
            if (timedOut) return;
            clearTimeout(timer);
            urlValidationStatus.innerHTML = '<span style="color: #4CAF50; font-size: 0.85rem;">✓ Valid image link!</span>';
            
            getActiveSong().customBg = url;
            saveSetlist();
            updateCustomToolbarUI();
            if (liveIndex !== -1 && activeSongId === liveSongId) goLive(liveIndex);
            
            setTimeout(() => {
                modal.style.display = 'none';
                urlValidationStatus.innerHTML = '';
                onlineImgUrl.value = '';
            }, 400);
        };

        testImg.onerror = () => {
            if (timedOut) return;
            clearTimeout(timer);
            urlValidationStatus.innerHTML = '<span style="color: #ff6b6b; font-size: 0.85rem;">❌ Failed to load image. Ensure it is a direct image link (.jpg, .png, .webp).</span>';
        };

        testImg.src = url;
    }

    applyOnlineUrlBtn.addEventListener('click', () => { validateAndApplyUrl(onlineImgUrl.value.trim()); });
    onlineImgUrl.addEventListener('keypress', (e) => { if (e.key === 'Enter') validateAndApplyUrl(onlineImgUrl.value.trim()); });

    let debounceTimer;
    editor.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => { parseText(); }, 100); 
    });

    document.getElementById('cast-btn').addEventListener('click', () => {
        const baseUrl = window.location.href.split('?')[0].split('#')[0];
        const projectorUrl = baseUrl + '?mode=projector';
        window.open(projectorUrl, 'projectorWindow', 'width=1280,height=720');
    });

    let numberBuffer = '';
    let numberTimeout = null;

    function handleNavigationKey(key) {
        if (key >= '0' && key <= '9') {
            numberBuffer += key;
            clearTimeout(numberTimeout);
            numberTimeout = setTimeout(() => {
                const targetNum = numberBuffer;
                numberBuffer = '';
                let idx = slides.findIndex(s => s.label.trim() === targetNum);
                if (idx === -1) idx = slides.findIndex(s => s.label.toLowerCase() === `verse ${targetNum}`);
                if (idx !== -1) { previewIndex = idx; updateSelection(); }
            }, 200);
            return;
        }

        if (key === 'arrowup') { previewIndex = Math.max(0, previewIndex - 1); updateSelection(); }
        if (key === 'arrowdown') { previewIndex = Math.min(slides.length - 1, previewIndex + 1); updateSelection(); }
        
        if (key === 'enter') { 
            if (slides.length > 0 && previewIndex >= 0 && previewIndex < slides.length) {
                goLive(previewIndex); 
            }
        }
        if (key === ' ' || key === 'arrowright') { 
            if (slides.length > 0 && liveIndex + 1 < slides.length) {
                goLive(liveIndex + 1);
            }
        }
        if (key === 'arrowleft') { 
            if (slides.length > 0 && liveIndex > 0) {
                goLive(liveIndex - 1);
            }
        }
        
        if (key === 'escape' || key === 'backspace') document.getElementById('clear-screen-btn').click();

        if (key === 'pagedown' || key === 'pageup') {
            const currentIndex = setlist.findIndex(s => s.id === activeSongId);
            if (key === 'pagedown' && currentIndex < setlist.length - 1) loadSong(setlist[currentIndex + 1].id);
            else if (key === 'pageup' && currentIndex > 0) loadSong(setlist[currentIndex - 1].id);
        }

        if (key === 'v') jumpToSection('verse');
        if (key === 'c') jumpToSection('chorus');
        if (key === 'b') jumpToSection('bridge');
        if (key === 'p') jumpToSection('pre');
        if (key === 'e') jumpToSection(['coda', 'ending']);
        if (key === 't') { previewIndex = 0; updateSelection(); }
    }

    channel.onmessage = (e) => {
        if (e.data.type === 'PROJECTOR_KEYPRESS') {
            handleNavigationKey(e.data.key);
            
        } else if (e.data.type === 'PROJECTOR_SYNC') {
            liveIndex = e.data.state.index;
            liveSongId = e.data.state.songId;
            updateSelection();
            
        } else if (e.data.type === 'PROJECTOR_READY') {
            clearScreen();
        }
    };

    document.addEventListener('keydown', (e) => {
        if (document.activeElement === editor ||
            document.activeElement === fontSizeSlider ||
            document.activeElement === tuneW ||
            document.activeElement === tuneX ||
            document.activeElement === tuneY ||
            document.activeElement === searchInput ||
            document.activeElement === onlineImgUrl) return;

        const key = e.key.toLowerCase();
        
        if (navKeys.includes(key) || (key >= '0' && key <= '9')) {
            e.preventDefault();
            handleNavigationKey(key);
        }
    });

    document.querySelector('.brand').addEventListener('click', async (e) => {
        e.preventDefault(); 

        if (!navigator.onLine) {
            e.target.textContent = "⚠️ Offline: Cannot Update";
            setTimeout(() => e.target.textContent = "🌊 VerseFlow", 3000);
            return;
        }

        e.target.textContent = "🔄 Updating...";

        try {
            if ('caches' in window) {
                const cacheNames = await caches.keys();
                for (const name of cacheNames) {
                    await caches.delete(name);
                }
            }
            if ('serviceWorker' in navigator) {
                const registrations = await navigator.serviceWorker.getRegistrations();
                for (const registration of registrations) {
                    await registration.unregister();
                }
            }
            window.location.reload();
        } catch (error) {
            console.error('Hard refresh failed:', error);
            e.target.textContent = "⚠️ Please Hard Refresh Manually";
            setTimeout(() => e.target.textContent = "🌊 VerseFlow", 3000);
        }
    });

    channel.postMessage({ type: 'DASHBOARD_BOOT' });
    
    loadSong(activeSongId);
}

// ==========================================================
// SERVICE WORKER REGISTRATION (Offline PWA Installer)
// ==========================================================
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
}