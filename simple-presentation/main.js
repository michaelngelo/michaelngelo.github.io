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
    const prevSlideBtn = document.getElementById('prev-slide-btn');
    const nextSlideBtn = document.getElementById('next-slide-btn');
    const exitSlideshowBtn = document.getElementById('exit-slideshow-btn');
    const slidePageIndicator = document.getElementById('slide-page-indicator');
    
    const APP_STATE_KEY = 'textSlideshowState';
    const DEFAULT_FONT_FAMILY = '"Noto Serif HK", serif';

    let pages = [];
    let activePageId = null;
    let nextId = 1;

    function getEditorTextAreas() {
        return Array.from(inputContainer.querySelectorAll('textarea'));
    }

    // --- State Management ---
    function saveState() {
        const state = {
            pages,
            activePageId,
            nextId
        };
        localStorage.setItem(APP_STATE_KEY, JSON.stringify(state));
    }

    function loadState() {
        const savedState = localStorage.getItem(APP_STATE_KEY);
        if (savedState) {
            const state = JSON.parse(savedState);
            pages = state.pages;
            activePageId = state.activePageId;
            nextId = state.nextId;
            pages.forEach(p => {
                if (!p.bgColor) p.bgColor = '#111111';
                if (!p.textColor) p.textColor = '#ffffff';
                if (!p.fontFamily) p.fontFamily = DEFAULT_FONT_FAMILY;
                if (!p.fontSize) p.fontSize = 3;
                if (typeof p.bgImage === 'undefined' || p.bgImage === null) p.bgImage = '';
            });
        } else {
            addPage(false);
        }
        renderApp();
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
            columns: 2,
            texts: ['這是第 1 欄的展示文字。', '這是第 2 欄的展示文字。'],
            gridTemplate: 'repeat(2, 1fr)',
            bgColor: '#111111',
            textColor: '#ffffff',
            fontFamily: DEFAULT_FONT_FAMILY,
            fontSize: 3,
            bgImage: ''
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

    function deletePage(pageId) {
        if (pages.length <= 1) {
            alert("You must have at least one page.");
            return;
        }
        const deletedPageIndex = pages.findIndex(p => p.id === pageId);
        pages = pages.filter(p => p.id !== pageId);
        if (activePageId === pageId) {
            const newActivePage = pages[Math.max(0, deletedPageIndex - 1)];
            selectPage(newActivePage.id, false);
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
        fontSizeSlider.value = activePage.fontSize || 3;
        fontSizeValue.textContent = `${(activePage.fontSize || 3).toFixed(1)} rem`;
        inputContainer.style.gridTemplateColumns = activePage.gridTemplate || `repeat(${activePage.columns}, minmax(0, 1fr))`;
        inputContainer.style.setProperty('--editor-columns', activePage.columns);
        inputContainer.innerHTML = '';
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
        bgImagePickerLabel.textContent = activePage.bgImage ? '已選擇' : '選擇';
        clearBgImageBtn.disabled = !activePage.bgImage;
        bgImagePreview.style.backgroundImage = activePage.bgImage ? `url('${activePage.bgImage}')` : 'none';
        bgImagePreview.classList.toggle('has-image', Boolean(activePage.bgImage));
    }

    function handleBgImageUpload(event) {
        const file = event.target.files && event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = () => {
            const activePage = getActivePage();
            if (!activePage) return;
            activePage.bgImage = reader.result;
            saveState();
            updateBackgroundImageControls();
        };
        reader.readAsDataURL(file);
    }

    function clearBgImage() {
        const activePage = getActivePage();
        if (!activePage) return;
        activePage.bgImage = '';
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
        const newSize = activePage.fontSize || 3;
        fontSizeSlider.value = newSize;
        fontSizeValue.textContent = `${newSize.toFixed(1)} rem`;
        getEditorTextAreas().forEach(textarea => {
            textarea.style.fontSize = `${newSize}rem`;
        });
    }

    function updateEditorFontFamily() {
        const activePage = getActivePage();
        if (!activePage) return;
        getEditorTextAreas().forEach(textarea => {
            textarea.style.fontFamily = activePage.fontFamily || DEFAULT_FONT_FAMILY;
        });
    }

    function renderSlideshowPage(page) {
        const pageIndex = pages.findIndex(p => p.id === page.id);
        slidePageIndicator.textContent = `第 ${pageIndex + 1} / ${pages.length} 頁`;

        const fontSize = page.fontSize || 3;
        slideshowScreen.style.setProperty('--slideshow-font-size', `${fontSize}rem`);
        slideshowScreen.style.setProperty('--slideshow-font-family', page.fontFamily || DEFAULT_FONT_FAMILY);
        slideshowScreen.style.setProperty('--slideshow-bg', page.bgColor);
        slideshowScreen.style.setProperty('--slideshow-text-color', page.textColor);
        slideshowScreen.style.backgroundImage = page.bgImage ? `url('${page.bgImage}')` : 'none';
        slideshowRenderArea.style.gridTemplateColumns = page.gridTemplate || `repeat(${page.columns}, 1fr)`;
        slideshowRenderArea.innerHTML = '';
        page.texts.forEach(text => {
            const columnWrapper = document.createElement('div');
            columnWrapper.className = 'slide-column';
            const textElement = document.createElement('div');
            textElement.className = 'slide-text';
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

    // --- Init ---
    loadState(); 
});
