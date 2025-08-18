/**
 * Storage management for autofill data with advanced field selectors
 */
class AutofillStorage {
  static STORAGE_VERSION = '2.0';
  
  /**
   * Get current page URL for storage key
   * @returns {string} - Current page URL
   */
  static getCurrentPageUrl() {
    return window.location.origin + window.location.pathname;
  }
  
  /**
   * Get storage key for version management
   */
  static getVersionKey() {
    return '_autofill_version';
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
  
  // New methods for advanced selector system
  
  /**
   * Save field with advanced selector data
   * @param {HTMLElement} element - The field element
   * @param {string} value - Value to save
   * @returns {Promise<string>} - Field hash for reference
   */
  static async saveFieldWithSelector(element, value) {
    try {
      const selectorData = FieldSelector.generateFieldSelector(element);
      const pageUrl = this.getCurrentPageUrl();
      
      // Get existing data for this page
      const result = await chrome.storage.local.get([pageUrl]);
      const pageData = result[pageUrl] || {};
      
      // Create new field entry
      pageData[selectorData.hash] = {
        value: value,
        selectors: selectorData.selectors,
        confidence: selectorData.confidence,
        created: selectorData.created,
        last_used: Date.now(),
        use_count: (pageData[selectorData.hash]?.use_count || 0) + 1
      };
      
      // Save back to storage with version info
      await chrome.storage.local.set({
        [pageUrl]: pageData,
        [this.getVersionKey()]: this.STORAGE_VERSION
      });
      
      console.log(`Saved field with selector ${selectorData.hash}:`, selectorData);
      return selectorData.hash;
    } catch (error) {
      console.error('Error saving field with selector:', error);
      throw error;
    }
  }
  
  /**
   * Find all matching fields on the page and return their data
   * @returns {Promise<Array>} - Array of {element, fieldData, confidence, method}
   */
  static async findMatchingFields() {
    try {
      const pageUrl = this.getCurrentPageUrl();
      const result = await chrome.storage.local.get([pageUrl]);
      const pageData = result[pageUrl] || {};
      
      const matches = [];
      
      for (const [fieldHash, fieldData] of Object.entries(pageData)) {
        // Skip if not a field entry (could be metadata)
        if (!fieldData.selectors) continue;
        
        const matchResult = FieldSelector.findElementBySelector({
          selectors: fieldData.selectors
        });
        
        if (matchResult) {
          matches.push({
            hash: fieldHash,
            element: matchResult.element,
            fieldData: fieldData,
            confidence: matchResult.confidence,
            method: matchResult.method
          });
        }
      }
      
      // Sort by confidence (highest first)
      matches.sort((a, b) => b.confidence - a.confidence);
      
      console.log(`Found ${matches.length} matching fields on page`);
      return matches;
    } catch (error) {
      console.error('Error finding matching fields:', error);
      return [];
    }
  }
  
  /**
   * Update field usage statistics
   * @param {string} fieldHash - Field hash
   * @returns {Promise<void>}
   */
  static async updateFieldUsage(fieldHash) {
    try {
      const pageUrl = this.getCurrentPageUrl();
      const result = await chrome.storage.local.get([pageUrl]);
      const pageData = result[pageUrl] || {};
      
      if (pageData[fieldHash]) {
        pageData[fieldHash].last_used = Date.now();
        pageData[fieldHash].use_count = (pageData[fieldHash].use_count || 0) + 1;
        
        await chrome.storage.local.set({
          [pageUrl]: pageData
        });
      }
    } catch (error) {
      console.error('Error updating field usage:', error);
    }
  }
  
  /**
   * Get storage version and check if migration is needed
   * @returns {Promise<string|null>} - Current version or null if not set
   */
  static async getStorageVersion() {
    try {
      const result = await chrome.storage.local.get([this.getVersionKey()]);
      return result[this.getVersionKey()] || null;
    } catch (error) {
      console.error('Error getting storage version:', error);
      return null;
    }
  }
  
  /**
   * Migrate old format data to new format
   * @returns {Promise<void>}
   */
  static async migrateOldData() {
    try {
      const version = await this.getStorageVersion();
      if (version === this.STORAGE_VERSION) {
        console.log('Storage is already up to date');
        return;
      }
      
      console.log('Migrating old storage format...');
      const allData = await chrome.storage.local.get(null);
      const migratedCount = 0;
      
      for (const [pageUrl, pageData] of Object.entries(allData)) {
        // Skip version key and other metadata
        if (pageUrl.startsWith('_')) continue;
        
        // Check if this page has old format data
        if (typeof pageData === 'object' && !this.isNewFormat(pageData)) {
          console.log(`Migrating data for ${pageUrl}`);
          // For now, we'll keep old data alongside new data
          // Users can re-save fields to convert them to new format
          // In a future version, we might try to auto-convert based on patterns
        }
      }
      
      // Set version
      await chrome.storage.local.set({
        [this.getVersionKey()]: this.STORAGE_VERSION
      });
      
      console.log(`Migration completed. ${migratedCount} fields migrated.`);
    } catch (error) {
      console.error('Error during migration:', error);
    }
  }
  
  /**
   * Check if page data is in new format
   * @param {Object} pageData - Page data object
   * @returns {boolean}
   */
  static isNewFormat(pageData) {
    // Check if any field has the new structure
    return Object.values(pageData).some(fieldData => 
      fieldData && typeof fieldData === 'object' && fieldData.selectors
    );
  }
  
  /**
   * Remove field by hash
   * @param {string} fieldHash - Field hash to remove
   * @returns {Promise<void>}
   */
  static async removeFieldByHash(fieldHash) {
    try {
      const pageUrl = this.getCurrentPageUrl();
      const result = await chrome.storage.local.get([pageUrl]);
      const pageData = result[pageUrl] || {};
      
      delete pageData[fieldHash];
      
      await chrome.storage.local.set({
        [pageUrl]: pageData
      });
      
      console.log(`Removed field ${fieldHash}`);
    } catch (error) {
      console.error('Error removing field by hash:', error);
    }
  }
}

// Make available globally
window.AutofillStorage = AutofillStorage;
