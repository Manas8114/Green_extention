/**
 * Content Script for EcoCheck
 * Injected into all pages and extracts product information
 */

import { scrapeProductData } from './utils/scraper.js';

// Detect if we're on a product page
let isProductPage = false;
let observer = null;
let initCalled = false;
let observerTimeout = null;

// Initialization function with protection against multiple calls
function init() {
  if (initCalled) return;
  initCalled = true;
  
  checkIfProductPage();
  
  // Only create observer if body exists
  if (document.body) {
    observer = new MutationObserver(() => {
      if (!isProductPage) {
        checkIfProductPage();
        // Disconnect after detecting product page to save resources
        if (isProductPage && observer) {
          observer.disconnect();
          observer = null;
        }
      }
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    // Disconnect after 30 seconds to prevent memory leaks
    observerTimeout = setTimeout(() => {
      if (observer) {
        observer.disconnect();
        observer = null;
      }
      if (observerTimeout) {
        clearTimeout(observerTimeout);
        observerTimeout = null;
      }
    }, 30000);
  }
}

// Clean up when page unloads
window.addEventListener('beforeunload', () => {
  if (observer) {
    observer.disconnect();
    observer = null;
  }
  if (observerTimeout) {
    clearTimeout(observerTimeout);
    observerTimeout = null;
  }
});

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  const domReadyHandler = () => {
    init();
    document.removeEventListener('DOMContentLoaded', domReadyHandler);
  };
  document.addEventListener('DOMContentLoaded', domReadyHandler);
} else {
  init();
}

/**
 * Checks if the current page appears to be a product page
 */
function checkIfProductPage() {
  // Search for common product page indicators
  const productIndicators = [
    'product-title',
    'product-name',
    'product-description',
    '[data-product-id]',
    '.product-info',
    '#product-details',
    'h1[itemprop="name"]',
    '[itemtype*="Product"]'
  ];
  
  const hasProductIndicator = productIndicators.some(selector => {
    try {
      return document.querySelector(selector) !== null;
    } catch (e) {
      return false;
    }
  });
  
  isProductPage = hasProductIndicator || document.querySelector('h1') !== null;
}

/**
 * Listen for messages from popup
 * Use a named function to be able to remove the listener if needed
 */
function handleMessage(request, sender, sendResponse) {
  if (request.action === 'scrapeProduct') {
    try {
      // Validate that body exists before scraping
      if (!document.body) {
        sendResponse({ 
          success: false, 
          error: 'Page content is not ready yet' 
        });
        return true;
      }
      
      const productData = scrapeProductData();
      
      // Validate that some data was extracted
      if (!productData || !productData.cleanedText || productData.cleanedText.trim().length === 0) {
        sendResponse({ 
          success: false, 
          error: 'Could not extract product information from this page' 
        });
        return true;
      }
      
      sendResponse({ success: true, data: productData });
    } catch (error) {
      console.error('Error extracting product data:', error);
      sendResponse({ 
        success: false, 
        error: error.message || 'Unknown error extracting data' 
      });
    }
    return true; // Indicates asynchronous response
  }
  return false;
}

chrome.runtime.onMessage.addListener(handleMessage);

