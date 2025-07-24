/**
 * Storage management for autofill data
 */
class AutofillStorage {
  /**
   * Get current page URL for storage key
   * @returns {string} - Current page URL
   */
  static getCurrentPageUrl() {
    return window.location.origin + window.location.pathname;
  }

  /**
   * Save field value to storage
   * @param {string} fieldId - Unique field identifier
   * @param {string} value - Value to save
   * @returns {Promise<void>}
   */
  static async saveFieldValue(fieldId, value) {
    try {
      const pageUrl = this.getCurrentPageUrl();
      
      // Get existing data for this page
      const result = await chrome.storage.local.get([pageUrl]);
      const pageData = result[pageUrl] || {};
      
      // Update field value
      pageData[fieldId] = value;
      
      // Save back to storage
      await chrome.storage.local.set({
        [pageUrl]: pageData
      });
      
      console.log(`Saved value for field ${fieldId} on ${pageUrl}`);
    } catch (error) {
      console.error('Error saving field value:', error);
    }
  }

  /**
   * Get field value from storage
   * @param {string} fieldId - Unique field identifier
   * @returns {Promise<string|null>} - Saved value or null
   */
  static async getFieldValue(fieldId) {
    try {
      const pageUrl = this.getCurrentPageUrl();
      const result = await chrome.storage.local.get([pageUrl]);
      const pageData = result[pageUrl] || {};
      
      return pageData[fieldId] || null;
    } catch (error) {
      console.error('Error getting field value:', error);
      return null;
    }
  }

  /**
   * Get all saved values for current page
   * @returns {Promise<Object>} - Object with field IDs as keys and values
   */
  static async getAllFieldValues() {
    try {
      const pageUrl = this.getCurrentPageUrl();
      const result = await chrome.storage.local.get([pageUrl]);
      
      return result[pageUrl] || {};
    } catch (error) {
      console.error('Error getting all field values:', error);
      return {};
    }
  }

  /**
   * Remove field value from storage
   * @param {string} fieldId - Unique field identifier
   * @returns {Promise<void>}
   */
  static async removeFieldValue(fieldId) {
    try {
      const pageUrl = this.getCurrentPageUrl();
      const result = await chrome.storage.local.get([pageUrl]);
      const pageData = result[pageUrl] || {};
      
      // Remove field
      delete pageData[fieldId];
      
      // Save back to storage
      await chrome.storage.local.set({
        [pageUrl]: pageData
      });
      
      console.log(`Removed value for field ${fieldId} on ${pageUrl}`);
    } catch (error) {
      console.error('Error removing field value:', error);
    }
  }

  /**
   * Get all saved data from storage
   * @returns {Promise<Object>} - All saved data
   */
  static async getAllData() {
    try {
      const result = await chrome.storage.local.get(null);
      return result;
    } catch (error) {
      console.error('Error getting all data:', error);
      return {};
    }
  }

  /**
   * Clear all data for current page
   * @returns {Promise<void>}
   */
  static async clearPageData() {
    try {
      const pageUrl = this.getCurrentPageUrl();
      await chrome.storage.local.remove([pageUrl]);
      console.log(`Cleared all data for ${pageUrl}`);
    } catch (error) {
      console.error('Error clearing page data:', error);
    }
  }

  /**
   * Clear all stored data
   * @returns {Promise<void>}
   */
  static async clearAllData() {
    try {
      await chrome.storage.local.clear();
      console.log('Cleared all autofill data');
    } catch (error) {
      console.error('Error clearing all data:', error);
    }
  }
}

// Make available globally
window.AutofillStorage = AutofillStorage;
