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
    // Inject CSS styles for autofilled fields
    this.injectStyles();
    
    // Add context menu listeners
    this.addContextMenuListeners();
    
    // Auto-fill saved values
    await this.autoFillSavedValues();
    
    // Listen for dynamically added fields
    this.observeForNewFields();
    
    console.log('Fields Autofill: Setup complete');
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
      
      if (FieldIdentifier.isInputField(element)) {
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
   * Show dialog for entering autofill value
   */
  async showAutofillDialog() {
    if (!this.lastContextMenuTarget) {
      console.error('No target element found');
      return;
    }

    const element = this.lastContextMenuTarget;
    const fieldId = FieldIdentifier.generateFieldId(element);
    
    // Get current saved value
    const currentValue = await AutofillStorage.getFieldValue(fieldId);
    
    // Create and show dialog
    const value = prompt(
      `Enter value for this field:\n\nField ID: ${fieldId}\nCurrent value: ${currentValue || 'None'}`,
      currentValue || ''
    );

    if (value !== null) {
      if (value.trim() === '') {
        // Remove value if empty
        await AutofillStorage.removeFieldValue(fieldId);
        element.value = '';
        // Remove class if value is cleared
        element.classList.remove('fields-autofill-filled');
      } else {
        // Save new value
        await AutofillStorage.saveFieldValue(fieldId, value);
        element.value = value;
        
        // Mark field as filled (no visual effects)
        element.classList.add('fields-autofill-filled');
        
        // Trigger input event for frameworks
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
      }
      
      // Update extension icon after changes
      this.updateExtensionIcon();
    }
  }

  /**
   * Auto-fill saved values for all fields on the page
   */
  async autoFillSavedValues() {
    try {
      const savedValues = await AutofillStorage.getAllFieldValues();
      const inputFields = FieldIdentifier.getAllInputFields();
      
      let filledCount = 0;
      
      for (const field of inputFields) {
        const fieldId = FieldIdentifier.generateFieldId(field);
        const savedValue = savedValues[fieldId];
        
        if (savedValue && !field.value) {
          field.value = savedValue;
          
          // Trigger events for frameworks
          field.dispatchEvent(new Event('input', { bubbles: true }));
          field.dispatchEvent(new Event('change', { bubbles: true }));
          
          filledCount++;
          
          // Mark field as filled (for internal tracking, no visual effects)
          field.classList.add('fields-autofill-filled');
          
          console.log(`Auto-filled field ${fieldId} with value: ${savedValue}`);
        }
      }
      
      if (filledCount > 0) {
        console.log(`Fields Autofill: Auto-filled ${filledCount} fields`);
      }
      
      // Update extension icon based on filled fields
      this.updateExtensionIcon();
    } catch (error) {
      console.error('Error auto-filling fields:', error);
    }
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
            if (FieldIdentifier.isInputField(node)) {
              hasNewFields = true;
            }
            
            // Check for input fields in added subtree
            if (node.querySelectorAll) {
              const inputFields = FieldIdentifier.getAllInputFields();
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
