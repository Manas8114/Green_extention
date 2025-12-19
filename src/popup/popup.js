/**
 * Main script for EcoCheck popup
 */

import { formatLabel, formatConfidence, formatBreakdown, validateAnalysis } from '../utils/parser.js';

// DOM element references
const elements = {
  apiKeySection: document.getElementById('apiKeySection'),
  apiKeyInput: document.getElementById('apiKeyInput'),
  saveApiKeyBtn: document.getElementById('saveApiKeyBtn'),
  apiKeyError: document.getElementById('apiKeyError'),
  
  loadingState: document.getElementById('loadingState'),
  errorState: document.getElementById('errorState'),
  errorMessage: document.getElementById('errorMessage'),
  retryBtn: document.getElementById('retryBtn'),
  noAnalysisState: document.getElementById('noAnalysisState'),
  analyzeBtn: document.getElementById('analyzeBtn'),
  
  resultState: document.getElementById('resultState'),
  resultBadge: document.getElementById('resultBadge'),
  resultLabel: document.getElementById('resultLabel'),
  resultConfidence: document.getElementById('resultConfidence'),
  resultSummary: document.getElementById('resultSummary'),
  showBreakdownBtn: document.getElementById('showBreakdownBtn'),
  breakdownBtnText: document.getElementById('breakdownBtnText'),
  breakdownSection: document.getElementById('breakdownSection'),
  breakdownContent: document.getElementById('breakdownContent'),
  analyzeAgainBtn: document.getElementById('analyzeAgainBtn')
};

let currentAnalysis = null;
let breakdownExpanded = false;
let eventListeners = [];
let messageTimeout = null;
let isAnalyzing = false;

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

async function init() {
  // Check if API key is saved
  const apiKey = await getApiKey();
  
  if (!apiKey) {
    showApiKeySection();
  } else {
    hideApiKeySection();
    showNoAnalysisState();
  }
  
  // Event listeners
  setupEventListeners();
  
  // Load previous analysis if exists
  loadPreviousAnalysis();
}

function setupEventListeners() {
  // Clean up previous listeners if they exist
  cleanupEventListeners();
  
  // Save API key
  const saveKeyHandler = () => handleSaveApiKey();
  const keypressHandler = (e) => {
    if (e.key === 'Enter') {
      handleSaveApiKey();
    }
  };
  
  elements.saveApiKeyBtn.addEventListener('click', saveKeyHandler);
  elements.apiKeyInput.addEventListener('keypress', keypressHandler);
  eventListeners.push(
    { element: elements.saveApiKeyBtn, event: 'click', handler: saveKeyHandler },
    { element: elements.apiKeyInput, event: 'keypress', handler: keypressHandler }
  );
  
  // Analyze product
  const analyzeHandler = () => handleAnalyze();
  elements.analyzeBtn.addEventListener('click', analyzeHandler);
  elements.retryBtn.addEventListener('click', analyzeHandler);
  elements.analyzeAgainBtn.addEventListener('click', analyzeHandler);
  eventListeners.push(
    { element: elements.analyzeBtn, event: 'click', handler: analyzeHandler },
    { element: elements.retryBtn, event: 'click', handler: analyzeHandler },
    { element: elements.analyzeAgainBtn, event: 'click', handler: analyzeHandler }
  );
  
  // Show/hide breakdown
  const breakdownHandler = () => toggleBreakdown();
  elements.showBreakdownBtn.addEventListener('click', breakdownHandler);
  eventListeners.push(
    { element: elements.showBreakdownBtn, event: 'click', handler: breakdownHandler }
  );
}

function cleanupEventListeners() {
  eventListeners.forEach(({ element, event, handler }) => {
    if (element && handler) {
      element.removeEventListener(event, handler);
    }
  });
  eventListeners = [];
}

// Clean up when popup closes
window.addEventListener('beforeunload', () => {
  cleanupEventListeners();
  if (messageTimeout) {
    clearTimeout(messageTimeout);
  }
});

async function getApiKey() {
  return new Promise((resolve, reject) => {
    // Timeout to prevent hanging
    const timeout = setTimeout(() => {
      reject(new Error('Timeout getting API key'));
    }, 5000);
    
    try {
      chrome.runtime.sendMessage({ action: 'getApiKey' }, (response) => {
        clearTimeout(timeout);
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response?.apiKey || null);
        }
      });
    } catch (error) {
      clearTimeout(timeout);
      reject(error);
    }
  });
}

async function saveApiKey(apiKey) {
  return new Promise((resolve, reject) => {
    // Timeout to prevent hanging
    const timeout = setTimeout(() => {
      reject(new Error('Timeout saving API key'));
    }, 5000);
    
    try {
      chrome.runtime.sendMessage(
        { action: 'saveApiKey', apiKey },
        (response) => {
          clearTimeout(timeout);
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else if (response?.success) {
            resolve();
          } else {
            reject(new Error(response?.error || 'Error saving API key'));
          }
        }
      );
    } catch (error) {
      clearTimeout(timeout);
      reject(error);
    }
  });
}

function showApiKeySection() {
  elements.apiKeySection.classList.remove('hidden');
  hideAllStates();
}

function hideApiKeySection() {
  elements.apiKeySection.classList.add('hidden');
}

async function handleSaveApiKey() {
  const apiKey = elements.apiKeyInput.value.trim();
  
  if (!apiKey) {
    showError('Please enter a valid API key');
    return;
  }
  
  try {
    elements.saveApiKeyBtn.disabled = true;
    elements.apiKeyError.textContent = '';
    
    await saveApiKey(apiKey);
    
    hideApiKeySection();
    showNoAnalysisState();
    elements.apiKeyInput.value = '';
  } catch (error) {
    showError('Error saving API key. Please try again.');
  } finally {
    elements.saveApiKeyBtn.disabled = false;
  }
}

function showError(message) {
  elements.apiKeyError.textContent = message;
  elements.apiKeyError.style.display = 'block';
}

async function handleAnalyze() {
  // Prevent multiple simultaneous analyses
  if (isAnalyzing) {
    return;
  }
  
  // Check API key
  const apiKey = await getApiKey();
  if (!apiKey) {
    showApiKeySection();
    return;
  }
  
  // Get active tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  if (!tab) {
    showErrorState('Could not access current tab');
    return;
  }
  
  // Clear any existing timeout before starting new analysis
  if (messageTimeout) {
    clearTimeout(messageTimeout);
    messageTimeout = null;
  }
  
  // Set analyzing flag
  isAnalyzing = true;
  
  // Show loading state
  showLoadingState();
  
  try {
    // Timeout for complete operation
    messageTimeout = setTimeout(() => {
      isAnalyzing = false;
      messageTimeout = null;
      showErrorState('Operation took too long. Please try again.');
    }, 35000);
    
    // Ask content script to extract data
    chrome.tabs.sendMessage(tab.id, { action: 'scrapeProduct' }, async (response) => {
      if (chrome.runtime.lastError) {
        if (messageTimeout) {
          clearTimeout(messageTimeout);
          messageTimeout = null;
        }
        isAnalyzing = false;
        showErrorState('Error communicating with page. Make sure you are on a product page.');
        return;
      }
      
      if (!response || !response.success) {
        if (messageTimeout) {
          clearTimeout(messageTimeout);
          messageTimeout = null;
        }
        isAnalyzing = false;
        showErrorState(response?.error || 'Error extracting product data');
        return;
      }
      
      // Validate data size before sending
      const dataSize = JSON.stringify(response.data).length;
      if (dataSize > 10240) {
        if (messageTimeout) {
          clearTimeout(messageTimeout);
          messageTimeout = null;
        }
        isAnalyzing = false;
        showErrorState('Extracted data is too large. Try another page.');
        return;
      }
      
      // Send data to background for analysis
      chrome.runtime.sendMessage(
        { action: 'analyzeProduct', data: response.data },
        (analysisResponse) => {
          if (messageTimeout) {
            clearTimeout(messageTimeout);
            messageTimeout = null;
          }
          isAnalyzing = false;
          
          if (chrome.runtime.lastError) {
            showErrorState('Error communicating with analysis service: ' + chrome.runtime.lastError.message);
            return;
          }
          
          if (!analysisResponse || !analysisResponse.success) {
            showErrorState(analysisResponse?.error || 'Error analyzing product');
            return;
          }
          
          // Show result
          displayAnalysis(analysisResponse.data);
          
          // Save analysis for future reference (with limit)
          saveAnalysis(analysisResponse.data);
        }
      );
    });
  } catch (error) {
    if (messageTimeout) {
      clearTimeout(messageTimeout);
      messageTimeout = null;
    }
    isAnalyzing = false;
    console.error('Error in analysis:', error);
    showErrorState(error.message || 'Unknown error');
  }
}

function showLoadingState() {
  hideAllStates();
  elements.loadingState.classList.remove('hidden');
}

function showErrorState(message) {
  hideAllStates();
  elements.errorState.classList.remove('hidden');
  elements.errorMessage.textContent = message;
}

function showNoAnalysisState() {
  hideAllStates();
  elements.noAnalysisState.classList.remove('hidden');
}

function showResultState() {
  hideAllStates();
  elements.resultState.classList.remove('hidden');
}

function hideAllStates() {
  elements.loadingState.classList.add('hidden');
  elements.errorState.classList.add('hidden');
  elements.noAnalysisState.classList.add('hidden');
  elements.resultState.classList.add('hidden');
}

function displayAnalysis(analysis) {
  if (!validateAnalysis(analysis)) {
    showErrorState('Received analysis has invalid format');
    return;
  }
  
  // Add timestamp to analysis
  analysis._timestamp = Date.now();
  currentAnalysis = analysis;
  
  // Format and show badge
  const labelInfo = formatLabel(analysis.label);
  elements.resultLabel.textContent = labelInfo.display;
  elements.resultLabel.className = `label-text ${labelInfo.class}`;
  elements.resultConfidence.textContent = `Confidence: ${formatConfidence(analysis.confidence)}`;
  
  // Show summary (limit length to avoid memory issues)
  const summary = analysis.summary || 'No summary available.';
  elements.resultSummary.textContent = summary.length > 500 
    ? summary.substring(0, 500) + '...' 
    : summary;
  
  // Reset breakdown
  breakdownExpanded = false;
  elements.breakdownSection.classList.add('hidden');
  elements.breakdownBtnText.textContent = 'Show Breakdown';
  const arrow = elements.showBreakdownBtn.querySelector('.arrow');
  if (arrow) {
    arrow.classList.remove('rotated');
  }
  
  showResultState();
}

function toggleBreakdown() {
  if (!currentAnalysis) return;
  
  breakdownExpanded = !breakdownExpanded;
  
  if (breakdownExpanded) {
    // Show breakdown
    const breakdown = formatBreakdown(currentAnalysis.explanation);
    renderBreakdown(breakdown);
    elements.breakdownSection.classList.remove('hidden');
    elements.breakdownBtnText.textContent = 'Hide Breakdown';
    elements.showBreakdownBtn.querySelector('.arrow').classList.add('rotated');
  } else {
    // Hide breakdown
    elements.breakdownSection.classList.add('hidden');
    elements.breakdownBtnText.textContent = 'Show Breakdown';
    elements.showBreakdownBtn.querySelector('.arrow').classList.remove('rotated');
  }
}

function renderBreakdown(breakdown) {
  elements.breakdownContent.innerHTML = '';
  
  breakdown.forEach(item => {
    const itemDiv = document.createElement('div');
    itemDiv.className = 'breakdown-item';
    
    const header = document.createElement('div');
    header.className = 'breakdown-item-header';
    
    const icon = document.createElement('span');
    icon.className = 'breakdown-item-icon';
    icon.textContent = item.icon;
    
    const title = document.createElement('span');
    title.className = 'breakdown-item-title';
    title.textContent = item.title;
    
    header.appendChild(icon);
    header.appendChild(title);
    
    const value = document.createElement('div');
    value.className = 'breakdown-item-value';
    
    if (item.isList && Array.isArray(item.value)) {
      if (item.value.length === 0) {
        value.textContent = 'No certifications found';
      } else {
        const list = document.createElement('ul');
        list.className = 'breakdown-item-list';
        item.value.forEach(cert => {
          const li = document.createElement('li');
          li.textContent = cert;
          list.appendChild(li);
        });
        value.appendChild(list);
      }
    } else {
      value.textContent = item.value;
    }
    
    itemDiv.appendChild(header);
    itemDiv.appendChild(value);
    elements.breakdownContent.appendChild(itemDiv);
  });
}

function saveAnalysis(analysis) {
  // Validate size before saving (maximum 50KB per analysis)
  const analysisSize = JSON.stringify(analysis).length;
  if (analysisSize > 51200) {
    console.warn('Analysis too large to save:', analysisSize);
    return;
  }
  
  // Save only the last analysis (don't accumulate history)
  chrome.storage.local.set({ lastAnalysis: analysis }, () => {
    if (chrome.runtime.lastError) {
      console.error('Error saving analysis:', chrome.runtime.lastError);
    } else {
      // Periodically clean old analyses
      chrome.runtime.sendMessage({ action: 'clearOldAnalyses' }, () => {
        // Ignore cleanup errors
      });
    }
  });
}

function loadPreviousAnalysis() {
  chrome.storage.local.get(['lastAnalysis'], (result) => {
    if (chrome.runtime.lastError) {
      console.error('Error loading previous analysis:', chrome.runtime.lastError);
      return;
    }
    
    if (result.lastAnalysis && validateAnalysis(result.lastAnalysis)) {
      // Validate that analysis is not too old (maximum 1 hour)
      const analysisAge = result.lastAnalysis._timestamp 
        ? Date.now() - result.lastAnalysis._timestamp 
        : Infinity;
      
      if (analysisAge < 3600000) { // 1 hour in ms
        currentAnalysis = result.lastAnalysis;
        displayAnalysis(result.lastAnalysis);
      } else {
        // Remove old analysis
        chrome.storage.local.remove(['lastAnalysis']);
      }
    }
  });
}

