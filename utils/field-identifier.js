/**
 * Utility for generating unique field identifiers
 */
class FieldIdentifier {
  /**
   * Generate unique ID for input field based on all available attributes
   * @param {HTMLElement} element - Input element
   * @returns {string} - Unique field identifier
   */
  static generateFieldId(element) {
    const parts = [];
    
    // 1. Add element tag
    parts.push(element.tagName.toLowerCase());
    
    // 2. Add type if exists
    if (element.type) {
      parts.push(element.type);
    }
    
    // 3. Add id if exists
    if (element.id) {
      parts.push(element.id);
    }
    
    // 4. Add name if exists
    if (element.name) {
      parts.push(element.name);
    }
    
    // 5. Add placeholder if exists (cleaned from spaces)
    if (element.placeholder) {
      parts.push(element.placeholder.replace(/\s+/g, ''));
    }
    
    // 6. Add element position on page as fallback
    const inputs = document.querySelectorAll('input, textarea, select');
    const index = Array.from(inputs).indexOf(element);
    parts.push(`pos${index}`);
    
    // Join all parts with underscore
    return parts.join('_');
  }

  /**
   * Check if element is a valid input field
   * @param {HTMLElement} element - Element to check
   * @returns {boolean} - True if element is input field
   */
  static isInputField(element) {
    const validTags = ['INPUT', 'TEXTAREA', 'SELECT'];
    const validTypes = ['text', 'email', 'password', 'tel', 'url', 'search', 'number', 'checkbox', 'radio'];
    
    if (!validTags.includes(element.tagName)) {
      return false;
    }
    
    // For input elements, check type
    if (element.tagName === 'INPUT') {
      return validTypes.includes(element.type);
    }
    
    return true;
  }

  /**
   * Get all input fields on the page
   * @returns {Array<HTMLElement>} - Array of input elements
   */
  static getAllInputFields() {
    const selectors = [
      'input[type="text"]',
      'input[type="email"]',
      'input[type="password"]',
      'input[type="tel"]',
      'input[type="url"]',
      'input[type="search"]',
      'input[type="number"]',
      'input[type="checkbox"]',
      'input[type="radio"]',
      'textarea',
      'select'
    ];
    
    return Array.from(document.querySelectorAll(selectors.join(', ')));
  }
}

// Make available globally
window.FieldIdentifier = FieldIdentifier;
