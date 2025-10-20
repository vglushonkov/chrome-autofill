/**
 * Background service worker for Fields Autofill extension
 */
class BackgroundService {
  constructor() {
    this.contextMenuId = 'fields-autofill';
    this.init();
  }

  /**
   * Initialize background service
   */
  init() {
    console.log('Fields Autofill Background: Initializing...');
    
    // Create context menu on extension startup
    chrome.runtime.onStartup.addListener(() => {
      this.createContextMenu();
    });

    // Create context menu when extension is installed
    chrome.runtime.onInstalled.addListener(() => {
      this.createContextMenu();
    });

    // Handle context menu clicks
    chrome.contextMenus.onClicked.addListener((info, tab) => {
      this.handleContextMenuClick(info, tab);
    });

    // Handle messages from content scripts
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
    });

    // Handle tab changes to update icon state
    chrome.tabs.onActivated.addListener(async (activeInfo) => {
      await this.updateIconForActiveTab(activeInfo.tabId);
    });

    // Handle tab updates (like navigation)
    chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
      if (changeInfo.status === 'complete' && tab.active) {
        await this.updateIconForActiveTab(tabId);
      }
    });

    console.log('Fields Autofill Background: Initialized');
  }

  /**
   * Create context menu item
   */
  createContextMenu() {
    // Remove existing menu item first
    chrome.contextMenus.removeAll(() => {
      // Create menu item for editable fields only (input, textarea)
      chrome.contextMenus.create({
        id: this.contextMenuId,
        title: 'FormFiller',
        contexts: ['editable'],
        documentUrlPatterns: ['http://*/*', 'https://*/*']
      });
      
      console.log('Context menu created for editable fields');
    });
  }

  /**
   * Handle context menu click
   * @param {Object} info - Context menu info
   * @param {Object} tab - Current tab
   */
  async handleContextMenuClick(info, tab) {
    if (info.menuItemId === this.contextMenuId) {
      try {
        // Send message to content script to show autofill dialog
        await chrome.tabs.sendMessage(tab.id, {
          action: 'showAutofillDialog'
        });
        
        console.log('Sent autofill dialog message to tab:', tab.id);
      } catch (error) {
        console.error('Error sending message to content script:', error);
      }
    }
  }

  /**
   * Handle messages from content scripts
   * @param {Object} message - Message from content script
   * @param {Object} sender - Message sender
   * @param {Function} sendResponse - Response callback
   */
  handleMessage(message, sender, sendResponse) {
    if (message.action === 'updateIcon') {
      this.updateExtensionIcon(sender.tab.id, message.filledCount, message.hasFilledFields);
    }
  }

  /**
   * Update icon for active tab by requesting status from content script
   * @param {number} tabId - Tab ID
   */
  async updateIconForActiveTab(tabId) {
    try {
      // Send message to content script to get current filled fields count
      await chrome.tabs.sendMessage(tabId, {
        action: 'requestIconUpdate'
      });
    } catch (error) {
      // If content script is not loaded, clear the badge
      await this.updateExtensionIcon(tabId, 0, false);
    }
  }

  /**
   * Update extension icon and badge based on filled fields
   * @param {number} tabId - Tab ID
   * @param {number} filledCount - Number of filled fields
   * @param {boolean} hasFilledFields - Whether there are any filled fields
   */
  async updateExtensionIcon(tabId, filledCount, hasFilledFields) {
    try {
      if (hasFilledFields) {
        // Set badge with number of filled fields
        await chrome.action.setBadgeText({
          tabId: tabId,
          text: filledCount.toString()
        });
        
        // Set badge color (blue to indicate activity)
        await chrome.action.setBadgeBackgroundColor({
          tabId: tabId,
          color: '#4285f4'
        });
        
        // Update title to show filled fields count
        await chrome.action.setTitle({
          tabId: tabId,
          title: `Fields Autofill - ${filledCount} field${filledCount === 1 ? '' : 's'} filled`
        });
        
        console.log(`Updated icon for tab ${tabId}: ${filledCount} filled fields`);
      } else {
        // Clear badge when no fields are filled
        await chrome.action.setBadgeText({
          tabId: tabId,
          text: ''
        });
        
        // Reset title to default
        await chrome.action.setTitle({
          tabId: tabId,
          title: 'Fields Autofill'
        });
        
        console.log(`Cleared icon badge for tab ${tabId}`);
      }
    } catch (error) {
      console.error('Error updating extension icon:', error);
    }
  }
}

// Initialize background service
const backgroundService = new BackgroundService();
