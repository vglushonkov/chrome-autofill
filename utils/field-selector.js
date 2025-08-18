/**
 * Advanced field selector system for dynamic fields
 * Provides multiple selector strategies with fallback mechanisms
 */
class FieldSelector {
  
  /**
   * Generate comprehensive field selector data
   * @param {HTMLElement} element - Input element
   * @returns {Object} - Field selector data with multiple strategies
   */
  static generateFieldSelector(element) {
    const selectors = {
      primary: this.generatePrimarySelector(element),
      structural: this.generateStructuralSelector(element),
      contextual: this.generateContextualSelector(element),
      fuzzy_patterns: this.generateFuzzyPatterns(element),
      fallback_attributes: this.generateFallbackAttributes(element)
    };

    // Generate unique hash for this field configuration
    const hash = this.generateFieldHash(selectors);
    
    return {
      hash,
      selectors,
      confidence: this.calculateConfidence(selectors),
      created: Date.now()
    };
  }

  /**
   * Generate primary selector (most reliable)
   * Uses stable attributes like name, type, aria-label
   */
  static generatePrimarySelector(element) {
    const parts = [];
    
    // Tag and type
    parts.push(element.tagName.toLowerCase());
    if (element.type) {
      parts.push(`[type="${element.type}"]`);
    }
    
    // Prefer stable attributes
    if (element.name && !this.isDynamic(element.name)) {
      parts.push(`[name="${element.name}"]`);
    }
    
    if (element.getAttribute('aria-label')) {
      parts.push(`[aria-label="${element.getAttribute('aria-label')}"]`);
    }
    
    // Data attributes (usually stable)
    const dataAttrs = Array.from(element.attributes)
      .filter(attr => attr.name.startsWith('data-') && !this.isDynamic(attr.value))
      .map(attr => `[${attr.name}="${attr.value}"]`);
    parts.push(...dataAttrs);
    
    // Stable classes (not containing numbers/hashes)
    const stableClasses = this.getStableClasses(element);
    if (stableClasses.length > 0) {
      parts.push(stableClasses.map(cls => `.${cls}`).join(''));
    }
    
    return parts.join('');
  }

  /**
   * Generate structural selector based on DOM position
   */
  static generateStructuralSelector(element) {
    const path = [];
    let current = element;
    
    while (current && current !== document.body) {
      let selector = current.tagName.toLowerCase();
      
      // Add stable identifier if available
      if (current.id && !this.isDynamic(current.id)) {
        selector += `#${current.id}`;
        path.unshift(selector);
        break; // Stop at stable ID
      }
      
      // Add stable classes
      const stableClasses = this.getStableClasses(current);
      if (stableClasses.length > 0) {
        selector += stableClasses.map(cls => `.${cls}`).join('');
      }
      
      // Add nth-child if needed for uniqueness
      const siblings = Array.from(current.parentNode?.children || [])
        .filter(child => child.tagName === current.tagName);
      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1;
        selector += `:nth-child(${index})`;
      }
      
      path.unshift(selector);
      current = current.parentNode;
      
      // Limit depth to prevent overly long selectors
      if (path.length >= 5) break;
    }
    
    return path.join(' > ');
  }

  /**
   * Generate contextual selector based on surrounding elements
   */
  static generateContextualSelector(element) {
    const contextual = [];
    
    // Find associated label
    const label = this.findAssociatedLabel(element);
    if (label) {
      const labelText = label.textContent?.trim().toLowerCase();
      if (labelText) {
        contextual.push(`label[text*="${labelText}"] + input, label[text*="${labelText}"] input`);
      }
    }
    
    // Check for form context
    const form = element.closest('form');
    if (form) {
      let formSelector = 'form';
      if (form.className) {
        const stableClasses = this.getStableClasses(form);
        if (stableClasses.length > 0) {
          formSelector += stableClasses.map(cls => `.${cls}`).join('');
        }
      }
      if (form.id && !this.isDynamic(form.id)) {
        formSelector += `#${form.id}`;
      }
      contextual.push(`${formSelector} ${element.tagName.toLowerCase()}`);
    }
    
    // Check for fieldset context
    const fieldset = element.closest('fieldset');
    if (fieldset) {
      const legend = fieldset.querySelector('legend');
      if (legend?.textContent) {
        contextual.push(`fieldset legend[text*="${legend.textContent.trim()}"] + * input`);
      }
    }
    
    return contextual;
  }

  /**
   * Generate fuzzy patterns for flexible matching
   */
  static generateFuzzyPatterns(element) {
    const patterns = [];
    
    // Name patterns
    if (element.name) {
      const cleanName = this.cleanDynamicParts(element.name);
      if (cleanName !== element.name) {
        patterns.push(`[name*="${cleanName}"]`);
        patterns.push(`[name^="${cleanName}"]`);
      }
    }
    
    // ID patterns
    if (element.id) {
      const cleanId = this.cleanDynamicParts(element.id);
      if (cleanId !== element.id) {
        patterns.push(`[id*="${cleanId}"]`);
        patterns.push(`[id^="${cleanId}"]`);
      }
    }
    
    // Placeholder patterns
    if (element.placeholder) {
      patterns.push(`[placeholder="${element.placeholder}"]`);
      patterns.push(`[placeholder*="${element.placeholder.substring(0, 10)}"]`);
    }
    
    // Class patterns
    element.classList.forEach(cls => {
      if (!this.isDynamic(cls)) {
        patterns.push(`.${cls}`);
      } else {
        const cleanCls = this.cleanDynamicParts(cls);
        if (cleanCls) {
          patterns.push(`[class*="${cleanCls}"]`);
        }
      }
    });
    
    return [...new Set(patterns)]; // Remove duplicates
  }

  /**
   * Generate fallback attributes for semantic matching
   */
  static generateFallbackAttributes(element) {
    const attributes = {
      tag: element.tagName.toLowerCase(),
      type: element.type || null,
      placeholder_pattern: element.placeholder ? 
        this.createPlaceholderPattern(element.placeholder) : null,
      label_text: null,
      aria_label: element.getAttribute('aria-label') || null,
      autocomplete: element.getAttribute('autocomplete') || null,
      required: element.required || false,
      position_hint: this.getPositionHint(element)
    };
    
    // Get label text
    const label = this.findAssociatedLabel(element);
    if (label) {
      attributes.label_text = label.textContent?.trim().toLowerCase() || null;
    }
    
    return attributes;
  }

  /**
   * Find element using selector data with confidence scoring
   * @param {Object} selectorData - Selector data object
   * @param {HTMLElement} contextElement - Context element (optional)
   * @returns {Object} - {element, confidence, method}
   */
  static findElementBySelector(selectorData, contextElement = document) {
    const results = [];
    
    // Try primary selector first
    if (selectorData.selectors.primary) {
      try {
        const elements = contextElement.querySelectorAll(selectorData.selectors.primary);
        if (elements.length === 1) {
          results.push({
            element: elements[0],
            confidence: 0.95,
            method: 'primary'
          });
        } else if (elements.length > 1) {
          // Multiple matches - need additional filtering
          const best = this.disambiguateElements(elements, selectorData);
          if (best) {
            results.push({
              element: best,
              confidence: 0.85,
              method: 'primary_disambiguated'
            });
          }
        }
      } catch (e) {
        console.warn('Primary selector failed:', e);
      }
    }
    
    // Try structural selector
    if (results.length === 0 && selectorData.selectors.structural) {
      try {
        const element = contextElement.querySelector(selectorData.selectors.structural);
        if (element && this.isInputField(element)) {
          results.push({
            element,
            confidence: 0.80,
            method: 'structural'
          });
        }
      } catch (e) {
        console.warn('Structural selector failed:', e);
      }
    }
    
    // Try contextual selectors
    if (results.length === 0 && selectorData.selectors.contextual) {
      for (const selector of selectorData.selectors.contextual) {
        try {
          const elements = contextElement.querySelectorAll(selector);
          const validElements = Array.from(elements).filter(el => this.isInputField(el));
          
          if (validElements.length === 1) {
            results.push({
              element: validElements[0],
              confidence: 0.75,
              method: 'contextual'
            });
            break;
          }
        } catch (e) {
          console.warn('Contextual selector failed:', selector, e);
        }
      }
    }
    
    // Try fuzzy patterns
    if (results.length === 0 && selectorData.selectors.fuzzy_patterns) {
      const candidates = [];
      
      for (const pattern of selectorData.selectors.fuzzy_patterns) {
        try {
          const elements = contextElement.querySelectorAll(pattern);
          Array.from(elements).forEach(el => {
            if (this.isInputField(el)) {
              candidates.push(el);
            }
          });
        } catch (e) {
          console.warn('Fuzzy pattern failed:', pattern, e);
        }
      }
      
      // Score candidates based on attribute similarity
      if (candidates.length > 0) {
        const scored = candidates.map(el => ({
          element: el,
          score: this.calculateElementSimilarity(el, selectorData.selectors.fallback_attributes)
        })).sort((a, b) => b.score - a.score);
        
        const best = scored[0];
        if (best.score > 0.5) {
          results.push({
            element: best.element,
            confidence: Math.min(0.70, best.score),
            method: 'fuzzy'
          });
        }
      }
    }
    
    // Return best result
    return results.length > 0 ? results[0] : null;
  }

  /**
   * Helper methods
   */
  
  static isDynamic(value) {
    if (!value) return false;
    // Check for patterns that suggest dynamic generation
    return /\d{4,}|[a-f0-9]{8,}|uuid|guid|timestamp|random/i.test(value);
  }
  
  static getStableClasses(element) {
    return Array.from(element.classList)
      .filter(cls => !this.isDynamic(cls) && cls.length > 2);
  }
  
  static cleanDynamicParts(value) {
    return value
      .replace(/\d{4,}/g, '') // Remove long numbers
      .replace(/[a-f0-9]{8,}/g, '') // Remove hex strings
      .replace(/[-_]+$/, '') // Remove trailing separators
      .replace(/^[-_]+/, '') // Remove leading separators
      .trim();
  }
  
  static createPlaceholderPattern(placeholder) {
    return placeholder.toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove special chars
      .split(/\s+/)
      .filter(word => word.length > 2)
      .slice(0, 3) // Take first 3 meaningful words
      .join('|'); // Create pattern
  }
  
  static getPositionHint(element) {
    const inputs = Array.from(document.querySelectorAll('input, textarea, select'));
    const index = inputs.indexOf(element);
    const total = inputs.length;
    
    if (total <= 3) return `${index + 1}of${total}`;
    if (index < total * 0.25) return 'early';
    if (index > total * 0.75) return 'late';
    return 'middle';
  }
  
  static findAssociatedLabel(element) {
    // Try for attribute
    if (element.id) {
      const label = document.querySelector(`label[for="${element.id}"]`);
      if (label) return label;
    }
    
    // Try parent label
    const parentLabel = element.closest('label');
    if (parentLabel) return parentLabel;
    
    // Try preceding label
    const prevElement = element.previousElementSibling;
    if (prevElement && prevElement.tagName === 'LABEL') {
      return prevElement;
    }
    
    return null;
  }
  
  static generateFieldHash(selectors) {
    const str = JSON.stringify(selectors, Object.keys(selectors).sort());
    return this.simpleHash(str).toString(36);
  }
  
  static simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }
  
  static calculateConfidence(selectors) {
    let confidence = 0.5; // Base confidence
    
    if (selectors.primary?.includes('[name=')) confidence += 0.2;
    if (selectors.primary?.includes('[aria-label=')) confidence += 0.15;
    if (selectors.primary?.includes('[data-')) confidence += 0.1;
    if (selectors.contextual?.length > 0) confidence += 0.05;
    
    return Math.min(confidence, 0.95);
  }
  
  static disambiguateElements(elements, selectorData) {
    // Use fallback attributes to pick the best match
    const scored = Array.from(elements).map(el => ({
      element: el,
      score: this.calculateElementSimilarity(el, selectorData.selectors.fallback_attributes)
    }));
    
    scored.sort((a, b) => b.score - a.score);
    return scored[0]?.score > 0.7 ? scored[0].element : null;
  }
  
  static calculateElementSimilarity(element, attributes) {
    let score = 0;
    let checks = 0;
    
    // Check type
    if (attributes.type) {
      checks++;
      if (element.type === attributes.type) score++;
    }
    
    // Check placeholder pattern
    if (attributes.placeholder_pattern && element.placeholder) {
      checks++;
      const patterns = attributes.placeholder_pattern.split('|');
      if (patterns.some(pattern => 
        element.placeholder.toLowerCase().includes(pattern))) {
        score++;
      }
    }
    
    // Check label text
    if (attributes.label_text) {
      checks++;
      const label = this.findAssociatedLabel(element);
      if (label && label.textContent.toLowerCase().includes(attributes.label_text)) {
        score++;
      }
    }
    
    // Check aria-label
    if (attributes.aria_label) {
      checks++;
      if (element.getAttribute('aria-label') === attributes.aria_label) {
        score++;
      }
    }
    
    // Check required
    checks++;
    if (element.required === attributes.required) score++;
    
    return checks > 0 ? score / checks : 0;
  }
  
  static isInputField(element) {
    const validTags = ['INPUT', 'TEXTAREA', 'SELECT'];
    const validTypes = ['text', 'email', 'password', 'tel', 'url', 'search', 'number'];
    
    if (!validTags.includes(element.tagName)) {
      return false;
    }
    
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
      'textarea',
      'select'
    ];
    
    return Array.from(document.querySelectorAll(selectors.join(', ')));
  }
}

// Make available globally
window.FieldSelector = FieldSelector;
