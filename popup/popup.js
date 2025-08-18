/**
 * Popup script for Fields Autofill extension
 */
class PopupManager {
  constructor() {
    this.currentTab = null;
    this.init();
  }

  /**
   * Initialize popup
   */
  async init() {
    console.log('Popup: Initializing...');
    
    // Get current tab
    await this.getCurrentTab();
    
    // Setup event listeners
    this.setupEventListeners();
    
    // Load initial data
    await this.loadCurrentPageData();
    
    console.log('Popup: Initialized');
  }

  /**
   * Get current active tab
   */
  async getCurrentTab() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      this.currentTab = tab;
    } catch (error) {
      console.error('Error getting current tab:', error);
    }
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Tab switching
    document.querySelectorAll('.tab-button').forEach(button => {
      button.addEventListener('click', (e) => {
        const tabId = e.target.dataset.tab;
        this.switchTab(tabId);
      });
    });

    // Clear page data button
    document.getElementById('clear-page-btn').addEventListener('click', () => {
      this.clearPageData();
    });

    // Clear all data button
    document.getElementById('clear-all-btn').addEventListener('click', () => {
      this.clearAllData();
    });
  }

  /**
   * Switch between tabs
   * @param {string} tabId - Tab identifier
   */
  async switchTab(tabId) {
    // Update tab buttons
    document.querySelectorAll('.tab-button').forEach(button => {
      button.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabId}"]`).classList.add('active');

    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.add('hidden');
    });
    document.getElementById(`${tabId}-tab`).classList.remove('hidden');

    // Load tab data
    if (tabId === 'current') {
      await this.loadCurrentPageData();
    } else if (tabId === 'all') {
      await this.loadAllSitesData();
    }
  }

  /**
   * Load current page data
   */
  async loadCurrentPageData() {
    try {
      if (!this.currentTab) {
        document.getElementById('current-url').textContent = 'No active tab';
        return;
      }

      const currentUrl = this.getCurrentPageUrl(this.currentTab.url);
      document.getElementById('current-url').textContent = currentUrl;

      // Get saved data for current page
      const result = await chrome.storage.local.get([currentUrl]);
      const pageData = result[currentUrl] || {};

      this.renderCurrentPageFields(pageData);
    } catch (error) {
      console.error('Error loading current page data:', error);
      document.getElementById('current-fields').innerHTML = 
        '<div class="empty">Error loading data</div>';
    }
  }

  /**
   * Load all sites data
   */
  async loadAllSitesData() {
    try {
      const allData = await chrome.storage.local.get(null);
      this.renderAllSitesData(allData);
    } catch (error) {
      console.error('Error loading all sites data:', error);
      document.getElementById('all-sites').innerHTML = 
        '<div class="empty">Error loading data</div>';
    }
  }

  /**
   * Render current page fields
   * @param {Object} pageData - Page field data
   */
  renderCurrentPageFields(pageData) {
    const container = document.getElementById('current-fields');
    
    if (Object.keys(pageData).length === 0) {
      container.innerHTML = `
        <div class="empty">
          <div class="empty-icon">📝</div>
          <p>No saved fields for this page</p>
          <p>Right-click on input fields to save values</p>
        </div>
      `;
      return;
    }

    const fieldsHtml = Object.entries(pageData).map(([fieldId, fieldData], index) => {
      // Handle both legacy strings and new object format
      const isAdvancedFormat = typeof fieldData === 'object' && fieldData !== null;
      
      // Extract the actual value
      const value = isAdvancedFormat ? fieldData.value : fieldData;
      
      // Generate friendly name from selectors if available
      let friendlyName = fieldId;
      if (isAdvancedFormat && fieldData.selectors) {
        // Try to generate a human-readable field name
        if (fieldData.selectors.primary) {
          const match = fieldData.selectors.primary.match(/\[(name|aria-label|placeholder|type)="([^"]+)"\]/i);
          if (match) {
            friendlyName = `${match[1]}: ${match[2]}`;
          }
        }
        
        // Add confidence indicator
        const confidence = fieldData.confidence ? Math.round(fieldData.confidence * 100) : '?';
        friendlyName += ` (${confidence}% match)`;
      }
      
      return `
      <div class="field-item" data-field-id="${this.escapeHtml(fieldId)}">
        <div class="field-id">${this.escapeHtml(friendlyName)}</div>
        <div class="field-value">${this.escapeHtml(value)}</div>
        <div class="field-actions">
          <button class="btn btn-small btn-primary edit-field-btn" data-field-id="${this.escapeHtml(fieldId)}" data-current-value="${this.escapeHtml(value)}">
            Edit
          </button>
          <button class="btn btn-small btn-danger delete-field-btn" data-field-id="${this.escapeHtml(fieldId)}">
            Delete
          </button>
        </div>
      </div>
    `;
    }).join('');

    container.innerHTML = fieldsHtml;
    
    // Add event listeners for edit and delete buttons
    this.addFieldButtonListeners();
  }

  /**
   * Render all sites data
   * @param {Object} allData - All saved data
   */
  renderAllSitesData(allData) {
    const container = document.getElementById('all-sites');
    
    const sites = Object.keys(allData);
    if (sites.length === 0) {
      container.innerHTML = `
        <div class="empty">
          <div class="empty-icon">🌐</div>
          <p>No saved data</p>
          <p>Start using autofill to see saved sites here</p>
        </div>
      `;
      return;
    }

    const sitesHtml = sites.map(site => {
      const siteData = allData[site];
      const fieldCount = Object.keys(siteData).length;
      
      return `
        <div class="site-item">
          <div class="site-url">
            ${this.escapeHtml(site)}
            <span class="field-count">(${fieldCount} fields)</span>
          </div>
          <div class="site-actions">
            <button class="btn btn-small btn-danger delete-site-btn" data-site-url="${this.escapeHtml(site)}">
              Delete Site
            </button>
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = sitesHtml;
    
    // Add event listeners for delete site buttons
    this.addSiteButtonListeners();
  }

  /**
   * Add event listeners for field buttons (edit/delete)
   */
  addFieldButtonListeners() {
    // Edit button listeners
    document.querySelectorAll('.edit-field-btn').forEach(button => {
      button.addEventListener('click', async (e) => {
        const fieldId = e.target.dataset.fieldId;
        const currentValue = e.target.dataset.currentValue;
        await this.editField(fieldId, currentValue);
      });
    });
    
    // Delete button listeners
    document.querySelectorAll('.delete-field-btn').forEach(button => {
      button.addEventListener('click', async (e) => {
        const fieldId = e.target.dataset.fieldId;
        await this.deleteField(fieldId);
      });
    });
  }

  /**
   * Add event listeners for site buttons (delete)
   */
  addSiteButtonListeners() {
    document.querySelectorAll('.delete-site-btn').forEach(button => {
      button.addEventListener('click', async (e) => {
        const siteUrl = e.target.dataset.siteUrl;
        await this.deleteSite(siteUrl);
      });
    });
  }

  /**
   * Edit field value
   * @param {string} fieldId - Field identifier
   * @param {string} currentValue - Current field value
   */
  async editField(fieldId, currentValue) {
    const newValue = prompt('Enter new value:', currentValue);
    
    if (newValue !== null && this.currentTab) {
      const currentUrl = this.getCurrentPageUrl(this.currentTab.url);
      
      if (newValue.trim() === '') {
        // Remove field if empty
        await this.removeFieldFromStorage(currentUrl, fieldId);
      } else {
        // Update field value
        await this.updateFieldInStorage(currentUrl, fieldId, newValue);
      }
      
      // Reload current page data
      await this.loadCurrentPageData();
    }
  }

  /**
   * Delete field
   * @param {string} fieldId - Field identifier
   */
  async deleteField(fieldId) {
    if (confirm('Are you sure you want to delete this field?') && this.currentTab) {
      const currentUrl = this.getCurrentPageUrl(this.currentTab.url);
      await this.removeFieldFromStorage(currentUrl, fieldId);
      
      // Reload current page data
      await this.loadCurrentPageData();
    }
  }

  /**
   * Delete entire site data
   * @param {string} site - Site URL
   */
  async deleteSite(site) {
    if (confirm(`Are you sure you want to delete all data for:\n${site}`)) {
      try {
        await chrome.storage.local.remove([site]);
        console.log(`Deleted data for site: ${site}`);
        
        // Reload all sites data
        await this.loadAllSitesData();
        
        // If we deleted current page, reload current tab too
        if (this.currentTab && this.getCurrentPageUrl(this.currentTab.url) === site) {
          await this.loadCurrentPageData();
        }
      } catch (error) {
        console.error('Error deleting site data:', error);
        alert('Error deleting site data');
      }
    }
  }

  /**
   * Clear current page data
   */
  async clearPageData() {
    if (!this.currentTab) return;
    
    const currentUrl = this.getCurrentPageUrl(this.currentTab.url);
    
    if (confirm(`Are you sure you want to clear all data for:\n${currentUrl}`)) {
      try {
        await chrome.storage.local.remove([currentUrl]);
        console.log(`Cleared data for: ${currentUrl}`);
        
        // Reload current page data
        await this.loadCurrentPageData();
        
        // If on all sites tab, reload that too
        const allTab = document.getElementById('all-tab');
        if (!allTab.classList.contains('hidden')) {
          await this.loadAllSitesData();
        }
      } catch (error) {
        console.error('Error clearing page data:', error);
        alert('Error clearing page data');
      }
    }
  }

  /**
   * Clear all data
   */
  async clearAllData() {
    if (confirm('Are you sure you want to delete ALL saved autofill data?\n\nThis action cannot be undone.')) {
      try {
        await chrome.storage.local.clear();
        console.log('Cleared all autofill data');
        
        // Reload both tabs
        await this.loadCurrentPageData();
        await this.loadAllSitesData();
      } catch (error) {
        console.error('Error clearing all data:', error);
        alert('Error clearing all data');
      }
    }
  }

  /**
   * Update field in storage
   * @param {string} url - Page URL
   * @param {string} fieldId - Field identifier
   * @param {string} value - New value
   */
  async updateFieldInStorage(url, fieldId, value) {
    try {
      const result = await chrome.storage.local.get([url]);
      const pageData = result[url] || {};
      
      // Check if using advanced format (object with value property)
      if (typeof pageData[fieldId] === 'object' && pageData[fieldId] !== null && pageData[fieldId].value !== undefined) {
        // Update only the value property and increment use count
        pageData[fieldId].value = value;
        pageData[fieldId].last_used = Date.now();
        pageData[fieldId].use_count = (pageData[fieldId].use_count || 0) + 1;
      } else {
        // Legacy format - direct string value
        pageData[fieldId] = value;
      }
      
      await chrome.storage.local.set({
        [url]: pageData
      });
    } catch (error) {
      console.error('Error updating field in storage:', error);
    }
  }

  /**
   * Remove field from storage
   * @param {string} url - Page URL
   * @param {string} fieldId - Field identifier
   */
  async removeFieldFromStorage(url, fieldId) {
    try {
      const result = await chrome.storage.local.get([url]);
      const pageData = result[url] || {};
      
      delete pageData[fieldId];
      
      await chrome.storage.local.set({
        [url]: pageData
      });
    } catch (error) {
      console.error('Error removing field from storage:', error);
    }
  }

  /**
   * Get current page URL (origin + pathname)
   * @param {string} fullUrl - Full URL
   * @returns {string} - Origin + pathname
   */
  getCurrentPageUrl(fullUrl) {
    try {
      const url = new URL(fullUrl);
      return url.origin + url.pathname;
    } catch (error) {
      return fullUrl;
    }
  }

  /**
   * Escape HTML to prevent XSS
   * @param {string} text - Text to escape
   * @returns {string} - Escaped text
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.popupManager = new PopupManager();
});
