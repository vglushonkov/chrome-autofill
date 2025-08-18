/**
 * Main content script for Fields Autofill extension
 */
class FieldsAutofill {
  constructor() {
    this.contextMenuId = 'fields-autofill';
    this.init();
  }

  /**
   * Initialize the extension
   */
  async init() {
    console.log('Fields Autofill: Initializing...');
    
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.setup());
    } else {
      this.setup();
    }
  }

  /**
   * Setup the extension functionality
   */
  async setup() {
    // Initialize storage migration if needed
    await AutofillStorage.migrateOldData();
    
    // Inject CSS styles for autofilled fields
    this.injectStyles();
    
    // Add context menu listeners
    this.addContextMenuListeners();
    
    // Auto-fill saved values using new system
    await this.autoFillWithAdvancedSelectors();
    
    // Listen for dynamically added fields
    this.observeForNewFields();
    
    console.log('Fields Autofill: Setup complete with advanced selectors');
  }

  /**
   * Inject CSS styles for autofilled fields
   */
  injectStyles() {
    const style = document.createElement('link');
    style.rel = 'stylesheet';
    style.type = 'text/css';
    style.href = chrome.runtime.getURL('content/autofill-styles.css');
    document.head.appendChild(style);
  }

  /**
   * Add context menu event listeners
   */
  addContextMenuListeners() {
    document.addEventListener('contextmenu', (event) => {
      const element = event.target;
      
      if (FieldSelector.isInputField(element)) {
        // Store the target element for later use
        this.lastContextMenuTarget = element;
        console.log('Context menu on input field:', element);
      }
    });

    // Listen for messages from background script
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === 'showAutofillDialog') {
        this.showAutofillDialog();
      } else if (message.action === 'requestIconUpdate') {
        this.updateExtensionIcon();
      }
    });
  }

  /**
   * Show dialog for entering autofill value using new selector system
   */
  async showAutofillDialog() {
    if (!this.lastContextMenuTarget) {
      console.error('No target element found');
      return;
    }

    const element = this.lastContextMenuTarget;
    
    try {
      // Generate selector preview for user
      const selectorPreview = this.generateSelectorPreview(element);
      
      // Try to find existing value for this field
      const matches = await AutofillStorage.findMatchingFields();
      const existingMatch = matches.find(match => match.element === element);
      const currentValue = existingMatch ? existingMatch.fieldData.value : '';
      
      // Create and show enhanced dialog
      const value = prompt(
        `Enter value for this field:\n\n` +
        `Selector preview: ${selectorPreview}\n` +
        `Current value: ${currentValue || 'None'}\n` +
        `Match confidence: ${existingMatch ? (existingMatch.confidence * 100).toFixed(0) + '%' : 'New field'}`,
        currentValue || ''
      );

      if (value !== null) {
        if (value.trim() === '') {
          // Remove value if empty
          if (existingMatch) {
            await AutofillStorage.removeFieldByHash(existingMatch.hash);
          }
          element.value = '';
          element.classList.remove('fields-autofill-filled');
        } else {
          // Save new value with advanced selectors
          const fieldHash = await AutofillStorage.saveFieldWithSelector(element, value);
          element.value = value;
          
          // Mark field as filled and store hash for reference
          element.classList.add('fields-autofill-filled');
          element.dataset.autofillHash = fieldHash;
          
          // Trigger input events for frameworks
          element.dispatchEvent(new Event('input', { bubbles: true }));
          element.dispatchEvent(new Event('change', { bubbles: true }));
          
          console.log(`Saved field with hash: ${fieldHash}`);
        }
        
        // Update extension icon after changes
        this.updateExtensionIcon();
      }
    } catch (error) {
      console.error('Error in showAutofillDialog:', error);
      // Fallback to old system if new system fails
      await this.showLegacyAutofillDialog(element);
    }
  }
  
  /**
   * Legacy dialog method as fallback
   */
  async showLegacyAutofillDialog(element) {
    const fieldId = FieldIdentifier.generateFieldId(element);
    const currentValue = await AutofillStorage.getFieldValue(fieldId);
    
    const value = prompt(
      `Enter value for this field (legacy mode):\n\nField ID: ${fieldId}\nCurrent value: ${currentValue || 'None'}`,
      currentValue || ''
    );

    if (value !== null) {
      if (value.trim() === '') {
        await AutofillStorage.removeFieldValue(fieldId);
        element.value = '';
        element.classList.remove('fields-autofill-filled');
      } else {
        await AutofillStorage.saveFieldValue(fieldId, value);
        element.value = value;
        element.classList.add('fields-autofill-filled');
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
      }
      
      this.updateExtensionIcon();
    }
  }
  
  /**
   * Generate a human-readable selector preview
   */
  generateSelectorPreview(element) {
    const parts = [];
    
    if (element.name) parts.push(`name="${element.name}"`);
    if (element.id && !FieldSelector.isDynamic(element.id)) parts.push(`id="${element.id}"`);
    if (element.type) parts.push(`type="${element.type}"`);
    if (element.placeholder) parts.push(`placeholder="${element.placeholder.substring(0, 20)}..."`);
    
    const stableClasses = FieldSelector.getStableClasses(element);
    if (stableClasses.length > 0) parts.push(`class="${stableClasses.slice(0, 2).join(' ')}"`);
    
    return parts.length > 0 ? parts.join(' ') : 'Complex selector';
  }

  /**
   * Auto-fill with advanced selectors (primary method)
   */
  async autoFillWithAdvancedSelectors() {
    try {
      const matches = await AutofillStorage.findMatchingFields();
      let filledCount = 0;
      
      for (const match of matches) {
        const { element, fieldData, confidence, method, hash } = match;
        
        // Only fill empty fields
        if (element.value || element.classList.contains('fields-autofill-filled')) {
          continue;
        }
        
        // Apply confidence threshold (avoid very low confidence matches)
        if (confidence < 0.5) {
          console.log(`Skipping low confidence match (${(confidence * 100).toFixed(0)}%) for element:`, element);
          continue;
        }
        
        // Fill the field
        element.value = fieldData.value;
        
        // Mark as filled and store hash
        element.classList.add('fields-autofill-filled');
        element.dataset.autofillHash = hash;
        element.dataset.autofillMethod = method;
        element.dataset.autofillConfidence = confidence.toFixed(2);
        
        // Trigger events for frameworks
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
        
        // Update usage statistics
        await AutofillStorage.updateFieldUsage(hash);
        
        filledCount++;
        
        console.log(`Auto-filled field [${method}, ${(confidence * 100).toFixed(0)}%]: ${fieldData.value}`);
      }
      
      // Fallback to legacy system for any remaining fields
      const legacyFilledCount = await this.autoFillLegacyFields();
      filledCount += legacyFilledCount;
      
      if (filledCount > 0) {
        console.log(`Fields Autofill: Auto-filled ${filledCount} fields using advanced selectors`);
      }
      
      // Update extension icon
      this.updateExtensionIcon();
      
    } catch (error) {
      console.error('Error in advanced auto-fill, falling back to legacy:', error);
      await this.autoFillLegacyFields();
    }
  }
  
  /**
   * Legacy auto-fill method as fallback
   */
  async autoFillLegacyFields() {
    try {
      const savedValues = await AutofillStorage.getAllFieldValues();
      const inputFields = FieldSelector.getAllInputFields();
      
      let filledCount = 0;
      
      for (const field of inputFields) {
        // Skip if already filled by advanced system
        if (field.classList.contains('fields-autofill-filled')) {
          continue;
        }
        
        const fieldId = FieldIdentifier.generateFieldId(field);
        const savedValue = savedValues[fieldId];
        
        // Check if it's a string value (old format) and not object (new format)
        if (savedValue && typeof savedValue === 'string' && !field.value) {
          field.value = savedValue;
          
          // Trigger events for frameworks
          field.dispatchEvent(new Event('input', { bubbles: true }));
          field.dispatchEvent(new Event('change', { bubbles: true }));
          
          filledCount++;
          
          // Mark field as filled with legacy indicator
          field.classList.add('fields-autofill-filled');
          field.dataset.autofillMethod = 'legacy';
          
          console.log(`Auto-filled field (legacy) ${fieldId} with value: ${savedValue}`);
        }
      }
      
      return filledCount;
    } catch (error) {
      console.error('Error in legacy auto-fill:', error);
      return 0;
    }
  }
  
  /**
   * Auto-fill saved values for all fields on the page (kept for compatibility)
   */
  async autoFillSavedValues() {
    // Delegate to new method
    await this.autoFillWithAdvancedSelectors();
  }

  /**
   * Update extension icon based on filled fields on the page
   */
  async updateExtensionIcon() {
    try {
      // Count filled fields on current page
      const filledFields = document.querySelectorAll('.fields-autofill-filled');
      const filledCount = filledFields.length;
      
      // Send message to background script to update icon
      chrome.runtime.sendMessage({
        action: 'updateIcon',
        filledCount: filledCount,
        hasFilledFields: filledCount > 0
      });
      
      console.log(`Updated icon: ${filledCount} filled fields`);
    } catch (error) {
      console.error('Error updating extension icon:', error);
    }
  }

  /**
   * Observe for dynamically added fields
   */
  observeForNewFields() {
    const observer = new MutationObserver((mutations) => {
      let hasNewFields = false;
      
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Check if the node itself is an input field
            if (FieldSelector.isInputField(node)) {
              hasNewFields = true;
            }
            
            // Check for input fields in added subtree
            if (node.querySelectorAll) {
              const inputFields = FieldSelector.getAllInputFields();
              if (inputFields.length > 0) {
                hasNewFields = true;
              }
            }
          }
        });
      });
      
      if (hasNewFields) {
        console.log('New fields detected, auto-filling...');
        setTimeout(() => this.autoFillSavedValues(), 100);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
}

// Initialize when script loads
const fieldsAutofill = new FieldsAutofill();
