// ==========================================================
// DASHBOARD CONTROL ENGINE
// ==========================================================
(function() {
    // Only run this script if the window is in dashboard mode
    if (VerseFlow.isProjector) return;

    const editor = document.getElementById('lyric-editor');
    const slideList = document.getElementById('slide-list');
    const setlistContainer = document.getElementById('setlist-container');
    const setlistCount = document.getElementById('setlist-count');
    const themeSelect = document.getElementById('theme-select');
    const layoutSelect = document.getElementById('layout-select');
    const fontSizeSlider = document.getElementById('font-size-slider');
    const fontSizeVal = document.getElementById('font-size-val');

    const globalLiveIndicator = document.getElementById('global-live-indicator');
    const globalLiveLabel = document.getElementById('global-live-label');
    const blackoutBtn = document.getElementById('blackout-btn');
    const clearScreenBtn = document.getElementById('clear-screen-btn');

    const customToolbar = document.getElementById('custom-theme-toolbar');
    const customTextColor = document.getElementById('custom-text-color');
    const customTextColorHex = document.getElementById('custom-text-color-hex');
    const customBgColor = document.getElementById('custom-bg-color');
    const customBgColorHex = document.getElementById('custom-bg-color-hex');
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

    const searchInput = document.getElementById('search-input');
    const searchClearBtn = document.getElementById('search-clear-btn');

    const statSlides = document.getElementById('stat-slides');
    const statWords = document.getElementById('stat-words');

    // Modals
    const mediaBinModal = document.getElementById('media-bin-modal');
    const closeMediaBin = document.getElementById('close-media-bin');
    const localImageUpload = document.getElementById('local-image-upload');
    const localImageGrid = document.getElementById('local-image-grid');
    const onlineImgUrl = document.getElementById('online-img-url');
    const applyOnlineUrlBtn = document.getElementById('apply-online-url-btn');
    const urlValidationStatus = document.getElementById('url-validation-status');

    const shortcutsModal = document.getElementById('shortcuts-modal');
    const openShortcutsBtn = document.getElementById('open-shortcuts-modal-btn');
    const closeShortcutsModal = document.getElementById('close-shortcuts-modal');

    // Mobile warning
    const continueAnywayBtn = document.getElementById('continue-anyway-btn');
    if (continueAnywayBtn) {
        continueAnywayBtn.addEventListener('click', () => {
            document.body.classList.add('mobile-unlocked');
        });
    }

    // Engine States
    let slides = [];
    let previewIndex = 0;
    let cachedBgUrl = '';

    let liveIndex = -1;
    let liveSongId = null;
    let liveSlides = [];
    let liveCachedBgUrl = '';
    let isBlackout = false;

    async function updateCachedBg() {
        const activeSong = getActiveSong();
        if (activeSong) {
            cachedBgUrl = await VerseFlow.resolveBackgroundUrl(activeSong.customBg);
        }
    }

    function sanitizeSetlist(list) {
        if (!Array.isArray(list)) return [];
        return list.map(song => ({
            id: (!isNaN(Number(song.id)) && song.id !== null) ? Number(song.id) : Date.now() + Math.floor(Math.random() * 1000),
            theme: song.theme || "theme-dark",
            layoutStyle: song.layoutStyle || "layout-center",
            tuneW: song.tuneW !== undefined ? Number(song.tuneW) : 100,
            tuneX: song.tuneX !== undefined ? Number(song.tuneX) : 0,
            tuneY: song.tuneY !== undefined ? Number(song.tuneY) : 0,
            fontSize: song.fontSize ? String(song.fontSize) : "5",
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
            title: "Amazing Grace", lyrics: "Amazing Grace\n\n# Verse 1\nAmazing grace, how sweet the sound\nThat saved a wretch like me\n\n# Chorus\nI once was lost, but now am found\nWas blind, but now I see\n\n# Verse 2\n'Twas grace that taught my heart to fear,\nAnd grace my fears relieved;\nHow precious did that grace appear\nThe hour I first believed!"
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
            title: "詩篇 23:1-4 (Psalm 23)", lyrics: "詩篇 23:1-4\n\n# Rolling 2\n> 詩篇 23:1-4\n1 耶和華是我的牧者，我必不致缺乏。\n2 他使我躺臥在青草地上，領我在可安歇的水邊。\n3 他使我的靈魂甦醒，為自己的名引導我走義路。\n4 我雖然行過死蔭的幽谷，也不怕遭害，因為你與我同在。"
        }
    ];

    const resetSetlistBtn = document.getElementById('reset-setlist-btn');
    const emergencyResetBtn = document.getElementById('emergency-reset-btn');
    const recoveryUI = document.getElementById('recovery-ui');
    const dashboardUI = document.getElementById('dashboard-ui');

    resetSetlistBtn.addEventListener('click', () => {
        if (confirm("Reset current setlist to default samples? This will clear current local changes.")) {
            localStorage.removeItem('verseflow_setlist');
            localStorage.removeItem('verseflow_active_song');
            window.location.reload();
        }
    });

    emergencyResetBtn.addEventListener('click', () => {
        localStorage.removeItem('verseflow_setlist');
        localStorage.removeItem('verseflow_active_song');
        window.location.reload();
    });

    let setlist;
    let storedId;

    try {
        const storedData = localStorage.getItem('verseflow_setlist');
        setlist = sanitizeSetlist(storedData ? JSON.parse(storedData) : defaultSetlist);
        storedId = Number(localStorage.getItem('verseflow_active_song'));
    } catch (error) {
        console.error("Corrupted setlist detected:", error);
        dashboardUI.style.display = 'none';
        recoveryUI.classList.remove('hidden');
        throw new Error("Boot halted due to corrupted data.");
    }

    let activeSongId = (!isNaN(storedId) && storedId !== 0 && setlist.some(s => s.id === storedId)) ? storedId : setlist[0]?.id;
    const getActiveSong = () => setlist.find(s => s.id === activeSongId) || setlist[0];

    function saveSetlist() {
        try {
            localStorage.setItem('verseflow_setlist', JSON.stringify(setlist));
        } catch (e) {
            console.error("Storage limit reached:", e);
            alert("⚠️ Local storage limit reached! Please export a backup JSON file.");
        }
    }

    let draggedIndex = null;
    let deletedSongCache = null;
    let deletedSongIndex = -1;
    let undoTimeout = null;

    function countWords(str) {
        if (!str) return 0;
        return str.trim().split(/\s+/).filter(Boolean).length;
    }

    function renderSetlist() {
        setlistContainer.innerHTML = '';
        if (setlistCount) setlistCount.textContent = setlist.length;

        if (setlist.length === 0) {
            setlistContainer.innerHTML = '<div class="setlist-empty-state">No songs in setlist.<br>Click <strong>+ New Song</strong> to add one.</div>';
            return;
        }

        setlist.forEach((song, index) => {
            const el = document.createElement('div');
            el.className = 'song-item';
            el.draggable = !searchInput.value.trim();
            el.dataset.index = index;

            // Drag handle
            const handle = document.createElement('span');
            handle.className = 'drag-handle';
            handle.title = "Drag to reorder";
            handle.innerHTML = `<svg width="12" height="14" stroke-width="2.5"><use href="#icon-drag"></use></svg>`;

            // Song Info (Title + Slide count subtitle)
            const info = document.createElement('div');
            info.className = 'song-info';

            const titleSpan = document.createElement('span');
            titleSpan.className = 'song-title';
            titleSpan.textContent = song.title || "Untitled";

            const metaSpan = document.createElement('span');
            metaSpan.className = 'song-meta';
            const parsed = parseTextToSlides(song.lyrics);
            metaSpan.textContent = `${parsed.length} slide${parsed.length === 1 ? '' : 's'}`;

            info.appendChild(titleSpan);
            info.appendChild(metaSpan);

            // Live Badge
            const liveBadge = document.createElement('span');
            liveBadge.textContent = 'LIVE';
            liveBadge.className = 'sidebar-live-badge';

            // Actions (Duplicate & Delete)
            const actions = document.createElement('div');
            actions.className = 'song-actions';

            const dupBtn = document.createElement('button');
            dupBtn.className = 'song-action-btn';
            dupBtn.title = 'Duplicate Song';
            dupBtn.innerHTML = `<svg width="13" height="13" stroke-width="2"><use href="#icon-copy"></use></svg>`;
            dupBtn.onclick = (e) => {
                e.stopPropagation();
                const copy = JSON.parse(JSON.stringify(song));
                copy.id = Date.now() + Math.floor(Math.random() * 1000);
                copy.title = `${song.title} (Copy)`;
                copy.lyrics = song.lyrics.replace(/^([^\n]+)/, `${copy.title}`);
                setlist.splice(index + 1, 0, copy);
                saveSetlist();
                renderSetlist();
                loadSong(copy.id);
            };

            const delBtn = document.createElement('button');
            delBtn.className = 'song-action-btn delete-btn';
            delBtn.title = 'Delete Song';
            delBtn.innerHTML = `<svg width="13" height="13" stroke-width="2"><use href="#icon-trash"></use></svg>`;
            delBtn.onclick = (e) => {
                e.stopPropagation();

                if (song.id === liveSongId) {
                    alert("⚠️ This song is currently live on the projector. Please clear the screen (Esc) before deleting.");
                    return;
                }

                if (confirm(`Delete "${song.title}"?`)) {
                    deletedSongIndex = index;
                    deletedSongCache = JSON.parse(JSON.stringify(song));

                    setlist = setlist.filter(s => s.id !== song.id);
                    if (setlist.length === 0) setlist = sanitizeSetlist([{ id: Date.now(), title: "Untitled" }]);

                    renderSetlist();

                    if (activeSongId === song.id) loadSong(setlist[0].id);
                    saveSetlist();

                    const toast = document.getElementById('undo-toast');
                    const undoText = document.getElementById('undo-text');
                    if (undoText) undoText.textContent = `Deleted "${song.title}"`;
                    toast.style.display = 'flex';
                    clearTimeout(undoTimeout);
                    undoTimeout = setTimeout(() => { toast.style.display = 'none'; }, 7000);
                }
            };

            actions.appendChild(dupBtn);
            actions.appendChild(delBtn);

            // Drag events
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
            el.appendChild(info);
            el.appendChild(liveBadge);
            el.appendChild(actions);

            el.onclick = () => loadSong(song.id);
            setlistContainer.appendChild(el);
        });

        updateSelection();

        if (searchInput.value.trim()) applySearchFilter();
    }

    function updateCustomToolbarUI() {
        const song = getActiveSong();
        if (song && song.theme === 'theme-custom') {
            customToolbar.classList.add('show-toolbar');
            customTextColor.value = song.customColor || '#ffffff';
            customTextColorHex.textContent = song.customColor || '#ffffff';
            customBgColor.value = song.customBgColor || '#000000';
            customBgColorHex.textContent = song.customBgColor || '#000000';
            dimBgCheckbox.checked = !!song.dimBg;

            if (song.customBg) {
                toolbarThumb.style.backgroundImage = `url('${cachedBgUrl}')`;
                toolbarThumb.style.display = 'block';
                clearCustomBgBtn.style.display = 'inline-flex';
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
        tuneW.value = activeSong.tuneW !== undefined ? activeSong.tuneW : 100;
        tuneX.value = activeSong.tuneX !== undefined ? activeSong.tuneX : 0;
        tuneY.value = activeSong.tuneY !== undefined ? activeSong.tuneY : 0;

        tuneWVal.textContent = tuneW.value + 'vw';
        tuneXVal.textContent = tuneX.value + 'vw';
        tuneYVal.textContent = tuneY.value + 'vh';
    }

    function updateTuneVariables() {
        const activeSong = getActiveSong();
        if (!activeSong) return;
        activeSong.tuneW = Number(tuneW.value);
        activeSong.tuneX = Number(tuneX.value);
        activeSong.tuneY = Number(tuneY.value);
        saveSetlist();

        tuneWVal.textContent = tuneW.value + 'vw';
        tuneXVal.textContent = tuneX.value + 'vw';
        tuneYVal.textContent = tuneY.value + 'vh';

        if (liveIndex !== -1 && activeSongId === liveSongId) {
            VerseFlow.channel.postMessage({ type: 'UPDATE_TUNE', w: tuneW.value, x: tuneX.value, y: tuneY.value });
        }
    }

    async function loadSong(id) {
        activeSongId = id;
        localStorage.setItem('verseflow_active_song', id);
        const song = getActiveSong();
        if (!song) return;

        editor.value = song.lyrics || '';
        themeSelect.value = song.theme || 'theme-dark';
        layoutSelect.value = song.layoutStyle || 'layout-center';
        fontSizeSlider.value = song.fontSize || '5';
        if (fontSizeVal) fontSizeVal.textContent = parseFloat(song.fontSize || '5').toFixed(1) + 'vw';
        previewIndex = 0;

        await updateCachedBg();
        updateCustomToolbarUI();
        updateTuneUI();

        parseText();
    }

    document.getElementById('add-song-btn').addEventListener('click', () => {
        const newSong = sanitizeSetlist([{ id: Date.now(), title: "New Song", lyrics: "New Song\n\n# Verse 1\nType lyrics here..." }])[0];
        setlist.push(newSong);
        saveSetlist();
        renderSetlist();
        loadSong(newSong.id);
    });

    document.getElementById('export-btn').addEventListener('click', () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(setlist, null, 2));
        const downloadNode = document.createElement('a');
        downloadNode.setAttribute("href", dataStr);
        downloadNode.setAttribute("download", `verseflow_setlist_${new Date().toISOString().slice(0, 10)}.json`);
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
                    if (confirm("Replace current setlist with imported JSON data?")) {
                        setlist = sanitizeSetlist(importedSetlist);
                        saveSetlist();
                        renderSetlist();
                        loadSong(setlist[0].id);
                    }
                } else {
                    alert("Invalid setlist file format: JSON must be an array of songs.");
                }
            } catch (err) {
                alert("Error parsing JSON file. Ensure it is a valid VerseFlow export file.");
            }
        };
        reader.readAsText(file);
        importFile.value = '';
    });

    function applySearchFilter() {
        const query = searchInput.value.toLowerCase().trim();
        searchClearBtn.style.display = query ? 'block' : 'none';
        const songItems = setlistContainer.querySelectorAll('.song-item');
        const isSearching = query.length > 0;

        let matchCount = 0;
        setlist.forEach((song, index) => {
            const itemEl = songItems[index];
            if (itemEl) {
                const matches = song.title.toLowerCase().includes(query) || (song.lyrics && song.lyrics.toLowerCase().includes(query));
                itemEl.style.display = matches ? 'flex' : 'none';
                itemEl.draggable = !isSearching;
                if (matches) matchCount++;
            }
        });

        const existingEmpty = setlistContainer.querySelector('.setlist-empty-state');
        if (matchCount === 0 && query) {
            if (!existingEmpty) {
                const emptyEl = document.createElement('div');
                emptyEl.className = 'setlist-empty-state';
                emptyEl.textContent = `No songs match "${query}"`;
                setlistContainer.appendChild(emptyEl);
            }
        } else if (existingEmpty && query) {
            existingEmpty.remove();
        }
    }

    searchInput.addEventListener('input', applySearchFilter);
    searchClearBtn.addEventListener('click', () => {
        searchInput.value = '';
        applySearchFilter();
        searchInput.focus();
    });

    function clearScreen() {
        isBlackout = false;
        if (blackoutBtn) blackoutBtn.classList.remove('active');
        const liveSong = setlist.find(s => s.id === liveSongId) || getActiveSong();
        if (liveSong) {
            VerseFlow.channel.postMessage({
                type: 'CLEAR_SLIDE',
                theme: liveSong.theme,
                layoutStyle: liveSong.layoutStyle,
                customColor: liveSong.customColor,
                customBgColor: liveSong.customBgColor,
                customBg: liveCachedBgUrl,
                dimBg: liveSong.dimBg,
                isBlackout: false
            });
        }

        liveIndex = -1;
        liveSongId = null;
        liveSlides = [];
        liveCachedBgUrl = '';

        updateSelection();
    }

    clearScreenBtn.addEventListener('click', clearScreen);

    document.getElementById('undo-btn').addEventListener('click', () => {
        if (deletedSongCache) {
            setlist.splice(deletedSongIndex, 0, deletedSongCache);
            saveSetlist();
            renderSetlist();
            document.getElementById('undo-toast').style.display = 'none';
            deletedSongCache = null;
        }
    });

    function parseTextToSlides(text) {
        if (!text) return [];
        const blocks = text.split(/\n\s*\n/);
        const parsedSlides = blocks.flatMap((block) => {
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

        parsedSlides.forEach((s, idx) => s.id = idx);
        return parsedSlides;
    }

    function parseText() {
        const text = editor.value;
        const lines = text.split('\n');
        const firstLine = lines[0].trim();
        const activeSong = getActiveSong();
        if (!activeSong) return;

        if (activeSong.title !== firstLine && firstLine) {
            activeSong.title = firstLine;
            activeSong.lyrics = text;
            saveSetlist();

            const activeSongEl = setlistContainer.querySelector('.song-item.active .song-title');
            if (activeSongEl) activeSongEl.textContent = activeSong.title;
        } else {
            activeSong.lyrics = text;
            saveSetlist();
        }

        slides = parseTextToSlides(text);

        if (statSlides) statSlides.textContent = `${slides.length} slide${slides.length === 1 ? '' : 's'}`;
        if (statWords) statWords.textContent = `${countWords(text)} words`;

        const activeSongMeta = setlistContainer.querySelector('.song-item.active .song-meta');
        if (activeSongMeta) activeSongMeta.textContent = `${slides.length} slide${slides.length === 1 ? '' : 's'}`;

        if (activeSong.id === liveSongId) {
            liveSlides = [...slides];
            if (liveIndex >= liveSlides.length) liveIndex = Math.max(0, liveSlides.length - 1);
        }

        renderSlideList();
    }

    function escapeHTML(str) {
        return str.replace(/[&<>'"]/g, tag => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
        }[tag] || tag));
    }

    function formatContent(text) {
        if (!text) return '';

        const mathTokens = [];
        let processed = text;

        processed = processed.replace(/\$\$(.*?)\$\$/gs, (match, eq) => {
            const token = `___BLOCK_MATH_${mathTokens.length}___`;
            try {
                mathTokens.push(katex.renderToString(eq.trim(), { displayMode: true, throwOnError: false }));
            } catch (e) {
                mathTokens.push(match);
            }
            return token;
        });

        processed = processed.replace(/\$(.*?)\$/g, (match, eq) => {
            const token = `___INLINE_MATH_${mathTokens.length}___`;
            try {
                mathTokens.push(katex.renderToString(eq.trim(), { displayMode: false, throwOnError: false }));
            } catch (e) {
                mathTokens.push(match);
            }
            return token;
        });

        let html = escapeHTML(processed);
        html = html.replace(/^&gt;\s*(.*)(\r?\n)?/gm, '<div class="citation">$1</div>');
        html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/\n(?=\s*\d+)/g, '<br><span class="verse-space"></span>');
        html = html.replace(/\n/g, '<br>');

        mathTokens.forEach((renderedMath, i) => {
            html = html.replace(`___BLOCK_MATH_${i}___`, renderedMath);
            html = html.replace(`___INLINE_MATH_${i}___`, renderedMath);
        });

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

            const header = document.createElement('div');
            header.className = 'slide-card-header';

            const badges = document.createElement('div');
            badges.className = 'slide-card-badges';

            const numBadge = document.createElement('span');
            numBadge.className = 'slide-num-badge';
            numBadge.textContent = `#${index + 1}`;
            badges.appendChild(numBadge);

            if (slide.label) {
                const labelBadge = document.createElement('span');
                labelBadge.className = 'slide-label';
                labelBadge.textContent = slide.label;
                badges.appendChild(labelBadge);
            }
            header.appendChild(badges);

            const statusBadge = document.createElement('span');
            statusBadge.className = 'status-badge';
            statusBadge.textContent = 'ON AIR';
            header.appendChild(statusBadge);

            const content = document.createElement('div');
            content.className = 'slide-content';
            content.innerHTML = formatContent(slide.content);

            el.appendChild(header);
            el.appendChild(content);

            el.onclick = () => { previewIndex = index; updateSelection(); };
            el.ondblclick = () => { goLive(index); };
            slideList.appendChild(el);
        });

        renderQuickJumpBar();
        updateSelection();
    }

    function updateSelection() {
        const isCurrentlyLive = (liveIndex !== -1 && liveSongId !== null);

        if (globalLiveIndicator) {
            globalLiveIndicator.classList.toggle('is-live', isCurrentlyLive);
            globalLiveLabel.textContent = isCurrentlyLive ? 'ON AIR' : 'OFF AIR';
        }
        if (clearScreenBtn) {
            clearScreenBtn.classList.toggle('is-active-live', isCurrentlyLive);
        }

        Array.from(slideList.children).forEach((el, index) => {
            el.classList.toggle('preview', index === previewIndex);
            el.classList.toggle('live', index === liveIndex && activeSongId === liveSongId);
        });

        Array.from(setlistContainer.children).forEach((el, index) => {
            const songId = setlist[index]?.id;
            if (el.classList) {
                el.classList.toggle('active', songId === activeSongId);
                el.classList.toggle('is-live', songId === liveSongId && isCurrentlyLive);
            }
        });

        scrollToPreview();
    }

    function scrollToPreview() {
        const activeEl = slideList.children[previewIndex];
        if (activeEl) activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    function broadcastLiveState(slideObj, songObj) {
        if (!songObj || !slideObj) return;
        VerseFlow.channel.postMessage({
            type: 'UPDATE_SLIDE',
            liveIndex: liveIndex,
            liveSongId: liveSongId,
            html: formatContent(slideObj.content),
            theme: songObj.theme,
            layoutStyle: songObj.layoutStyle,
            fontSize: (songObj.fontSize || 5) + 'vw',
            customColor: songObj.customColor,
            customBgColor: songObj.customBgColor,
            customBg: liveCachedBgUrl,
            dimBg: songObj.dimBg,
            tuneW: songObj.tuneW,
            tuneX: songObj.tuneX,
            tuneY: songObj.tuneY,
            isBlackout: isBlackout
        });
    }

    function goLive(index) {
        if (slides.length === 0 || index < 0 || index >= slides.length) return;

        liveIndex = index;
        previewIndex = index;
        liveSongId = activeSongId;

        liveSlides = [...slides];
        liveCachedBgUrl = cachedBgUrl;
        isBlackout = false;
        if (blackoutBtn) blackoutBtn.classList.remove('active');

        updateSelection();

        const slide = liveSlides[liveIndex];
        const activeSong = getActiveSong();
        broadcastLiveState(slide, activeSong);
    }

    function stepLive(direction) {
        if (liveIndex === -1 || liveSlides.length === 0) return;

        const newIndex = liveIndex + direction;
        if (newIndex < 0 || newIndex >= liveSlides.length) return;

        liveIndex = newIndex;
        if (activeSongId === liveSongId) {
            previewIndex = liveIndex;
        }
        updateSelection();

        const slide = liveSlides[liveIndex];
        const liveSong = setlist.find(s => s.id === liveSongId);
        broadcastLiveState(slide, liveSong);
    }

    function jumpToSection(keywords) {
        const searchTerms = Array.isArray(keywords) ? keywords : [keywords];
        const matches = [];
        slides.forEach((s, idx) => {
            const labelLower = (s.label || '').toLowerCase();
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

    toggleTuneBtn.addEventListener('click', () => {
        tuneToolbar.classList.toggle('show-drawer');
        toggleTuneBtn.classList.toggle('active', tuneToolbar.classList.contains('show-drawer'));
    });

    [tuneW, tuneX, tuneY].forEach(slider => {
        slider.addEventListener('input', updateTuneVariables);
    });

    resetTuneBtn.addEventListener('click', () => {
        const selectedOption = layoutSelect.options[layoutSelect.selectedIndex];
        const defaultW = selectedOption ? parseInt(selectedOption.dataset.defaultW, 10) : 100;
        tuneW.value = defaultW;
        tuneX.value = 0;
        tuneY.value = 0;
        updateTuneVariables();
    });

    fontSizeSlider.addEventListener('input', () => {
        const song = getActiveSong();
        if (song) {
            song.fontSize = fontSizeSlider.value;
            if (fontSizeVal) fontSizeVal.textContent = parseFloat(song.fontSize).toFixed(1) + 'vw';
            saveSetlist();
            if (liveIndex !== -1 && activeSongId === liveSongId) goLive(liveIndex);
        }
    });

    themeSelect.addEventListener('change', () => {
        const song = getActiveSong();
        if (song) {
            song.theme = themeSelect.value;
            saveSetlist();
            updateCustomToolbarUI();
            if (liveIndex !== -1 && activeSongId === liveSongId) goLive(liveIndex);
        }
    });

    layoutSelect.addEventListener('change', () => {
        const activeSong = getActiveSong();
        if (activeSong) {
            activeSong.layoutStyle = layoutSelect.value;
            const selectedOption = layoutSelect.options[layoutSelect.selectedIndex];
            activeSong.tuneW = parseInt(selectedOption.dataset.defaultW, 10) || 100;
            activeSong.tuneX = 0;
            activeSong.tuneY = 0;
            saveSetlist();
            updateTuneUI();
            if (liveIndex !== -1 && activeSongId === liveSongId) goLive(liveIndex);
        }
    });

    customTextColor.addEventListener('input', () => {
        const song = getActiveSong();
        if (song) {
            song.customColor = customTextColor.value;
            customTextColorHex.textContent = song.customColor;
            saveSetlist();
            if (liveIndex !== -1 && activeSongId === liveSongId) goLive(liveIndex);
        }
    });

    customBgColor.addEventListener('input', () => {
        const song = getActiveSong();
        if (song) {
            song.customBgColor = customBgColor.value;
            customBgColorHex.textContent = song.customBgColor;
            saveSetlist();
            if (liveIndex !== -1 && activeSongId === liveSongId) goLive(liveIndex);
        }
    });

    dimBgCheckbox.addEventListener('change', () => {
        const song = getActiveSong();
        if (song) {
            song.dimBg = dimBgCheckbox.checked;
            saveSetlist();
            if (liveIndex !== -1 && activeSongId === liveSongId) goLive(liveIndex);
        }
    });

    clearCustomBgBtn.addEventListener('click', async () => {
        const song = getActiveSong();
        if (song) {
            song.customBg = '';
            saveSetlist();
            await updateCachedBg();
            updateCustomToolbarUI();
            if (liveIndex !== -1 && activeSongId === liveSongId) goLive(liveIndex);
        }
    });

    document.querySelectorAll('.format-chips .chip-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const insertStr = btn.getAttribute('data-insert');
            const start = editor.selectionStart;
            const end = editor.selectionEnd;
            const text = editor.value;

            const before = text.substring(0, start);
            const after = text.substring(end);
            const prefix = (before.length > 0 && !before.endsWith('\n\n')) ? (before.endsWith('\n') ? '\n' : '\n\n') : '';
            const newText = before + prefix + insertStr + '\n' + after;

            editor.value = newText;
            const newCursor = start + prefix.length + insertStr.length;
            editor.selectionStart = newCursor;
            editor.selectionEnd = newCursor;
            editor.focus();

            parseText();
        });
    });

    let activeThumbUrls = [];
    async function renderLocalMediaGrid() {
        activeThumbUrls.forEach(url => URL.revokeObjectURL(url));
        activeThumbUrls = [];

        localImageGrid.innerHTML = '<span style="color:#777; font-size:0.85rem;">Loading stored images...</span>';
        const items = await VerseFlow.getAllImagesFromDB();
        localImageGrid.innerHTML = '';

        if (items.length === 0) {
            localImageGrid.innerHTML = '<span style="color:#777; font-size:0.85rem;">No local images saved yet. Click above to upload.</span>';
            return;
        }

        const activeSong = getActiveSong();

        items.forEach(item => {
            const thumb = document.createElement('div');
            thumb.className = 'image-thumb' + (activeSong && activeSong.customBg === item.id ? ' selected' : '');

            const targetBlob = item.thumbnail ? item.thumbnail : item.blob;
            const objUrl = URL.createObjectURL(targetBlob);
            activeThumbUrls.push(objUrl);

            thumb.style.backgroundImage = `url('${objUrl}')`;
            thumb.title = item.name;

            const del = document.createElement('button');
            del.className = 'delete-thumb-btn';
            del.textContent = '✕';
            del.title = 'Delete image from storage';
            del.onclick = async (e) => {
                e.stopPropagation();
                if (confirm(`Delete "${item.name}" from local storage?`)) {
                    await VerseFlow.deleteImageFromDB(item.id);
                    if (activeSong && activeSong.customBg === item.id) {
                        activeSong.customBg = '';
                        saveSetlist();
                        await updateCachedBg();
                        updateCustomToolbarUI();
                        if (liveIndex !== -1 && activeSongId === liveSongId) goLive(liveIndex);
                    }
                    renderLocalMediaGrid();
                }
            };

            thumb.onclick = async () => {
                if (activeSong) {
                    activeSong.customBg = item.id;
                    saveSetlist();
                    await updateCachedBg();
                    updateCustomToolbarUI();
                    if (liveIndex !== -1 && activeSongId === liveSongId) goLive(liveIndex);
                    mediaBinModal.style.display = 'none';
                }
            };

            thumb.appendChild(del);
            localImageGrid.appendChild(thumb);
        });
    }

    openMediaBinBtn.addEventListener('click', () => {
        mediaBinModal.style.display = 'flex';
        closeMediaBin.focus();
        const activeSong = getActiveSong();

        if (activeSong && activeSong.customBg && !activeSong.customBg.startsWith('idb_')) {
            document.querySelectorAll('.modal-tabs .tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('#media-bin-modal .tab-content').forEach(c => c.style.display = 'none');
            document.querySelector('[data-tab="tab-online"]').classList.add('active');
            document.getElementById('tab-online').style.display = 'block';

            onlineImgUrl.value = activeSong.customBg;
            urlValidationStatus.innerHTML = '<span style="color: #10b981; font-size: 0.85rem;">✓ Active image link</span>';
        } else {
            document.querySelectorAll('.modal-tabs .tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('#media-bin-modal .tab-content').forEach(c => c.style.display = 'none');
            document.querySelector('[data-tab="tab-local"]').classList.add('active');
            document.getElementById('tab-local').style.display = 'block';

            renderLocalMediaGrid();
        }
    });

    closeMediaBin.addEventListener('click', () => { mediaBinModal.style.display = 'none'; });
    mediaBinModal.addEventListener('click', (e) => { if (e.target === mediaBinModal) mediaBinModal.style.display = 'none'; });

    document.querySelectorAll('.modal-tabs .tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.modal-tabs .tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('#media-bin-modal .tab-content').forEach(c => c.style.display = 'none');
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
                const id = await VerseFlow.saveImageToDB(file);
                const activeSong = getActiveSong();
                if (activeSong) {
                    activeSong.customBg = id;
                    saveSetlist();
                    await updateCachedBg();
                    updateCustomToolbarUI();
                    if (liveIndex !== -1 && activeSongId === liveSongId) goLive(liveIndex);
                }
            } catch (error) {
                alert("Could not save image. Your browser storage might be full.");
            } finally {
                mediaBinModal.style.display = 'none';
                localImageUpload.value = '';
            }
        }
    });

    function validateAndApplyUrl(url) {
        if (!url) {
            urlValidationStatus.innerHTML = '<span style="color: #ff6b6b; font-size: 0.85rem;">Please paste an image URL.</span>';
            return;
        }
        urlValidationStatus.innerHTML = '<span style="color: #94a3b8; font-size: 0.85rem;">⏳ Validating image link...</span>';

        const testImg = new Image();
        let timedOut = false;
        const timer = setTimeout(() => {
            timedOut = true;
            urlValidationStatus.innerHTML = '<span style="color: #ff6b6b; font-size: 0.85rem;">⚠️ Connection timed out. Make sure URL is publicly accessible.</span>';
        }, 6000);

        testImg.onload = async () => {
            if (timedOut) return;
            clearTimeout(timer);
            urlValidationStatus.innerHTML = '<span style="color: #10b981; font-size: 0.85rem;">✓ Valid image URL</span>';

            const activeSong = getActiveSong();
            if (activeSong) {
                activeSong.customBg = url;
                saveSetlist();
                await updateCachedBg();
                updateCustomToolbarUI();
                if (liveIndex !== -1 && activeSongId === liveSongId) goLive(liveIndex);
            }

            setTimeout(() => {
                mediaBinModal.style.display = 'none';
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

    function openShortcuts() { 
        shortcutsModal.style.display = 'flex'; 
        closeShortcutsModal.focus();
    }
    function closeShortcuts() { shortcutsModal.style.display = 'none'; }
    if (openShortcutsBtn) openShortcutsBtn.addEventListener('click', openShortcuts);
    closeShortcutsModal.addEventListener('click', closeShortcuts);

    function toggleBlackout() {
        isBlackout = !isBlackout;
        if (blackoutBtn) blackoutBtn.classList.toggle('active', isBlackout);
        VerseFlow.channel.postMessage({ type: 'SET_BLACKOUT', blackout: isBlackout });
    }
    if (blackoutBtn) blackoutBtn.addEventListener('click', toggleBlackout);
    shortcutsModal.addEventListener('click', (e) => { if (e.target === shortcutsModal) closeShortcuts(); });

    let debounceTimer;
    editor.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => { parseText(); }, 120);
    });

    document.getElementById('cast-btn').addEventListener('click', () => {
        const baseUrl = window.location.href.split('?')[0].split('#')[0];
        const projectorUrl = baseUrl + '?mode=projector';
        window.open(projectorUrl, 'projectorWindow', 'width=1280,height=720,menubar=no,toolbar=no,location=no');
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
                let idx = slides.findIndex(s => (s.label || '').trim() === targetNum);
                if (idx === -1) idx = slides.findIndex(s => (s.label || '').toLowerCase() === `verse ${targetNum}`);
                if (idx !== -1) { previewIndex = idx; updateSelection(); }
            }, 250);
            return;
        }

        switch (key) {
            case 'pagedown': {
                const idx = setlist.findIndex(s => s.id === activeSongId);
                if (idx < setlist.length - 1) loadSong(setlist[idx + 1].id);
                break;
            }
            case 'pageup': {
                const idx = setlist.findIndex(s => s.id === activeSongId);
                if (idx > 0) loadSong(setlist[idx - 1].id);
                break;
            }
            case 'arrowdown':
                previewIndex = Math.min(slides.length - 1, previewIndex + 1);
                updateSelection();
                break;
            case 'arrowup':
                previewIndex = Math.max(0, previewIndex - 1);
                updateSelection();
                break;
            case 'v': jumpToSection(['verse', 'v']); break;
            case 'c': jumpToSection(['chorus', 'c']); break;
            case 'b': jumpToSection(['bridge', 'b']); break;
            case 'p': jumpToSection(['pre', 'p-c', 'pre-chorus']); break;
            case 'e': jumpToSection(['coda', 'ending', 'outro', 'e']); break;
            case 't':
                previewIndex = 0;
                updateSelection();
                break;
            case 'enter':
                if (slides.length > 0 && previewIndex >= 0 && previewIndex < slides.length) {
                    goLive(previewIndex);
                }
                break;
            case ' ':
            case 'arrowright':
                stepLive(1);
                break;
            case 'arrowleft':
                stepLive(-1);
                break;
            case 'escape':
            case 'backspace':
                clearScreen();
                break;
            case '.':
                toggleBlackout();
                break;
        }
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') {
            const activeModal = document.querySelector('.modal-overlay[style*="display: flex"]');
            if (activeModal) {
                const focusableElements = activeModal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
                if (focusableElements.length > 0) {
                    const firstElement = focusableElements[0];
                    const lastElement = focusableElements[focusableElements.length - 1];

                    if (e.shiftKey) {
                        if (document.activeElement === firstElement || document.activeElement === document.body) {
                            lastElement.focus();
                            e.preventDefault();
                        }
                    } else {
                        if (document.activeElement === lastElement || document.activeElement === document.body) {
                            firstElement.focus();
                            e.preventDefault();
                        }
                    }
                }
            }
            return;
        }

        const activeEl = document.activeElement;
        const isInput = activeEl && (['INPUT', 'TEXTAREA', 'SELECT'].includes(activeEl.tagName) || activeEl.isContentEditable);

        if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
            if (!isInput) {
                e.preventDefault();
                openShortcuts();
                return;
            }
        }

        if (e.key === 'Escape') {
            if (shortcutsModal.style.display === 'flex') {
                closeShortcuts();
                return;
            }
            if (mediaBinModal.style.display === 'flex') {
                mediaBinModal.style.display = 'none';
                return;
            }
        }

        if (isInput) return;

        const key = e.key.toLowerCase();
        if (VerseFlow.navKeys.includes(key) || (key >= '0' && key <= '9')) {
            e.preventDefault();
            handleNavigationKey(key);
        }
    });

    VerseFlow.channel.onmessage = (e) => {
        if (e.data.type === 'PROJECTOR_KEYPRESS') {
            handleNavigationKey(e.data.key);

        } else if (e.data.type === 'PROJECTOR_SYNC') {
            liveIndex = e.data.state.index;
            liveSongId = e.data.state.songId;
            isBlackout = !!e.data.state.isBlackout;
            if (blackoutBtn) blackoutBtn.classList.toggle('active', isBlackout);

            const liveSong = setlist.find(s => s.id === liveSongId);
            if (liveSong) {
                liveSlides = parseTextToSlides(liveSong.lyrics);
                VerseFlow.resolveBackgroundUrl(liveSong.customBg).then(url => {
                    liveCachedBgUrl = url;
                    updateSelection();
                });
            } else {
                updateSelection();
            }

        } else if (e.data.type === 'PROJECTOR_READY') {
            if (liveIndex !== -1 && liveSlides.length > 0) {
                const liveSong = setlist.find(s => s.id === liveSongId);
                broadcastLiveState(liveSlides[liveIndex], liveSong);
            } else {
                clearScreen();
            }
        }
    };

    document.querySelector('.brand').addEventListener('click', async (e) => {
        e.preventDefault();

        if (e.currentTarget.classList.contains('update-ready')) {
            VerseFlow.refreshing = true;
            window.location.reload();
            return;
        }

        if (!navigator.onLine) {
            e.target.textContent = "Offline";
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

    renderSetlist();
    loadSong(activeSongId).then(() => {
        VerseFlow.channel.postMessage({ type: 'DASHBOARD_BOOT' });
    });
})();