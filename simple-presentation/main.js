class TabManager extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.innerHTML = `
      <style>
        .tabs-container {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px;
          background-color: #e9ecef;
          border-radius: 8px;
          margin-bottom: 16px;
          overflow-x: auto;
          overflow-y: hidden;
          flex-wrap: nowrap;
          scrollbar-width: thin;
        }
        .tabs-container::-webkit-scrollbar {
          height: 8px;
        }
        .tabs-container::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 999px;
        }
        .tab {
          flex: 0 0 auto;
          min-width: 0;
          padding: 8px 16px;
          cursor: pointer;
          border-radius: 6px;
          background-color: #f8f9fa;
          border: 1px solid #dee2e6;
          display: flex;
          align-items: center;
          gap: 8px;
          white-space: nowrap;
        }
        .tab.active {
          background-color: #ffffff;
          border-bottom-color: #ffffff;
          font-weight: bold;
        }
        .delete-page-btn {
          border: none;
          background: none;
          cursor: pointer;
          font-size: 16px;
          padding: 0;
          line-height: 1;
        }
        .add-page-btn {
          flex: 0 0 auto;
          padding: 8px 12px;
          font-size: 16px;
          font-weight: bold;
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
