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
