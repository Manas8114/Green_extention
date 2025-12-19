/**
 * Background Service Worker for EcoCheck
 * Handles communication between content script, popup and Gemini API
 */

import { analyzeProduct } from './utils/api.js';

// Timeout for analysis (30 seconds)
const ANALYSIS_TIMEOUT = 30000;

// Listen for messages from content script or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'analyzeProduct') {
    // Validate input data
    if (!request.data || !request.data.cleanedText) {
      sendResponse({ 
        success: false, 
        error: 'Invalid product data' 
      });
      return false;
    }
    
    // Validate data size (maximum 10KB)
    const dataSize = JSON.stringify(request.data).length;
    if (dataSize > 10240) {
      sendResponse({ 
        success: false, 
        error: 'Product data is too large' 
      });
      return false;
    }
    
    // Track if we've already responded to prevent race conditions
    let hasResponded = false;
    
    // Create timeout to prevent promise from hanging
    const timeoutId = setTimeout(() => {
      if (!hasResponded) {
        hasResponded = true;
        sendResponse({ 
          success: false, 
          error: 'Timeout: Analysis took too long' 
        });
      }
    }, ANALYSIS_TIMEOUT);
    
    handleProductAnalysis(request.data)
      .then(result => {
        clearTimeout(timeoutId);
        if (!hasResponded) {
          hasResponded = true;
          sendResponse({ success: true, data: result });
        }
      })
      .catch(error => {
        clearTimeout(timeoutId);
        if (!hasResponded) {
          hasResponded = true;
          sendResponse({ 
            success: false, 
            error: error.message || 'Unknown error in analysis' 
          });
        }
      });
    
    // Return true to indicate we will respond asynchronously
    return true;
  }
  
  if (request.action === 'getApiKey') {
    // Get API key from storage
    chrome.storage.sync.get(['geminiApiKey'], (result) => {
      if (chrome.runtime.lastError) {
        sendResponse({ apiKey: null, error: chrome.runtime.lastError.message });
      } else {
        sendResponse({ apiKey: result.geminiApiKey || null });
      }
    });
    return true;
  }
  
  if (request.action === 'saveApiKey') {
    // Validate API key
    if (!request.apiKey || typeof request.apiKey !== 'string' || request.apiKey.trim().length === 0) {
      sendResponse({ success: false, error: 'Invalid API key' });
      return false;
    }
    
    // Validate size (Gemini API keys are usually < 200 characters)
    if (request.apiKey.length > 500) {
      sendResponse({ success: false, error: 'API key too long' });
      return false;
    }
    
    // Save API key securely
    chrome.storage.sync.set({ geminiApiKey: request.apiKey.trim() }, () => {
      if (chrome.runtime.lastError) {
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
      } else {
        sendResponse({ success: true });
      }
    });
    return true;
  }
  
  if (request.action === 'clearOldAnalyses') {
    // Clear old analyses from storage
    clearOldAnalyses()
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  
  return false;
});

/**
 * Handles product analysis using Gemini API
 */
async function handleProductAnalysis(scrapedData) {
  try {
    // Get API key from storage
    const apiKey = await getStoredApiKey();
    
    if (!apiKey) {
      throw new Error('Gemini API key not configured. Please configure it in the popup.');
    }
    
    // Call analysis function with cleaned text
    const analysis = await analyzeProduct(scrapedData.cleanedText, apiKey);
    
    return analysis;
  } catch (error) {
    console.error('Error in product analysis:', error);
    throw error;
  }
}

/**
 * Gets the API key from Chrome storage
 */
function getStoredApiKey() {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.get(['geminiApiKey'], (result) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(result.geminiApiKey || null);
      }
    });
  });
}

/**
 * Clears old analyses from local storage
 * Keeps only the last analysis and removes all others
 */
async function clearOldAnalyses() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(null, (items) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      
      // Only keep lastAnalysis, remove everything else related to analyses
      const keysToRemove = Object.keys(items).filter(key => 
        key.startsWith('analysis_') || 
        (key === 'analysisHistory' && Array.isArray(items[key]) && items[key].length > 1)
      );
      
      if (keysToRemove.length > 0) {
        chrome.storage.local.remove(keysToRemove, () => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  });
}

// Clear old analyses when service worker starts
chrome.runtime.onStartup.addListener(() => {
  clearOldAnalyses().catch(console.error);
});

// Also clear when installed/updated
chrome.runtime.onInstalled.addListener(() => {
  clearOldAnalyses().catch(console.error);
});

