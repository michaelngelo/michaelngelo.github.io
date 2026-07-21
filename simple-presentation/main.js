// Translation Dictionary
const i18n = {
    'zh-Hant': {
        appTitle: '文字幻燈片展示器',
        settingsBtn: '設定',
        enterSlideshow: '▶ 進入幻燈片',
        clearAllPages: '🗑️ 清空所有頁面',
        settingsTitle: '設定區',
        layoutAndText: '版面與文字',
        columnsLabel: '欄位數量:',
        fontFamilyLabel: '字體樣式:',
        fontSizeLabel: '字體大小:',
        bgAndColor: '背景與顏色',
        bgColorLabel: '背景顏色:',
        textColorLabel: '文字顏色:',
        bgImageLabel: '背景圖片:',
        slideTextBgLabel: '文字背景:',
        selectBtn: '選擇',
        selectedBtn: '已選擇',
        clearBtn: '清除',
        toggleOn: '啟用',
        toggleOff: '關閉',
        columnLabel: '第 {num} 欄內容',
        defaultText: '這是第 {num} 欄的展示文字。',
        pageIndicator: '第 {current} / {total} 頁',
        deletePageTooltip: '刪除頁面',
        exitSlideshowTooltip: '關閉幻燈片',
        confirmClearAll: '確定要清空所有頁面嗎？這將會刪除所有內容且無法復原。',
        alertAtLeastOnePage: '至少需要保留一個頁面！',
        optgroupStandard: '線上字型 - 襯線/黑體 (Standard)',
        optgroupHandwriting: '線上字型 - 楷體/手寫 (Handwriting)',
        optgroupBrush: '線上字型 - 毛筆/行草 (Brush/Cursive)',
        optgroupDisplay: '線上字型 - 藝術/趣味 (Display)',
        optgroupSystem: '系統字型 (System Fonts)',
        pageDefaultName: '頁面'
    },
    'en': {
        appTitle: 'Text Slideshow Presenter',
        settingsBtn: 'Settings',
        enterSlideshow: '▶ Enter Slideshow',
        clearAllPages: '🗑️ Clear All Pages',
        settingsTitle: 'Settings',
        layoutAndText: 'Layout & Typography',
        columnsLabel: 'Columns:',
        fontFamilyLabel: 'Font Family:',
        fontSizeLabel: 'Font Size:',
        bgAndColor: 'Background & Color',
        bgColorLabel: 'Background Color:',
        textColorLabel: 'Text Color:',
        bgImageLabel: 'Background Image:',
        slideTextBgLabel: 'Text Background:',
        selectBtn: 'Select',
        selectedBtn: 'Selected',
        clearBtn: 'Clear',
        toggleOn: 'On',
        toggleOff: 'Off',
        columnLabel: 'Column {num} Content',
        defaultText: 'This is presentation text for column {num}.',
        pageIndicator: 'Page {current} of {total}',
        deletePageTooltip: 'Delete Page',
        exitSlideshowTooltip: 'Exit Slideshow',
        confirmClearAll: 'Are you sure you want to clear all pages? This will delete all content and cannot be undone.',
        alertAtLeastOnePage: 'At least one page must be kept!',
        optgroupStandard: 'Online Fonts - Serif / Sans (Standard)',
        optgroupHandwriting: 'Online Fonts - Handwriting',
        optgroupBrush: 'Online Fonts - Brush / Cursive',
        optgroupDisplay: 'Online Fonts - Display',
        optgroupSystem: 'System Fonts',
        pageDefaultName: 'Page'
    }
};

let currentLang = localStorage.getItem('appLanguage') || 'zh-Hant';

function t(key, params = {}) {
    let text = i18n[currentLang]?.[key] || i18n['zh-Hant'][key] || key;
    Object.keys(params).forEach(p => {
        text = text.replace(`{${p}}`, params[p]);
    });
    return text;
}

class TabManager extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          max-height: 100%;
        }
        .tabs-container {
          display: flex;
          flex-direction: column;
          align-items: stretch;
          gap: 8px;
          padding: 12px;
          background: rgba(255, 255, 255, 0.84);
          border: 1px solid rgba(15, 23, 42, 0.08);
          border-radius: 16px;
          max-height: 100%;
          overflow-y: auto;
          overflow-x: hidden;
          box-shadow: 0 8px 24px rgba(15, 23, 42, 0.06);
        }
        .tab {
          flex: 0 0 auto;
          min-width: 0;
          padding: 10px 12px;
          cursor: grab;
          border-radius: 12px;
          background: linear-gradient(135deg, rgba(255,255,255,0.95), rgba(248,250,252,0.95));
          border: 1px solid rgba(15, 23, 42, 0.08);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          color: #334155;
          font-weight: 600;
          transition: background 0.2s ease, box-shadow 0.2s ease;
          user-select: none;
        }
        .tab:active {
          cursor: grabbing;
        }
        .tab.active {
          background: linear-gradient(135deg, #5b7cff, #4a65d8);
          color: white;
          border-color: transparent;
          box-shadow: 0 8px 18px rgba(91, 124, 255, 0.24);
        }
        .tab.dragging {
          opacity: 0.5;
          transform: scale(0.98);
        }
        .tab-label {
          flex: 1;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          outline: none;
          padding: 2px 4px;
          border-radius: 4px;
          cursor: text;
          min-width: 40px;
        }
        .tab-label:focus {
          background: rgba(0, 0, 0, 0.05);
          color: #000;
        }
        .tab.active .tab-label:focus {
          background: rgba(255, 255, 255, 0.2);
          color: #fff;
        }
        .delete-page-btn {
          border: none;
          background: none;
          cursor: pointer;
          font-size: 16px;
          padding: 0 4px;
          line-height: 1;
          color: inherit;
          opacity: 0.6;
          transition: opacity 0.2s ease;
        }
        .delete-page-btn:hover {
          opacity: 1;
          color: #ef4444;
        }
        .tab.active .delete-page-btn:hover {
          color: #ffb3b3;
        }
        .add-page-btn {
          flex: 0 0 auto;
          padding: 12px;
          font-size: 16px;
          font-weight: bold;
          border: none;
          border-radius: 12px;
          background: linear-gradient(135deg, #5b7cff, #4a65d8);
          color: white;
          cursor: pointer;
          box-shadow: 0 8px 18px rgba(91, 124, 255, 0.22);
        }
        @media (max-width: 900px) {
          .tabs-container {
            flex-direction: row;
            overflow-x: auto;
            border-radius: 12px;
            padding: 8px;
            gap: 6px;
          }
          .tab {
            padding: 8px 12px;
            border-radius: 10px;
            font-size: 0.9rem;
          }
          .add-page-btn {
            border-radius: 10px;
            padding: 8px 14px;
          }
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

        this.tabsContainer.addEventListener('dragover', (e) => {
            e.preventDefault();
            const draggingTab = this.tabsContainer.querySelector('.dragging');
            if (!draggingTab) return;

            const siblings = [...this.tabsContainer.querySelectorAll('.tab:not(.dragging)')];
            const nextSibling = siblings.find(sibling => {
                const box = sibling.getBoundingClientRect();
                const isHorizontal = window.innerWidth <= 900;
                if (isHorizontal) {
                    return e.clientX <= box.left + box.width / 2;
                } else {
                    return e.clientY <= box.top + box.height / 2;
                }
            });

            if (nextSibling) {
                this.tabsContainer.insertBefore(draggingTab, nextSibling);
            } else {
                this.tabsContainer.insertBefore(draggingTab, this.addPageBtn);
            }
        });

        this.tabsContainer.addEventListener('drop', (e) => {
            e.preventDefault();
            const tabs = [...this.tabsContainer.querySelectorAll('.tab')];
            const newOrder = tabs.map(tab => parseInt(tab.dataset.pageId));
            this.dispatchEvent(new CustomEvent('page-reordered', { detail: { newOrder } }));
        });
    }

    renderTabs(pages, activePageId) {
        while (this.tabsContainer.firstChild && this.tabsContainer.firstChild !== this.addPageBtn) {
            this.tabsContainer.removeChild(this.tabsContainer.firstChild);
        }

        pages.forEach(page => {
            const tab = document.createElement('div');
            tab.className = 'tab';
            tab.dataset.pageId = page.id;
            tab.draggable = true;

            if (page.id === activePageId) {
                tab.classList.add('active');
            }

            const labelSpan = document.createElement('span');
            labelSpan.className = 'tab-label';
            labelSpan.textContent = page.name || `${t('pageDefaultName')} ${page.id}`;
            labelSpan.contentEditable = "true";
            labelSpan.spellcheck = false;

            labelSpan.addEventListener('mousedown', (e) => e.stopPropagation());

            const saveName = () => {
                const newName = labelSpan.textContent.trim() || `${t('pageDefaultName')} ${page.id}`;
                labelSpan.textContent = newName;
                this.dispatchEvent(new CustomEvent('page-renamed', {
                    detail: { pageId: page.id, newName }
                }));
            };

            labelSpan.addEventListener('blur', saveName);
            labelSpan.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    labelSpan.blur();
                }
            });

            tab.addEventListener('dragstart', (e) => {
                tab.classList.add('dragging');
                e.dataTransfer.setData('text/plain', page.id);
                e.dataTransfer.effectAllowed = 'move';
            });

            tab.addEventListener('dragend', () => {
                tab.classList.remove('dragging');
            });

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-page-btn';
            deleteBtn.textContent = '×';
            deleteBtn.title = t('deletePageTooltip');
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.dispatchEvent(new CustomEvent('page-deleted', { detail: { pageId: page.id } }));
            });

            tab.appendChild(labelSpan);
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
    const langToggleBtn = document.getElementById('lang-toggle-btn');
    const langText = document.getElementById('lang-text');

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

    function updateLanguageUI() {
        document.documentElement.lang = currentLang;
        langText.textContent = currentLang === 'zh-Hant' ? 'English' : '繁體中文';

        // Translate elements with data-i18n
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (key) el.textContent = t(key);
        });

        // Translate optgroups
        const optgroupMap = {
            'optgroup-standard': 'optgroupStandard',
            'optgroup-handwriting': 'optgroupHandwriting',
            'optgroup-brush': 'optgroupBrush',
            'optgroup-display': 'optgroupDisplay',
            'optgroup-system': 'optgroupSystem'
        };
        Object.entries(optgroupMap).forEach(([id, key]) => {
            const group = document.getElementById(id);
            if (group) group.label = t(key);
        });

        exitSlideshowBtn.title = t('exitSlideshowTooltip');
        exitSlideshowBtn.setAttribute('aria-label', t('exitSlideshowTooltip'));

        renderApp();
    }

    langToggleBtn.addEventListener('click', () => {
        currentLang = currentLang === 'zh-Hant' ? 'en' : 'zh-Hant';
        localStorage.setItem('appLanguage', currentLang);
        updateLanguageUI();
    });

    function getEditorTextAreas() {
        return Array.from(inputContainer.querySelectorAll('textarea'));
    }

    function normalizePage(page) {
        return {
            id: typeof page.id === 'number' ? page.id : nextId++,
            name: typeof page.name === 'string' ? page.name : `${t('pageDefaultName')} ${page.id || nextId}`,
            columns: Number.isInteger(page.columns) && page.columns > 0 ? page.columns : 1,
            texts: Array.isArray(page.texts) ? page.texts.map(value => String(value)) : [''],
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
        if (!isIndexedDBSupported) return null;
        return new Promise(resolve => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            request.onupgradeneeded = event => {
                const database = event.target.result;
                if (!database.objectStoreNames.contains(BG_IMAGES_STORE)) {
                    database.createObjectStore(BG_IMAGES_STORE);
                }
            };
            request.onsuccess = event => resolve(event.target.result);
            request.onerror = () => resolve(null);
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
            request.onerror = () => resolve(false);
        });
    }

    async function getImageBlob(imageId) {
        if (!db || !imageId) return null;
        return new Promise(resolve => {
            const transaction = db.transaction(BG_IMAGES_STORE, 'readonly');
            const request = transaction.objectStore(BG_IMAGES_STORE).get(imageId);
            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => resolve(null);
        });
    }

    async function deleteImageBlob(imageId) {
        if (!db || !imageId) return false;
        return new Promise(resolve => {
            const transaction = db.transaction(BG_IMAGES_STORE, 'readwrite');
            const request = transaction.objectStore(BG_IMAGES_STORE).delete(imageId);
            request.onsuccess = () => resolve(true);
            request.onerror = () => resolve(false);
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

    function saveState() {
        const state = {
            pages: getPersistablePages(),
            activePageId,
            nextId
        };
        try {
            localStorage.setItem(APP_STATE_KEY, JSON.stringify(state));
        } catch (error) {
            console.warn('Could not save state to localStorage.', error);
        }
    }

    function loadState() {
        const savedState = localStorage.getItem(APP_STATE_KEY);
        if (savedState) {
            try {
                const state = JSON.parse(savedState);
                if (!state || !Array.isArray(state.pages)) throw new Error('Saved state is invalid.');
                pages = state.pages.map(normalizePage);
                activePageId = pages.some(p => p.id === state.activePageId) ? state.activePageId : pages[0]?.id || null;
                nextId = typeof state.nextId === 'number' && state.nextId > 0
                    ? state.nextId
                    : Math.max(0, ...pages.map(p => p.id)) + 1;
            } catch (error) {
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
    }

    function addPage(shouldSave = true) {
        saveCurrentPageText();
        const newId = nextId++;
        const newPage = {
            id: newId,
            name: `${t('pageDefaultName')} ${newId}`,
            columns: 1,
            texts: [t('defaultText', { num: 1 })],
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
            alert(t('alertAtLeastOnePage'));
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
            inputBox.innerHTML = `<label>${t('columnLabel', { num: i + 1 })}</label><textarea id="text-input-${i}">${textValue}</textarea>`;
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
        bgImagePickerLabel.textContent = hasImage ? t('selectedBtn') : t('selectBtn');
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
            }
        } else {
            activePage.bgImage = await fileToDataURL(file);
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

    tabManager.addEventListener('page-added', () => addPage(true));
    tabManager.addEventListener('page-selected', e => selectPage(e.detail.pageId, true));
    tabManager.addEventListener('page-deleted', e => deletePage(e.detail.pageId));

    tabManager.addEventListener('page-renamed', (e) => {
        const page = pages.find(p => p.id === e.detail.pageId);
        if (page) {
            page.name = e.detail.newName;
            saveState();
        }
    });

    tabManager.addEventListener('page-reordered', (e) => {
        const newOrder = e.detail.newOrder;
        pages = newOrder.map(id => pages.find(p => p.id === id)).filter(Boolean);
        saveState();
        renderTabs();
    });

    toggleControlsBtn.addEventListener('click', () => {
        const isCollapsed = controlsSection.classList.toggle('collapsed');
        toggleControlsBtn.setAttribute('aria-expanded', !isCollapsed);
        const icon = toggleControlsBtn.querySelector('.toggle-icon');
        if (icon) icon.textContent = isCollapsed ? '▲' : '▼';
    });

    clearAllPagesBtn.addEventListener('click', async () => {
        if (confirm(t('confirmClearAll'))) {
            for (const page of pages) {
                revokePageBgImageUrl(page);
                if (page.bgImageId) await deleteImageBlob(page.bgImageId);
            }
            pages = [];
            activePageId = null;
            nextId = 1;
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
            activePage.texts.push(t('defaultText', { num: activePage.texts.length + 1 }));
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
        slideTextBgToggleBtn.textContent = isEnabled ? t('toggleOn') : t('toggleOff');
        slideTextBgToggleBtn.setAttribute('aria-pressed', isEnabled ? 'true' : 'false');
    }

    function renderSlideshowPage(page) {
        const pageIndex = pages.findIndex(p => p.id === page.id);
        slidePageIndicator.textContent = t('pageIndicator', { current: pageIndex + 1, total: pages.length });

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
        if (nextIndex >= pages.length) nextIndex = 0;
        if (nextIndex < 0) nextIndex = pages.length - 1;

        activePageId = pages[nextIndex].id;
        renderSlideshowPage(getActivePage());
        saveState();
    }

    let touchStartX = 0, touchStartY = 0, touchEndX = 0, touchEndY = 0;

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
            if (deltaX > 0) changeSlide('prev');
            else changeSlide('next');
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
        renderApp();
    }

    async function initApp() {
        db = await openDatabase();
        loadState();
        await ensureAllPageImages();
        updateLanguageUI();
    }

    initApp();
});