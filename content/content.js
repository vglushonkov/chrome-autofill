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
      } else if (message.action === 'autofillFocusedField') {
        this.autofillFocusedField();
      } else if (message.action === 'highlightField') {
        this.highlightField(message.fieldId, message.hash);
      } else if (message.action === 'removeHighlight') {
        this.removeHighlight();
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
    
    // Verify element is still a valid input field
    if (!FieldSelector.isInputField(element)) {
      console.log('Context menu triggered on non-input element, ignoring');
      alert('FormFiller context menu works only with text inputs and textareas. For checkboxes and radio buttons, click on the field first, then use the "Autofill Focused Field" button in the extension popup.');
      return;
    }
    
    try {
      // Generate selector preview for user
      const selectorPreview = this.generateSelectorPreview(element);
      
      // Try to find existing value for this field
      const matches = await AutofillStorage.findMatchingFields();
      const existingMatch = matches.find(match => match.element === element);
      let currentValue;
      
      if (element.type === 'checkbox') {
        currentValue = existingMatch ? existingMatch.fieldData.value : element.checked;
      } else if (element.type === 'radio') {
        currentValue = existingMatch ? existingMatch.fieldData.value : (element.checked ? element.value : '');
      } else {
        currentValue = existingMatch ? existingMatch.fieldData.value : (element.value || '');
      }
      
      // Build prompt message
      let promptMessage = `Enter value for this field:\n\n`;
      promptMessage += `Selector preview: ${selectorPreview}\n`;
      promptMessage += `Field type: ${element.type}\n`;
      
      // For select elements, show available options
      if (element.tagName === 'SELECT') {
        const options = Array.from(element.options)
          .map(opt => `  - ${opt.value}${opt.text !== opt.value ? ` (${opt.text})` : ''}`)
          .join('\n');
        promptMessage += `Available options:\n${options}\n\n`;
      } else if (element.type === 'checkbox') {
        promptMessage += `For checkbox: enter 'true', 'false', '1', '0', 'checked', or 'unchecked'\n`;
        promptMessage += `Current state: ${element.checked ? 'checked' : 'unchecked'}\n\n`;
      } else if (element.type === 'radio') {
        // Find all radio buttons in the same group
        const radioGroup = document.querySelectorAll(`input[type="radio"][name="${element.name}"]`);
        const options = Array.from(radioGroup)
          .map(radio => `  - ${radio.value}${radio.checked ? ' (currently selected)' : ''}`)
          .join('\n');
        promptMessage += `Radio group "${element.name}":\n${options}\n`;
        promptMessage += `Enter the value you want to select\n\n`;
      }
      
      promptMessage += `Current value: ${currentValue || 'None'}\n`;
      promptMessage += `Match confidence: ${existingMatch ? (existingMatch.confidence * 100).toFixed(0) + '%' : 'New field'}`;
      
      // Create and show enhanced dialog
      let defaultValue;
      if (element.type === 'checkbox') {
        defaultValue = typeof currentValue === 'boolean' ? (currentValue ? 'true' : 'false') : (currentValue || 'false');
      } else {
        defaultValue = currentValue || '';
      }
      
      const value = prompt(promptMessage, defaultValue);

      if (value !== null) {
        if (value.trim() === '') {
          // Remove value if empty
          if (existingMatch) {
            await AutofillStorage.removeFieldByHash(existingMatch.hash);
          }
          this.clearFieldValue(element);
        } else {
          // Save new value with advanced selectors
          const fieldHash = await AutofillStorage.saveFieldWithSelector(element, value);
          this.setFieldValue(element, value);
          
          // Mark field as filled and store hash for reference
          element.classList.add('fields-autofill-filled');
          element.dataset.autofillHash = fieldHash;
          
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
    const currentValue = await AutofillStorage.getFieldValue(fieldId) || element.value || '';
    
    let promptMessage = `Enter value for this field (legacy mode):\n\nField ID: ${fieldId}\n`;
    
    // For select elements, show available options
    if (element.tagName === 'SELECT') {
      const options = Array.from(element.options)
        .map(opt => `  - ${opt.value}${opt.text !== opt.value ? ` (${opt.text})` : ''}`)
        .join('\n');
      promptMessage += `Available options:\n${options}\n\n`;
    }
    
    promptMessage += `Current value: ${currentValue || 'None'}`;
    
    const value = prompt(promptMessage, currentValue || '');

    if (value !== null) {
      if (value.trim() === '') {
        await AutofillStorage.removeFieldValue(fieldId);
        this.clearFieldValue(element);
      } else {
        await AutofillStorage.saveFieldValue(fieldId, value);
        this.setFieldValue(element, value);
        element.classList.add('fields-autofill-filled');
      }
      
      this.updateExtensionIcon();
    }
  }
  
  /**
   * Set field value (works for input, textarea, select, checkbox, and radio)
   */
  setFieldValue(element, value) {
    if (element.tagName === 'SELECT') {
      // For select elements, try to find matching option
      const option = Array.from(element.options).find(opt => 
        opt.value === value || opt.text === value
      );
      
      if (option) {
        element.value = option.value;
        console.log(`Successfully set select value: ${option.value}`);
      } else {
        console.warn(`Option not found for select: ${value}`, {
          availableOptions: Array.from(element.options).map(opt => opt.value),
          searchedValue: value
        });
        // Try to set value anyway (might work for some cases)
        element.value = value;
      }
    } else if (element.type === 'checkbox') {
      // For checkboxes, value should be boolean or string representation
      if (typeof value === 'boolean') {
        element.checked = value;
      } else if (typeof value === 'string') {
        element.checked = value.toLowerCase() === 'true' || value === '1' || value === 'checked';
      } else {
        element.checked = Boolean(value);
      }
    } else if (element.type === 'radio') {
      // For radio buttons, only check if value matches
      if (element.value === value) {
        element.checked = true;
      }
    } else {
      // For input and textarea
      element.value = value;
    }
    
    // Trigger events for frameworks
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }
  
  /**
   * Clear field value (works for input, textarea, select, checkbox, and radio)
   */
  clearFieldValue(element) {
    if (element.type === 'checkbox' || element.type === 'radio') {
      element.checked = false;
    } else {
      element.value = '';
    }
    
    element.classList.remove('fields-autofill-filled');
    
    // Trigger events for frameworks
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
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
        
        // Only fill empty fields or unchecked checkboxes/radios
        if (element.classList.contains('fields-autofill-filled')) {
          continue;
        }
        
        // For text inputs, skip if already has value (but not for select elements)
        if ((element.type !== 'checkbox' && element.type !== 'radio' && element.tagName !== 'SELECT') && element.value) {
          continue;
        }
        
        // For select elements, only skip if the current value matches what we want to set
        if (element.tagName === 'SELECT' && element.value && element.value === fieldData.value) {
          continue;
        }
        
        // For checkboxes and radios, we can always auto-fill (overwrite current state)
        // This allows users to set desired states via the extension
        
        // Apply confidence threshold (avoid very low confidence matches)
        if (confidence < 0.5) {
          console.log(`Skipping low confidence match (${(confidence * 100).toFixed(0)}%) for element:`, element);
          continue;
        }
        
        // Fill the field (handles input, textarea, and select)
        if (element.tagName === 'SELECT') {
          console.log(`Filling select element:`, {
            id: element.id,
            name: element.name,
            currentValue: element.value,
            newValue: fieldData.value,
            options: Array.from(element.options).map(opt => ({ value: opt.value, text: opt.text }))
          });
        }
        this.setFieldValue(element, fieldData.value);
        
        // Mark as filled and store hash
        element.classList.add('fields-autofill-filled');
        element.dataset.autofillHash = hash;
        element.dataset.autofillMethod = method;
        element.dataset.autofillConfidence = confidence.toFixed(2);
        
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
        const shouldFill = savedValue && typeof savedValue === 'string' && 
          ((field.type !== 'checkbox' && field.type !== 'radio' && field.tagName !== 'SELECT' && !field.value) || 
           (field.type === 'checkbox' || field.type === 'radio') ||
           (field.tagName === 'SELECT' && (!field.value || field.value !== savedValue)));
           
        if (shouldFill) {
          this.setFieldValue(field, savedValue);
          
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
   * Autofill the currently focused field
   */
  async autofillFocusedField() {
    const focusedElement = document.activeElement;
    
    if (!focusedElement || !FieldSelector.isInputField(focusedElement)) {
      alert('Please click on a field (input, textarea, select, checkbox, or radio button) first!');
      return;
    }
    
    // Set this as the last context menu target
    this.lastContextMenuTarget = focusedElement;
    
    // Show the autofill dialog
    await this.showAutofillDialog();
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

  /**
   * Highlight field on the page when hovering in popup
   * @param {string} fieldId - Field identifier (legacy system)
   * @param {string} hash - Field hash (advanced system)
   */
  async highlightField(fieldId, hash) {
    // Remove any existing highlight first
    this.removeHighlight();
    
    let targetElement = null;
    
    // Try to find field using advanced system (by hash)
    if (hash) {
      targetElement = this.findFieldByHash(hash);
    }
    
    // Fallback to legacy system (by field ID)
    if (!targetElement && fieldId) {
      targetElement = this.findFieldByFieldId(fieldId);
    }
    
    if (targetElement) {
      // Add highlight class
      targetElement.classList.add('fields-autofill-highlighted');
      
      // Scroll element into view if needed
      targetElement.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'nearest'
      });
      
      // Field highlighted successfully
    } else {
      console.warn('Field not found for highlighting:', { fieldId, hash });
    }
  }

  /**
   * Remove highlight from all fields
   */
  removeHighlight() {
    const highlightedElements = document.querySelectorAll('.fields-autofill-highlighted');
    highlightedElements.forEach(element => {
      element.classList.remove('fields-autofill-highlighted');
    });
  }

  /**
   * Find field element by hash (advanced system)
   * @param {string} hash - Field hash
   * @returns {Element|null} - Found element or null
   */
  findFieldByHash(hash) {
    // First try to find by stored hash in dataset
    const elementWithHash = document.querySelector(`[data-autofill-hash="${hash}"]`);
    if (elementWithHash) {
      return elementWithHash;
    }
    
    // If not found, try to match using selector system
    // This is more expensive but handles cases where hash wasn't stored
    try {
      const inputFields = FieldSelector.getAllInputFields();
      
      for (const field of inputFields) {
        // Generate field hash using same method as storage
        const fieldSelector = FieldSelector.generateFieldSelector(field);
        const fieldHash = fieldSelector.hash;
        
        if (fieldHash === hash) {
          return field;
        }
      }
    } catch (error) {
      console.error('Error finding field by hash:', error);
    }
    
    return null;
  }

  /**
   * Find field element by field ID (legacy system)
   * @param {string} fieldId - Field identifier
   * @returns {Element|null} - Found element or null
   */
  findFieldByFieldId(fieldId) {
    try {
      const inputFields = FieldSelector.getAllInputFields();
      
      for (const field of inputFields) {
        const currentFieldId = FieldIdentifier.generateFieldId(field);
        if (currentFieldId === fieldId) {
          return field;
        }
      }
    } catch (error) {
      console.error('Error finding field by fieldId:', error);
    }
    
    return null;
  }
}

// Initialize when script loads
const fieldsAutofill = new FieldsAutofill();
