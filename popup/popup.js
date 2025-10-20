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

    // Autofill focused field button
    document.getElementById('autofill-focused-btn').addEventListener('click', () => {
      this.autofillFocusedField();
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
          <p>Text inputs: Right-click → "FormFiller" | Checkboxes & Radio: Use "Autofill Focused Field" button above</p>
        </div>
      `;
      return;
    }

    const fieldsHtml = Object.entries(pageData).map(([fieldId, fieldData], index) => {
      // Handle both legacy strings and new object format
      const isAdvancedFormat = typeof fieldData === 'object' && fieldData !== null;
      
      // Extract the actual value
      const value = isAdvancedFormat ? fieldData.value : fieldData;
      
      // Generate friendly field name
      const fieldName = this.generateFieldName(fieldId, fieldData, isAdvancedFormat);
      
      // Extract hash for advanced format fields
      // For advanced format, the hash is the fieldId itself
      const fieldHash = isAdvancedFormat ? fieldId : '';
      
      // Format value display for different field types
      const displayValue = this.formatValueForDisplay(value, fieldData, isAdvancedFormat);
      const fieldType = this.getFieldType(fieldData, isAdvancedFormat);
      const fieldTypeIcon = this.getFieldTypeIcon(fieldType);
      
      return `
      <div class="field-item" data-field-id="${this.escapeHtml(fieldId)}" data-field-hash="${this.escapeHtml(fieldHash)}">
        <div class="field-header">
          <div class="field-name">
            ${fieldTypeIcon} ${this.escapeHtml(fieldName)}
            ${fieldType !== 'text' ? `<span class="field-type-badge">${fieldType}</span>` : ''}
          </div>
        </div>
        <div class="field-value-row">
          <div class="field-value">${displayValue}</div>
          <div class="field-actions">
            <button class="btn-icon edit-field-btn" data-field-id="${this.escapeHtml(fieldId)}" data-current-value="${this.escapeHtml(value)}" title="Edit">
              ✏️
            </button>
            <button class="btn-icon delete-field-btn" data-field-id="${this.escapeHtml(fieldId)}" title="Delete">
              🗑️
            </button>
          </div>
        </div>
      </div>
    `;
    }).join('');

    container.innerHTML = fieldsHtml;
    
    // Add event listeners for edit and delete buttons
    this.addFieldButtonListeners();
    
    // Add hover listeners for field highlighting
    this.addFieldHoverListeners();
  }

  /**
   * Generate friendly field name from field data
   * @param {string} fieldId - Field ID
   * @param {Object|string} fieldData - Field data
   * @param {boolean} isAdvancedFormat - Whether using advanced format
   * @returns {string} - Friendly field name
   */
  generateFieldName(fieldId, fieldData, isAdvancedFormat) {
    if (!isAdvancedFormat) {
      // Legacy format - try to extract from field ID
      return this.extractNameFromFieldId(fieldId);
    }

    const selectors = fieldData.selectors;
    if (!selectors) {
      return this.extractNameFromFieldId(fieldId);
    }

    // Priority 1: Check for label text
    if (selectors.fallback_attributes?.label_text) {
      return this.capitalizeFirst(selectors.fallback_attributes.label_text);
    }

    // Priority 2: Check for aria-label
    if (selectors.fallback_attributes?.aria_label) {
      return this.capitalizeFirst(selectors.fallback_attributes.aria_label);
    }

    // Priority 3: Check for name attribute in primary selector
    if (selectors.primary) {
      const nameMatch = selectors.primary.match(/\[name="([^"]+)"\]/);
      if (nameMatch) {
        return this.humanizeFieldName(nameMatch[1]);
      }
    }

    // Priority 4: Check for placeholder
    if (selectors.fallback_attributes?.placeholder_pattern) {
      const placeholder = selectors.fallback_attributes.placeholder_pattern.split('|')[0];
      if (placeholder && placeholder.length > 2) {
        return this.capitalizeFirst(placeholder);
      }
    }

    // Priority 5: Check for type
    if (selectors.fallback_attributes?.type) {
      const type = selectors.fallback_attributes.type;
      return this.humanizeFieldName(type);
    }

    // Fallback: Extract from field ID
    return this.extractNameFromFieldId(fieldId);
  }

  /**
   * Extract field name from legacy field ID
   * @param {string} fieldId - Field ID
   * @returns {string} - Extracted name
   */
  extractNameFromFieldId(fieldId) {
    // Field ID format: input_type_id_name_placeholder_pos0
    const parts = fieldId.split('_');
    
    // Try to find a meaningful part (not 'input', 'text', 'pos0', etc.)
    for (let i = 1; i < parts.length - 1; i++) {
      const part = parts[i];
      if (part && part.length > 2 && !part.startsWith('pos') && part !== 'text' && part !== 'email' && part !== 'password') {
        return this.humanizeFieldName(part);
      }
    }
    
    // Fallback to type
    if (parts.length > 1) {
      return this.humanizeFieldName(parts[1]);
    }
    
    return 'Field';
  }

  /**
   * Humanize field name (convert camelCase/snake_case to Title Case)
   * @param {string} name - Field name
   * @returns {string} - Humanized name
   */
  humanizeFieldName(name) {
    return name
      .replace(/([A-Z])/g, ' $1') // camelCase to spaces
      .replace(/[_-]/g, ' ') // underscores/dashes to spaces
      .trim()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  /**
   * Capitalize first letter
   * @param {string} str - String to capitalize
   * @returns {string} - Capitalized string
   */
  capitalizeFirst(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /**
   * Format value for display based on field type
   * @param {*} value - Field value
   * @param {Object|string} fieldData - Field data
   * @param {boolean} isAdvancedFormat - Whether using advanced format
   * @returns {string} - Formatted display value
   */
  formatValueForDisplay(value, fieldData, isAdvancedFormat) {
    const fieldType = this.getFieldType(fieldData, isAdvancedFormat);
    
    if (fieldType === 'checkbox') {
      const isChecked = this.parseCheckboxValue(value);
      return `<span class="checkbox-value ${isChecked ? 'checked' : 'unchecked'}">
        ${isChecked ? '☑️ Checked' : '☐ Unchecked'}
      </span>`;
    } else if (fieldType === 'radio') {
      return `<span class="radio-value">📻 ${this.escapeHtml(String(value))}</span>`;
    } else {
      return this.escapeHtml(String(value));
    }
  }

  /**
   * Get field type from field data
   * @param {Object|string} fieldData - Field data
   * @param {boolean} isAdvancedFormat - Whether using advanced format
   * @returns {string} - Field type
   */
  getFieldType(fieldData, isAdvancedFormat) {
    if (!isAdvancedFormat) {
      return 'text'; // Legacy format assumed text
    }
    
    return fieldData.selectors?.fallback_attributes?.type || 'text';
  }

  /**
   * Get field type icon
   * @param {string} fieldType - Field type
   * @returns {string} - Icon for field type
   */
  getFieldTypeIcon(fieldType) {
    const icons = {
      'text': '📝',
      'email': '📧',
      'password': '🔒',
      'tel': '📞',
      'url': '🌐',
      'search': '🔍',
      'number': '🔢',
      'checkbox': '☐',
      'radio': '📻',
      'textarea': '📄',
      'select': '📋'
    };
    
    return icons[fieldType] || '📝';
  }

  /**
   * Parse checkbox value to boolean
   * @param {*} value - Value to parse
   * @returns {boolean} - Parsed boolean
   */
  parseCheckboxValue(value) {
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'string') {
      const lower = value.toLowerCase();
      return lower === 'true' || lower === '1' || lower === 'checked';
    }
    return Boolean(value);
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
    // Get field data to determine type
    const currentUrl = this.getCurrentPageUrl(this.currentTab.url);
    const result = await chrome.storage.local.get([currentUrl]);
    const pageData = result[currentUrl] || {};
    const fieldData = pageData[fieldId];
    const isAdvancedFormat = typeof fieldData === 'object' && fieldData !== null;
    const fieldType = this.getFieldType(fieldData, isAdvancedFormat);
    
    let promptMessage = 'Enter new value:';
    let defaultValue = currentValue;
    
    if (fieldType === 'checkbox') {
      promptMessage = 'Enter checkbox state (true/false, checked/unchecked, 1/0):';
      const isChecked = this.parseCheckboxValue(currentValue);
      defaultValue = isChecked ? 'true' : 'false';
    } else if (fieldType === 'radio') {
      promptMessage = 'Enter radio button value:';
      if (isAdvancedFormat && fieldData.selectors?.fallback_attributes?.name) {
        promptMessage += `\nRadio group: ${fieldData.selectors.fallback_attributes.name}`;
      }
    }
    
    const newValue = prompt(promptMessage, defaultValue);
    
    if (newValue !== null && this.currentTab) {
      if (newValue.trim() === '') {
        // Remove field if empty
        await this.removeFieldFromStorage(currentUrl, fieldId);
      } else {
        // For checkbox, convert to boolean if needed
        let valueToStore = newValue;
        if (fieldType === 'checkbox') {
          valueToStore = this.parseCheckboxValue(newValue);
        }
        
        // Update field value
        await this.updateFieldInStorage(currentUrl, fieldId, valueToStore);
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
   * Autofill focused field on the page
   */
  async autofillFocusedField() {
    if (!this.currentTab) return;
    
    try {
      // Send message to content script to autofill focused field
      await chrome.tabs.sendMessage(this.currentTab.id, {
        action: 'autofillFocusedField'
      });
      
      // Show feedback
      const button = document.getElementById('autofill-focused-btn');
      const originalText = button.textContent;
      button.textContent = '✅ Done!';
      button.disabled = true;
      
      setTimeout(() => {
        button.textContent = originalText;
        button.disabled = false;
      }, 2000);
      
    } catch (error) {
      console.error('Error autofilling focused field:', error);
      alert('Error: Make sure you clicked on a field first!');
    }
  }

  /**
   * Add hover listeners for field highlighting
   */
  addFieldHoverListeners() {
    const fieldItems = document.querySelectorAll('.field-item');
    
    fieldItems.forEach((fieldItem) => {
      const fieldId = fieldItem.dataset.fieldId;
      const fieldHash = fieldItem.dataset.fieldHash;
      
      fieldItem.addEventListener('mouseenter', () => {
        this.highlightFieldOnPage(fieldId, fieldHash);
      });
      
      fieldItem.addEventListener('mouseleave', () => {
        this.removeHighlightFromPage();
      });
    });
  }

  /**
   * Highlight field on the current page
   * @param {string} fieldId - Field ID (legacy system)
   * @param {string} fieldHash - Field hash (advanced system)
   */
  async highlightFieldOnPage(fieldId, fieldHash) {
    if (!this.currentTab) return;
    
    try {
      await chrome.tabs.sendMessage(this.currentTab.id, {
        action: 'highlightField',
        fieldId: fieldId,
        hash: fieldHash
      });
    } catch (error) {
      // Silent fail if content script is not ready
      console.debug('Could not highlight field:', error);
    }
  }

  /**
   * Remove highlight from all fields on the page
   */
  async removeHighlightFromPage() {
    if (!this.currentTab) return;
    
    try {
      await chrome.tabs.sendMessage(this.currentTab.id, {
        action: 'removeHighlight'
      });
    } catch (error) {
      // Silent fail if content script is not ready
      console.debug('Could not remove highlight:', error);
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
