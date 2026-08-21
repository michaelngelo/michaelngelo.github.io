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
const channel = new BroadcastChannel('verseflow_channel');

if (isProjector) {
    document.title = "Projector - VerseFlow";
    document.getElementById('dashboard-ui').style.display = 'none';
    const projUI = document.getElementById('projector-ui');
    const projOverlay = document.getElementById('projector-overlay');
    const projContent = document.getElementById('projector-content');
    projUI.style.display = 'flex';

    function applyProjectorTheme(data) {
        if (data.theme === 'theme-custom') {
            projUI.className = 'projector theme-custom';
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
            projUI.className = `projector ${data.theme || 'theme-dark'}`;
        }
    }

    channel.onmessage = (e) => {
        if (e.data.type === 'UPDATE_SLIDE') {
            applyProjectorTheme(e.data);
            projContent.classList.remove('fade-animation');
            void projContent.offsetWidth; 
            projContent.innerHTML = e.data.html;
            if (e.data.fontSize) projContent.style.fontSize = e.data.fontSize;
            projContent.classList.add('fade-animation');
        } else if (e.data.type === 'CLEAR_SLIDE') {
            projContent.innerHTML = '';
            applyProjectorTheme(e.data);
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
        const navKeys = ['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'enter', ' ', 'escape', 'backspace', 'pagedown', 'pageup', 'v', 'c', 'b', 'p', 'e', 't'];

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
    
    let slides = [];
    let previewIndex = 0;
    let liveIndex = -1;
    let liveSongId = null;

    const defaultSong = { 
        id: Date.now(),
        theme: "theme-dark",
        fontSize: "5",
        customColor: "#ffffff",
        customBgColor: "#000000",
        customBg: "",
        dimBg: false,
        title: "Amazing Grace",
        lyrics: "Amazing Grace\n\n# Verse 1\nAmazing grace, how sweet the sound\nThat saved a wretch like me\n\n# Chorus\nI once was lost, but now am found\nWas blind, but now I see"
    };
    
    let setlist = JSON.parse(localStorage.getItem('verseflow_setlist')) || [defaultSong];
    let activeSongId = Number(localStorage.getItem('verseflow_active_song')) || setlist[0]?.id;

    function saveSetlist() {
        localStorage.setItem('verseflow_setlist', JSON.stringify(setlist));
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
            titleSpan.textContent = song.title || "Untitled";
            titleSpan.style.flex = '1';

            const delBtn = document.createElement('button');
            delBtn.className = 'delete-btn';
            delBtn.innerHTML = '×';
            delBtn.onclick = (e) => {
                e.stopPropagation();
                if(confirm(`Delete "${song.title}"?`)) {
                    deletedSongIndex = index;
                    deletedSongCache = song;
                    
                    setlist = setlist.filter(s => s.id !== song.id);
                    if(setlist.length === 0) setlist = [{ id: Date.now(), title: "New Song", lyrics: "New Song\n\n# Verse 1\n..." }];
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
        const song = setlist.find(s => s.id === activeSongId);
        if (!song) return;

        if (song.theme === 'theme-custom') {
            customToolbar.classList.add('show-toolbar');
            customTextColor.value = song.customColor || '#ffffff';
            customBgColor.value = song.customBgColor || '#000000';
            dimBgCheckbox.checked = !!song.dimBg;

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
        const song = setlist.find(s => s.id === id);
        editor.value = song.lyrics;
        themeSelect.value = song.theme || 'theme-dark';
        fontSizeSlider.value = song.fontSize || "5";
        previewIndex = 0;
        if (activeSongId !== liveSongId) liveIndex = -1;
        updateCustomToolbarUI();
        renderSetlist();
        parseText();
    }

    document.getElementById('add-song-btn').addEventListener('click', () => {
        const newSong = { 
            id: Date.now(), theme: "theme-dark", fontSize: "5", customColor: "#ffffff",
            customBgColor: "#000000", customBg: "", dimBg: false,
            title: "New Song", lyrics: "New Song\n\n# Verse 1\nType lyrics here..." 
        };
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
                        setlist = importedSetlist;
                        saveSetlist();
                        loadSong(setlist[0].id);
                    }
                } else alert("Invalid setlist file format.");
            } catch (err) { alert("Error parsing JSON file. Make sure it is a valid VerseFlow export."); }
        };
        reader.readAsText(file);
        importFile.value = '';
    });

    const searchInput = document.getElementById('search-input');
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
        updateSelection();
        const activeSong = setlist.find(s => s.id === activeSongId) || {};
        const resolvedBg = await resolveBackgroundUrl(activeSong.customBg);
        channel.postMessage({ 
            type: 'CLEAR_SLIDE',
            theme: activeSong.theme || themeSelect.value,
            customColor: activeSong.customColor || '#ffffff',
            customBgColor: activeSong.customBgColor || '#000000',
            customBg: resolvedBg,
            dimBg: !!activeSong.dimBg
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
        const activeSong = setlist.find(s => s.id === activeSongId);
        
        if (activeSong && activeSong.title !== firstLine) {
            activeSong.title = firstLine || "Untitled";
            activeSong.lyrics = text;
            saveSetlist();
            renderSetlist();
        } else if (activeSong) {
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

            if (label.toLowerCase() === 'rolling') {
                const contentLines = content.split('\n');
                let citation = '';
                let verses = [...contentLines];

                if (verses.length > 0 && verses[0].trim().startsWith('>')) {
                    citation = verses.shift().trim() + '\n';
                }

                if (verses.length < 2) return [{ label, content }];

                const rollingSlides = [];
                for (let i = 0; i < verses.length - 1; i++) {
                    const pair = verses[i] + '\n' + verses[i + 1];
                    const match = verses[i].trim().match(/^(\d+)/);
                    const verseLabel = match ? match[1] : (i === 0 ? label : '');
                    rollingSlides.push({ label: verseLabel, content: citation + pair });
                }
                const finalVerse = verses[verses.length - 1];
                const finalMatch = finalVerse.trim().match(/^(\d+)/);
                rollingSlides.push({ label: finalMatch ? finalMatch[1] : '', content: citation + finalVerse });

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
        scrollToPreview();
    }

    function scrollToPreview() {
        const activeEl = slideList.children[previewIndex];
        if (activeEl) activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    async function goLive(index) {
        if (index < 0 || index >= slides.length) return;
        liveIndex = index;
        previewIndex = index;
        liveSongId = activeSongId; 
        updateSelection();
        
        const slide = slides[liveIndex];
        const activeSong = setlist.find(s => s.id === activeSongId) || {};
        const resolvedBg = await resolveBackgroundUrl(activeSong.customBg);

        channel.postMessage({ 
            type: 'UPDATE_SLIDE', 
            html: formatContent(slide.content), 
            theme: activeSong.theme || themeSelect.value,
            fontSize: (activeSong.fontSize || fontSizeSlider.value) + 'vw',
            customColor: activeSong.customColor || '#ffffff',
            customBgColor: activeSong.customBgColor || '#000000',
            customBg: resolvedBg,
            dimBg: !!activeSong.dimBg
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

    fontSizeSlider.addEventListener('input', () => {
        const activeSong = setlist.find(s => s.id === activeSongId);
        if (activeSong) { activeSong.fontSize = fontSizeSlider.value; saveSetlist(); }
        if(liveIndex !== -1 && activeSongId === liveSongId) goLive(liveIndex);
    });

    themeSelect.addEventListener('change', () => { 
        const activeSong = setlist.find(s => s.id === activeSongId);
        if (activeSong) { activeSong.theme = themeSelect.value; saveSetlist(); }
        updateCustomToolbarUI();
        if(liveIndex !== -1 && activeSongId === liveSongId) goLive(liveIndex); 
    });

    customTextColor.addEventListener('input', () => {
        const activeSong = setlist.find(s => s.id === activeSongId);
        if (activeSong) { activeSong.customColor = customTextColor.value; saveSetlist(); }
        if(liveIndex !== -1 && activeSongId === liveSongId) goLive(liveIndex);
    });

    customBgColor.addEventListener('input', () => {
        const activeSong = setlist.find(s => s.id === activeSongId);
        if (activeSong) { activeSong.customBgColor = customBgColor.value; saveSetlist(); }
        if(liveIndex !== -1 && activeSongId === liveSongId) goLive(liveIndex);
    });

    dimBgCheckbox.addEventListener('change', () => {
        const activeSong = setlist.find(s => s.id === activeSongId);
        if (activeSong) { activeSong.dimBg = dimBgCheckbox.checked; saveSetlist(); }
        if(liveIndex !== -1 && activeSongId === liveSongId) goLive(liveIndex);
    });

    clearCustomBgBtn.addEventListener('click', () => {
        const activeSong = setlist.find(s => s.id === activeSongId);
        if (activeSong) {
            activeSong.customBg = '';
            saveSetlist();
            updateCustomToolbarUI();
            if(liveIndex !== -1 && activeSongId === liveSongId) goLive(liveIndex);
        }
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
                    const activeSong = setlist.find(s => s.id === activeSongId);
                    if (activeSong && activeSong.customBg === item.id) {
                        activeSong.customBg = '';
                        saveSetlist();
                        updateCustomToolbarUI();
                        if (liveIndex !== -1 && activeSongId === liveSongId) goLive(liveIndex);
                    }
                    renderLocalMediaGrid();
                }
            };

            thumb.onclick = () => {
                const activeSong = setlist.find(s => s.id === activeSongId);
                if (activeSong) {
                    activeSong.customBg = item.id;
                    saveSetlist();
                    updateCustomToolbarUI();
                    if (liveIndex !== -1 && activeSongId === liveSongId) goLive(liveIndex);
                }
                modal.style.display = 'none';
            };

            thumb.appendChild(del);
            localImageGrid.appendChild(thumb);
        });
    }

    openMediaBinBtn.addEventListener('click', () => {
        modal.style.display = 'flex';
        const activeSong = setlist.find(s => s.id === activeSongId);
        
        if (activeSong && activeSong.customBg && !activeSong.customBg.startsWith('idb_')) {
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
            const id = await saveImageToDB(file);
            const activeSong = setlist.find(s => s.id === activeSongId);
            if (activeSong) {
                activeSong.customBg = id;
                saveSetlist();
                updateCustomToolbarUI();
                if (liveIndex !== -1 && activeSongId === liveSongId) goLive(liveIndex);
            }
            modal.style.display = 'none';
        }
        localImageUpload.value = '';
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
            
            const activeSong = setlist.find(s => s.id === activeSongId);
            if (activeSong) {
                activeSong.customBg = url;
                saveSetlist();
                updateCustomToolbarUI();
                if (liveIndex !== -1 && activeSongId === liveSongId) goLive(liveIndex);
            }
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
        if (key === 'enter') { goLive(previewIndex); }
        if (key === ' ' || key === 'arrowright') { goLive(Math.min(slides.length - 1, liveIndex + 1)); }
        if (key === 'arrowleft') { goLive(Math.max(0, liveIndex - 1)); }
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
        } else if (e.data.type === 'PROJECTOR_READY') {
            if (liveIndex !== -1 && activeSongId === liveSongId) goLive(liveIndex);
            else clearScreen();
        }
    };

    document.addEventListener('keydown', (e) => {
        const searchInput = document.getElementById('search-input');
        if (document.activeElement === editor || 
            document.activeElement === fontSizeSlider || 
            document.activeElement === searchInput ||
            document.activeElement === onlineImgUrl) return; 

        const key = e.key.toLowerCase();
        const navKeys = ['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'enter', ' ', 'escape', 'backspace', 'pagedown', 'pageup', 'v', 'c', 'b', 'p', 'e', 't'];

        if (navKeys.includes(key) || (key >= '0' && key <= '9')) {
            e.preventDefault();
            handleNavigationKey(key);
        }
    });

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