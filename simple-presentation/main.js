class TabManager extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
        }
        .tabs-container {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px;
          background: rgba(255, 255, 255, 0.84);
          border: 1px solid rgba(15, 23, 42, 0.08);
          border-radius: 999px;
          margin-bottom: 16px;
          overflow-x: auto;
          overflow-y: hidden;
          flex-wrap: nowrap;
          scrollbar-width: thin;
          box-shadow: 0 8px 24px rgba(15, 23, 42, 0.06);
        }
        .tabs-container::-webkit-scrollbar {
          height: 8px;
        }
        .tabs-container::-webkit-scrollbar-thumb {
          background: rgba(91, 124, 255, 0.24);
          border-radius: 999px;
        }
        .tab {
          flex: 0 0 auto;
          min-width: 0;
          padding: 8px 14px;
          cursor: pointer;
          border-radius: 999px;
          background: linear-gradient(135deg, rgba(255,255,255,0.95), rgba(248,250,252,0.95));
          border: 1px solid rgba(15, 23, 42, 0.08);
          display: flex;
          align-items: center;
          gap: 8px;
          white-space: nowrap;
          color: #334155;
          font-weight: 600;
        }
        .tab.active {
          background: linear-gradient(135deg, #5b7cff, #4a65d8);
          color: white;
          border-color: transparent;
          box-shadow: 0 8px 18px rgba(91, 124, 255, 0.24);
        }
        .delete-page-btn {
          border: none;
          background: none;
          cursor: pointer;
          font-size: 16px;
          padding: 0;
          line-height: 1;
          color: inherit;
        }
        .add-page-btn {
          flex: 0 0 auto;
          padding: 8px 12px;
          font-size: 16px;
          font-weight: bold;
          border-radius: 999px;
          background: linear-gradient(135deg, #5b7cff, #4a65d8);
          color: white;
          box-shadow: 0 8px 18px rgba(91, 124, 255, 0.22);
        }
      </style>
      <div class="tabs-container" id="tabs-container">
        <button class="add-page-btn" id="add-page-btn">+</button>
      </div>
    `;

    this.tabsContainer = this.shadowRoot.getElementById('tabs-container');
    this.addPageBtn = this.shadowRoot.getElementById('add-page-btn');

    this.addPageBtn.addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent('page-added'));
    });
  }

  renderTabs(pages, activePageId) {
    // Clear existing tabs except for the add button
    while (this.tabsContainer.firstChild && this.tabsContainer.firstChild !== this.addPageBtn) {
        this.tabsContainer.removeChild(this.tabsContainer.firstChild);
    }

    pages.forEach(page => {
        const tab = document.createElement('div');
        tab.className = 'tab';
        tab.textContent = `Page ${page.id}`;
        tab.dataset.pageId = page.id;
        if (page.id === activePageId) {
            tab.classList.add('active');
        }

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-page-btn';
        deleteBtn.textContent = '×';
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.dispatchEvent(new CustomEvent('page-deleted', { detail: { pageId: page.id } }));
        });

        tab.appendChild(deleteBtn);
        tab.addEventListener('click', () => {
            this.dispatchEvent(new CustomEvent('page-selected', { detail: { pageId: page.id } }));
        });

        this.tabsContainer.insertBefore(tab, this.addPageBtn);
    });
  }
}

customElements.define('tab-manager', TabManager);

document.addEventListener('DOMContentLoaded', () => {
    const tabManager = document.getElementById('tab-manager');
    const columnSelect = document.getElementById('column-select');
    const inputContainer = document.getElementById('input-container');
    const startBtn = document.getElementById('start-btn');
    const slideshowScreen = document.getElementById('slideshow-screen');
    const slideshowRenderArea = document.getElementById('slideshow-render-area');
    const fontSizeSlider = document.getElementById('font-size-slider');
    const fontSizeValue = document.getElementById('font-size-value');
    const fontFamilySelect = document.getElementById('font-family-select');
    const bgColorPicker = document.getElementById('bg-color-picker');
    const textColorPicker = document.getElementById('text-color-picker');
    const bgImagePicker = document.getElementById('bg-image-picker');
    const bgImagePickerLabel = document.getElementById('bg-image-picker-label');
    const bgColorButton = document.getElementById('bg-color-picker-btn');
    const bgImageButton = document.getElementById('bg-image-picker-btn');
    const clearBgImageBtn = document.getElementById('clear-bg-image-btn');
    const bgImagePreview = document.getElementById('bg-image-preview');
    const bgColorSwatch = document.getElementById('bg-color-swatch');
    const textColorButton = document.getElementById('text-color-picker-btn');
    const textColorSwatch = document.getElementById('text-color-swatch');
    const slideTextBgToggleBtn = document.getElementById('slide-text-bg-toggle-btn');
    const prevSlideBtn = document.getElementById('prev-slide-btn');
    const nextSlideBtn = document.getElementById('next-slide-btn');
    const exitSlideshowBtn = document.getElementById('exit-slideshow-btn');
    const slidePageIndicator = document.getElementById('slide-page-indicator');
    const toggleControlsBtn = document.getElementById('toggle-controls-btn');
    const controlsSection = document.querySelector('.controls');
    const clearAllPagesBtn = document.getElementById('clear-all-pages-btn');

    const APP_STATE_KEY = 'textSlideshowState';
    const DEFAULT_FONT_FAMILY = '"Noto Serif HK", serif';
    const MAX_IMAGE_STORAGE_BYTES = 150 * 1024;
    const DB_NAME = 'text-slideshow-db';
    const DB_VERSION = 1;
    const BG_IMAGES_STORE = 'bgImages';

    let db = null;
    let isIndexedDBSupported = 'indexedDB' in window;
    let pages = [];
    let activePageId = null;
    let nextId = 1;

    function getEditorTextAreas() {
        return Array.from(inputContainer.querySelectorAll('textarea'));
    }

    function normalizePage(page) {
        return {
            id: typeof page.id === 'number' ? page.id : nextId++,
            // Change the default fallback from 2 to 1
            columns: Number.isInteger(page.columns) && page.columns > 0 ? page.columns : 1,
            texts: Array.isArray(page.texts) ? page.texts.map(value => String(value)) : [''], // Update to single empty string or default text
            // Change the default fallback from 'repeat(2, 1fr)' to '1fr'
            gridTemplate: typeof page.gridTemplate === 'string' && page.gridTemplate.trim() ? page.gridTemplate : '1fr',
            bgColor: typeof page.bgColor === 'string' ? page.bgColor : '#111111',
            textColor: typeof page.textColor === 'string' ? page.textColor : '#ffffff',
            fontFamily: typeof page.fontFamily === 'string' ? page.fontFamily : DEFAULT_FONT_FAMILY,
            fontSize: typeof page.fontSize === 'number' ? page.fontSize : 4,
            bgImageId: typeof page.bgImageId === 'string' ? page.bgImageId : '',
            bgImage: typeof page.bgImage === 'string' ? page.bgImage : '',
            bgImageUrl: '',
            showSlideTextBg: typeof page.showSlideTextBg === 'boolean' ? page.showSlideTextBg : false
        };
    }

    function getPersistablePages() {
        return pages.map(page => {
            const clone = { ...page };
            delete clone.bgImageUrl;
            if (clone.bgImageId) {
                clone.bgImage = '';
                return clone;
            }
            if (typeof clone.bgImage === 'string' && clone.bgImage.length > MAX_IMAGE_STORAGE_BYTES) {
                clone.bgImage = '';
            }
            return clone;
        });
    }

    function generateImageId() {
        return `bg-${crypto.randomUUID?.() ?? Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    }

    async function openDatabase() {
        if (!isIndexedDBSupported) {
            console.warn('IndexedDB is not available in this browser. Falling back to localStorage image persistence.');
            return null;
        }

        return new Promise(resolve => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = event => {
                const database = event.target.result;
                if (!database.objectStoreNames.contains(BG_IMAGES_STORE)) {
                    database.createObjectStore(BG_IMAGES_STORE);
                }
            };

            request.onsuccess = event => resolve(event.target.result);
            request.onerror = event => {
                console.warn('IndexedDB open failed:', event.target.error);
                resolve(null);
            };
            request.onblocked = () => {
                console.warn('IndexedDB open blocked by another tab.');
            };
        });
    }

    function fileToDataURL(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(file);
        });
    }

    async function saveImageBlob(imageId, blob) {
        if (!db) return false;
        return new Promise(resolve => {
            const transaction = db.transaction(BG_IMAGES_STORE, 'readwrite');
            const store = transaction.objectStore(BG_IMAGES_STORE);
            const request = store.put(blob, imageId);

            request.onsuccess = () => resolve(true);
            request.onerror = () => {
                console.warn('saveImageBlob failed:', request.error);
                resolve(false);
            };
        });
    }

    async function getImageBlob(imageId) {
        if (!db || !imageId) return null;
        return new Promise(resolve => {
            const transaction = db.transaction(BG_IMAGES_STORE, 'readonly');
            const request = transaction.objectStore(BG_IMAGES_STORE).get(imageId);

            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => {
                console.warn('getImageBlob failed:', request.error);
                resolve(null);
            };
        });
    }

    async function deleteImageBlob(imageId) {
        if (!db || !imageId) return false;
        return new Promise(resolve => {
            const transaction = db.transaction(BG_IMAGES_STORE, 'readwrite');
            const request = transaction.objectStore(BG_IMAGES_STORE).delete(imageId);

            request.onsuccess = () => resolve(true);
            request.onerror = () => {
                console.warn('deleteImageBlob failed:', request.error);
                resolve(false);
            };
        });
    }

    function isObjectUrl(url) {
        return typeof url === 'string' && url.startsWith('blob:');
    }

    function revokePageBgImageUrl(page) {
        if (!page || !page.bgImageUrl) return;
        if (isObjectUrl(page.bgImageUrl)) {
            URL.revokeObjectURL(page.bgImageUrl);
        }
        page.bgImageUrl = '';
    }

    function getImageIdsInUse() {
        return pages.reduce((set, page) => {
            if (page.bgImageId) set.add(page.bgImageId);
            return set;
        }, new Set());
    }

    async function cleanupImageIdIfUnused(imageId) {
        if (!imageId) return;
        const inUse = getImageIdsInUse();
        if (!inUse.has(imageId)) {
            await deleteImageBlob(imageId);
        }
    }

    async function hydratePageBgImage(page) {
        if (!page) return;
        if (page.bgImageUrl) return;
        if (page.bgImageId && db) {
            const blob = await getImageBlob(page.bgImageId);
            if (blob) {
                page.bgImageUrl = URL.createObjectURL(blob);
                page.bgImage = '';
                return;
            }
        }
        if (page.bgImage) {
            page.bgImageUrl = page.bgImage;
            return;
        }
        page.bgImageUrl = '';
    }

    async function ensureAllPageImages() {
        await Promise.all(pages.map(hydratePageBgImage));
    }

    // --- State Management ---
    function saveState() {
        const state = {
            pages: getPersistablePages(),
            activePageId,
            nextId
        };

        try {
            localStorage.setItem(APP_STATE_KEY, JSON.stringify(state));
        } catch (error) {
            console.warn('Could not save slideshow state to localStorage.', error);
        }
    }

    function loadState() {
        const savedState = localStorage.getItem(APP_STATE_KEY);
        if (savedState) {
            try {
                const state = JSON.parse(savedState);
                if (!state || !Array.isArray(state.pages)) {
                    throw new Error('Saved state is invalid.');
                }

                pages = state.pages.map(normalizePage);
                activePageId = pages.some(p => p.id === state.activePageId) ? state.activePageId : pages[0]?.id || null;
                nextId = typeof state.nextId === 'number' && state.nextId > 0
                    ? state.nextId
                    : Math.max(0, ...pages.map(p => p.id)) + 1;
            } catch (error) {
                console.warn('Failed to load saved state:', error);
                localStorage.removeItem(APP_STATE_KEY);
                pages = [];
                activePageId = null;
                nextId = 1;
                addPage(false);
            }
        } else {
            addPage(false);
        }
    }

    function getActivePage() {
        return pages.find(p => p.id === activePageId);
    }

    function saveCurrentPageText() {
        const activePage = getActivePage();
        if (!activePage) return;
        const textareas = getEditorTextAreas();
        activePage.texts = textareas.map(t => t.value);
        // saveState() is called by the parent function
    }

    function addPage(shouldSave = true) {
        saveCurrentPageText();
        const newPage = {
            id: nextId++,
            columns: 1,
            texts: ['這是第 1 欄的展示文字。'],
            gridTemplate: '1fr',
            bgColor: '#111111',
            textColor: '#ffffff',
            fontFamily: DEFAULT_FONT_FAMILY,
            fontSize: 4,
            bgImageId: '',
            bgImage: '',
            bgImageUrl: '',
            showSlideTextBg: false
        };
        pages.push(newPage);
        selectPage(newPage.id, shouldSave);
    }

    function selectPage(pageId, shouldSave = true) {
        if (activePageId === pageId && shouldSave) return;
        saveCurrentPageText();
        activePageId = pageId;
        renderApp();
        if (shouldSave) saveState();
    }

    async function deletePage(pageId) {
        if (pages.length <= 1) {
            alert("You must have at least one page.");
            return;
        }
        const deletedPage = pages.find(p => p.id === pageId);
        const deletedPageIndex = pages.findIndex(p => p.id === pageId);
        pages = pages.filter(p => p.id !== pageId);
        if (activePageId === pageId) {
            const newActivePage = pages[Math.max(0, deletedPageIndex - 1)];
            selectPage(newActivePage.id, false);
        }
        if (deletedPage?.bgImageId) {
            await cleanupImageIdIfUnused(deletedPage.bgImageId);
        }
        saveState();
        renderApp();
    }

    function renderEditor() {
        const activePage = getActivePage();
        if (!activePage) {
            inputContainer.innerHTML = '';
            return;
        }
        columnSelect.value = activePage.columns;
        updateColorPickerButtons();
        fontFamilySelect.value = activePage.fontFamily || DEFAULT_FONT_FAMILY;
        fontSizeSlider.value = activePage.fontSize || 4;
        fontSizeValue.textContent = `${(activePage.fontSize || 4).toFixed(1)} vw`;
        inputContainer.style.gridTemplateColumns = activePage.gridTemplate || `repeat(${activePage.columns}, minmax(0, 1fr))`;
        inputContainer.style.setProperty('--editor-columns', activePage.columns);
        inputContainer.innerHTML = '';
        updateSlideTextBgToggle(activePage.showSlideTextBg);
        for (let i = 0; i < activePage.columns; i++) {
            const textValue = activePage.texts[i] || '';
            const inputBox = document.createElement('div');
            inputBox.className = 'input-box';
            inputBox.innerHTML = `<label>第 ${i + 1} 欄內容</label><textarea id="text-input-${i}">${textValue}</textarea>`;
            if (i < activePage.columns - 1) {
                const handle = document.createElement('div');
                handle.className = 'editor-resize-handle';
                handle.dataset.handleIndex = i;
                handle.addEventListener('mousedown', initEditorResize);
                inputBox.appendChild(handle);
            }
            inputContainer.appendChild(inputBox);
        }
        updateEditorFontSize();
        updateEditorColors();
        updateEditorFontFamily();
        updateBackgroundImageControls();
    }

    function updateBackgroundImageControls() {
        const activePage = getActivePage();
        if (!activePage) return;
        bgImagePicker.value = '';
        const hasImage = Boolean(activePage.bgImageId || activePage.bgImageUrl || activePage.bgImage);
        bgImagePickerLabel.textContent = hasImage ? '已選擇' : '選擇';
        clearBgImageBtn.disabled = !hasImage;
        const imageUrl = activePage.bgImageUrl || activePage.bgImage || '';
        bgImagePreview.style.backgroundImage = imageUrl ? `url('${imageUrl}')` : 'none';
        bgImagePreview.classList.toggle('has-image', Boolean(imageUrl));
    }

    async function handleBgImageUpload(event) {
        const file = event.target.files && event.target.files[0];
        if (!file) return;

        const activePage = getActivePage();
        if (!activePage) return;
        saveCurrentPageText();

        const previousBgImageId = activePage.bgImageId;
        revokePageBgImageUrl(activePage);

        activePage.bgImageId = '';
        activePage.bgImage = '';
        activePage.bgImageUrl = URL.createObjectURL(file);

        if (db) {
            const imageId = generateImageId();
            const success = await saveImageBlob(imageId, file);
            if (success) {
                activePage.bgImageId = imageId;
                activePage.bgImage = '';
                await cleanupImageIdIfUnused(previousBgImageId);
            } else {
                activePage.bgImage = await fileToDataURL(file);
                alert('圖片已加載，但無法儲存到 IndexedDB，刷新後不保留。');
            }
        } else {
            activePage.bgImage = await fileToDataURL(file);
            if (file.size > MAX_IMAGE_STORAGE_BYTES) {
                alert('圖片過大，將只在目前工作階段顯示，重新整理後不會保留。');
            }
        }

        saveState();
        updateBackgroundImageControls();
    }

    async function clearBgImage() {
        const activePage = getActivePage();
        if (!activePage) return;
        const previousBgImageId = activePage.bgImageId;
        revokePageBgImageUrl(activePage);
        activePage.bgImageId = '';
        activePage.bgImage = '';
        activePage.bgImageUrl = '';
        await cleanupImageIdIfUnused(previousBgImageId);
        saveState();
        updateBackgroundImageControls();
    }

    function renderTabs() {
        tabManager.renderTabs(pages, activePageId);
    }

    function renderApp() {
        renderTabs();
        renderEditor();
    }

    // --- Event Listeners ---
    tabManager.addEventListener('page-added', () => addPage());
    tabManager.addEventListener('page-selected', e => selectPage(e.detail.pageId));
    tabManager.addEventListener('page-deleted', e => deletePage(e.detail.pageId));

    toggleControlsBtn.addEventListener('click', () => {
        const isCollapsed = controlsSection.classList.toggle('collapsed');
        
        // Update button text, icon, and accessibility attribute based on state
        toggleControlsBtn.setAttribute('aria-expanded', !isCollapsed);
        toggleControlsBtn.innerHTML = isCollapsed 
            ? '<span class="toggle-icon">▶</span> 展開設定' 
            : '<span class="toggle-icon">▼</span> 收起設定';
    });

    clearAllPagesBtn.addEventListener('click', async () => {
        // Show a confirmation dialog to prevent accidental clicks
        if (confirm('確定要清空所有頁面嗎？這將會刪除所有內容且無法復原。')) {
            
            // Clean up memory object URLs and IndexedDB images to prevent bloat
            for (const page of pages) {
                revokePageBgImageUrl(page);
                if (page.bgImageId) {
                    await deleteImageBlob(page.bgImageId);
                }
            }

            // Reset the application state
            pages = [];
            activePageId = null;
            nextId = 1;
            
            // Generate a fresh, default page and save the state
            addPage(true); 
        }
    });

    columnSelect.addEventListener('change', () => {
        const activePage = getActivePage();
        if (!activePage) return;
        saveCurrentPageText();
        const newColCount = parseInt(columnSelect.value);
        activePage.columns = newColCount;
        activePage.gridTemplate = `repeat(${newColCount}, minmax(0, 1fr))`;
        while (activePage.texts.length < newColCount) {
            activePage.texts.push(`這是第 ${activePage.texts.length + 1} 欄的展示文字。`);
        }
        while (activePage.texts.length > newColCount) {
            activePage.texts.pop();
        }
        renderEditor();
        saveState(); 
    });

    function updateColorPickerButtons() {
        const activePage = getActivePage();
        if (!activePage) return;
        bgColorPicker.value = activePage.bgColor;
        textColorPicker.value = activePage.textColor;
        bgColorSwatch.style.backgroundColor = activePage.bgColor;
        textColorSwatch.style.backgroundColor = activePage.textColor;
    }

    function handleColorChange() {
        const activePage = getActivePage();
        if (!activePage) return;
        activePage.bgColor = bgColorPicker.value;
        activePage.textColor = textColorPicker.value;
        updateColorPickerButtons();
        updateEditorColors();
        saveState();
    }

    bgColorButton.addEventListener('click', () => bgColorPicker.click());
    bgImageButton.addEventListener('click', () => bgImagePicker.click());
    clearBgImageBtn.addEventListener('click', clearBgImage);
    textColorButton.addEventListener('click', () => textColorPicker.click());
    bgColorPicker.addEventListener('input', handleColorChange);
    textColorPicker.addEventListener('input', handleColorChange);
    bgImagePicker.addEventListener('change', handleBgImageUpload);
    slideTextBgToggleBtn.addEventListener('click', () => {
        const activePage = getActivePage();
        if (!activePage) return;
        activePage.showSlideTextBg = !activePage.showSlideTextBg;
        updateSlideTextBgToggle(activePage.showSlideTextBg);
        saveState();
    });
    fontFamilySelect.addEventListener('change', () => {
        const activePage = getActivePage();
        if (!activePage) return;
        activePage.fontFamily = fontFamilySelect.value;
        updateEditorFontFamily();
        saveState();
    });
    fontSizeSlider.addEventListener('input', () => {
        const activePage = getActivePage();
        if (!activePage) return;
        activePage.fontSize = parseFloat(fontSizeSlider.value);
        updateEditorFontSize();
        saveState();
    });
    inputContainer.addEventListener('input', () => { saveCurrentPageText(); saveState(); });

    // --- Resizing Logic ---
    let activeHandle = null, initialX, initialWidths, handleIndex;
    function initEditorResize(e) {
        e.preventDefault();
        document.body.classList.add('resizing');
        activeHandle = e.currentTarget;
        activeHandle.classList.add('active');
        handleIndex = parseInt(activeHandle.dataset.handleIndex);
        const columns = Array.from(inputContainer.children);
        initialX = e.clientX;
        initialWidths = columns.map(c => c.getBoundingClientRect().width);
        window.addEventListener('mousemove', doEditorResize);
        window.addEventListener('mouseup', stopEditorResize);
    }
    function doEditorResize(e) {
        const deltaX = e.clientX - initialX;
        const newLeftWidth = initialWidths[handleIndex] + deltaX;
        const newRightWidth = initialWidths[handleIndex + 1] - deltaX;
        if (newLeftWidth < 50 || newRightWidth < 50) return;
        const newTemplate = initialWidths.map((w, i) => {
            if (i === handleIndex) return `${newLeftWidth}px`;
            if (i === handleIndex + 1) return `${newRightWidth}px`;
            return `${w}px`;
        }).join(' ');
        inputContainer.style.gridTemplateColumns = newTemplate;
    }
    function stopEditorResize() {
        const activePage = getActivePage();
        if (activePage) {
            activePage.gridTemplate = inputContainer.style.gridTemplateColumns;
            saveState(); 
        }
        document.body.classList.remove('resizing');
        if (activeHandle) activeHandle.classList.remove('active');
        activeHandle = null;
        window.removeEventListener('mousemove', doEditorResize);
        window.removeEventListener('mouseup', stopEditorResize);
    }

    // --- Slideshow & Style Logic ---
    function updateEditorColors() {
        const activePage = getActivePage();
        if (!activePage) return;
        getEditorTextAreas().forEach(textarea => {
            textarea.style.backgroundColor = activePage.bgColor;
            textarea.style.color = activePage.textColor;
        });
    }
    function updateEditorFontSize() {
        const activePage = getActivePage();
        if (!activePage) return;
        const newSize = activePage.fontSize || 4;
        fontSizeSlider.value = newSize;
        fontSizeValue.textContent = `${newSize.toFixed(1)} vw`;
        getEditorTextAreas().forEach(textarea => {
            textarea.style.fontSize = `${newSize}vw`;
        });
    }

    function updateEditorFontFamily() {
        const activePage = getActivePage();
        if (!activePage) return;
        getEditorTextAreas().forEach(textarea => {
            textarea.style.fontFamily = activePage.fontFamily || DEFAULT_FONT_FAMILY;
        });
    }

    function updateSlideTextBgToggle(isEnabled) {
        if (!slideTextBgToggleBtn) return;
        slideTextBgToggleBtn.classList.toggle('active', Boolean(isEnabled));
        slideTextBgToggleBtn.textContent = isEnabled ? '啟用' : '關閉';
        slideTextBgToggleBtn.setAttribute('aria-pressed', isEnabled ? 'true' : 'false');
    }

    function renderSlideshowPage(page) {
        const pageIndex = pages.findIndex(p => p.id === page.id);
        slidePageIndicator.textContent = `第 ${pageIndex + 1} / ${pages.length} 頁`;

        const fontSize = page.fontSize || 4;
        slideshowScreen.style.setProperty('--slideshow-font-size', `${fontSize}vw`);
        slideshowScreen.style.setProperty('--slideshow-font-family', page.fontFamily || DEFAULT_FONT_FAMILY);
        slideshowScreen.style.setProperty('--slideshow-bg', page.bgColor);
        slideshowScreen.style.setProperty('--slideshow-text-color', page.textColor);
        const imageUrl = page.bgImageUrl || page.bgImage || '';
        slideshowScreen.style.backgroundImage = imageUrl ? `url('${imageUrl}')` : 'none';
        slideshowRenderArea.style.gridTemplateColumns = page.gridTemplate || `repeat(${page.columns}, 1fr)`;
        slideshowRenderArea.innerHTML = '';
        page.texts.forEach(text => {
            const columnWrapper = document.createElement('div');
            columnWrapper.className = 'slide-column';
            const textElement = document.createElement('div');
            textElement.className = `slide-text${page.showSlideTextBg ? ' slide-text--with-bg' : ''}`;
            textElement.textContent = text;
            columnWrapper.appendChild(textElement);
            slideshowRenderArea.appendChild(columnWrapper);
        });
    }

    function changeSlide(direction) {
        const currentIndex = pages.findIndex(p => p.id === activePageId);
        let nextIndex = (direction === 'next') ? currentIndex + 1 : currentIndex - 1;
        if (nextIndex >= pages.length) nextIndex = 0; // Loop to start
        if (nextIndex < 0) nextIndex = pages.length - 1; // Loop to end
        
        activePageId = pages[nextIndex].id;
        renderSlideshowPage(getActivePage());
        saveState();
    }

    let touchStartX = 0;
    let touchStartY = 0;
    let touchEndX = 0;
    let touchEndY = 0;

    function handleSlideshowTouchStart(event) {
        if (event.touches.length !== 1) return;
        touchStartX = event.touches[0].clientX;
        touchStartY = event.touches[0].clientY;
        touchEndX = touchStartX;
        touchEndY = touchStartY;
    }

    function handleSlideshowTouchMove(event) {
        if (event.touches.length !== 1) return;
        touchEndX = event.touches[0].clientX;
        touchEndY = event.touches[0].clientY;
    }

    function handleSlideshowTouchEnd() {
        const deltaX = touchEndX - touchStartX;
        const deltaY = touchEndY - touchStartY;
        const absDeltaX = Math.abs(deltaX);
        const absDeltaY = Math.abs(deltaY);
        const swipeThreshold = 40;

        if (absDeltaX > swipeThreshold && absDeltaX > absDeltaY) {
            if (deltaX > 0) {
                changeSlide('prev');
            } else {
                changeSlide('next');
            }
        }
    }

    startBtn.addEventListener('click', () => {
        const activePage = getActivePage();
        if (!activePage) return;
        renderSlideshowPage(activePage);
        slideshowScreen.style.display = 'flex';
        document.documentElement.requestFullscreen?.();
    });

    slideshowScreen.addEventListener('click', (e) => {
        if (e.target === slideshowScreen) exitSlideshow();
    });

    prevSlideBtn.addEventListener('click', () => changeSlide('prev'));
    nextSlideBtn.addEventListener('click', () => changeSlide('next'));
    exitSlideshowBtn.addEventListener('click', exitSlideshow);
    slideshowScreen.addEventListener('touchstart', handleSlideshowTouchStart, { passive: true });
    slideshowScreen.addEventListener('touchmove', handleSlideshowTouchMove, { passive: true });
    slideshowScreen.addEventListener('touchend', handleSlideshowTouchEnd);

    document.addEventListener('keydown', (e) => {
        if (slideshowScreen.style.display === 'flex') {
            if (e.key === 'ArrowLeft') changeSlide('prev');
            if (e.key === 'ArrowRight') changeSlide('next');
            if (e.key === 'Escape') exitSlideshow();
        }
    });

    function exitSlideshow() {
        slideshowScreen.style.display = 'none';
        document.exitFullscreen?.();
        renderApp(); // Sync editor to the last viewed slide
    }

    async function initApp() {
        db = await openDatabase();
        loadState();
        await ensureAllPageImages();
        renderApp();
    }

    // --- Init ---
    initApp();
});
