/**
 * ============================================
 * Aegir WebUI v2.3 - Application Logic
 * ============================================
 * 
 * Structure:
 *   1. Configuration Constants
 *   2. DOM Element References
 *   3. Utility Functions
 *   4. Core Functions
 *   5. Event Handlers
 *   6. Initialization
 * 
 * ============================================
 */

// ============================================
// 1. Configuration Constants
// ============================================
const CONFIG = {
  TIMEOUT_MS: 15000,          // Request timeout in milliseconds
  COPY_FEEDBACK_MS: 1500,     // Duration for "Copied!" feedback
  API_PATHS: {
    SUBSCRIPTION: '/api/v1/sub',
    CLASH: '/sub'
  },
  FORMATS: {
    RAW: 'raw',
    V2RAY: 'v2ray',
    CLASH: 'clash'
  }
};

// ============================================
// 2. DOM Element References
// ============================================
const Elements = {
  // Input fields
  bugInput: null,
  sniInput: null,
  ccInput: null,
  limitSelect: null,
  formatSelect: null,
  
  // Buttons
  mainBtn: null,
  copyBtn: null,
  openLinkBtn: null,
  
  // Containers
  resultArea: null,
  outputTextarea: null,
  errorDiv: null,
  
  /**
   * Initialize all DOM element references
   */
  init() {
    this.bugInput = document.getElementById('bug');
    this.sniInput = document.getElementById('sni');
    this.ccInput = document.getElementById('cc');
    this.limitSelect = document.getElementById('limit');
    this.formatSelect = document.getElementById('fmt');
    
    this.mainBtn = document.getElementById('main-btn');
    this.copyBtn = document.querySelector('.copy-btn');
    this.openLinkBtn = document.querySelector('.open-link-btn');
    
    this.resultArea = document.getElementById('result-area');
    this.outputTextarea = document.getElementById('output');
    this.errorDiv = document.getElementById('error');
  }
};

// ============================================
// 3. Utility Functions
// ============================================

/**
 * Set placeholder values based on current hostname
 */
function setPlaceholders() {
  const host = location.hostname;
  if (Elements.bugInput) {
    Elements.bugInput.placeholder = host;
  }
  if (Elements.sniInput) {
    Elements.sniInput.placeholder = host;
  }
}

/**
 * Get form values as an object
 * @returns {Object} Form values
 */
function getFormValues() {
  return {
    bug: Elements.bugInput?.value?.trim() || '',
    sni: Elements.sniInput?.value?.trim() || '',
    cc: Elements.ccInput?.value?.trim() || '',
    limit: Elements.limitSelect?.value || '50',
    format: Elements.formatSelect?.value || 'raw'
  };
}

/**
 * Build the target URL based on form values
 * @param {Object} values - Form values
 * @returns {string} Target URL
 */
function buildTargetUrl(values) {
  const params = new URLSearchParams();
  
  // Add optional parameters
  if (values.bug) {
    params.append('domain', values.bug);
  }
  if (values.sni) {
    params.append('sni', values.sni);
  }
  if (values.cc) {
    params.append('cc', values.cc.toUpperCase());
  }
  
  params.append('limit', values.limit);
  
  // Determine API path based on format
  let path;
  if (values.format === CONFIG.FORMATS.CLASH) {
    path = CONFIG.API_PATHS.CLASH;
    params.append('format', 'clash');
    if (values.sni) {
      params.append('host', values.sni);
    }
  } else {
    path = CONFIG.API_PATHS.SUBSCRIPTION;
    params.append('format', values.format);
  }
  
  return location.origin + path + '?' + params.toString();
}

/**
 * Show error message
 * @param {string} message - Error message to display
 */
function showError(message) {
  if (Elements.errorDiv) {
    Elements.errorDiv.innerText = message;
    Elements.errorDiv.style.display = 'block';
  }
}

/**
 * Hide error message
 */
function hideError() {
  if (Elements.errorDiv) {
    Elements.errorDiv.style.display = 'none';
  }
}

/**
 * Show result area
 */
function showResult() {
  if (Elements.resultArea) {
    Elements.resultArea.style.display = 'block';
  }
}

/**
 * Hide result area
 */
function hideResult() {
  if (Elements.resultArea) {
    Elements.resultArea.style.display = 'none';
  }
}

/**
 * Set button loading state
 * @param {boolean} isLoading - Whether button is in loading state
 */
function setButtonLoading(isLoading) {
  if (!Elements.mainBtn) return;
  
  Elements.mainBtn.disabled = isLoading;
  if (isLoading) {
    Elements.mainBtn.classList.add('loading');
    Elements.mainBtn.innerText = 'Processing...';
  } else {
    Elements.mainBtn.classList.remove('loading');
    Elements.mainBtn.innerText = 'Generate & Fetch Config';
  }
}

// ============================================
// 4. Core Functions
// ============================================

/**
 * Main function to generate and fetch config
 */
async function generateAndFetch() {
  // Reset UI state
  setButtonLoading(true);
  hideError();
  hideResult();
  if (Elements.outputTextarea) {
    Elements.outputTextarea.value = '';
  }
  
  try {
    const values = getFormValues();
    const targetUrl = buildTargetUrl(values);
    
    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONFIG.TIMEOUT_MS);
    
    // Fetch content
    const response = await fetch(targetUrl, {
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    
    // Check response status
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    // Get response text
    const text = await response.text();
    
    // Display result
    if (Elements.outputTextarea) {
      Elements.outputTextarea.value = text;
    }
    showResult();
    
    // Store URL for "Open Link" button
    window.generatedUrl = targetUrl;
    
  } catch (error) {
    // Handle different error types
    let errorMessage;
    if (error.name === 'AbortError') {
      errorMessage = 'Timeout: Server took too long';
    } else {
      errorMessage = 'Error: ' + error.message;
    }
    showError(errorMessage);
    
  } finally {
    setButtonLoading(false);
  }
}

/**
 * Copy output content to clipboard
 */
async function copyToClipboard() {
  if (!Elements.outputTextarea) return;
  
  try {
    Elements.outputTextarea.select();
    await navigator.clipboard.writeText(Elements.outputTextarea.value);
    
    // Show feedback
    const btn = Elements.copyBtn;
    if (btn) {
      const originalText = btn.innerText;
      btn.innerText = 'Copied!';
      setTimeout(() => {
        btn.innerText = originalText;
      }, CONFIG.COPY_FEEDBACK_MS);
    }
  } catch (error) {
    console.error('Failed to copy:', error);
  }
}

/**
 * Open generated URL in new tab
 */
function openGeneratedUrl() {
  if (window.generatedUrl) {
    window.open(window.generatedUrl, '_blank');
  }
}

// ============================================
// 5. Event Handlers
// ============================================

/**
 * Handle main button click
 */
function handleMainClick() {
  generateAndFetch().catch(console.error);
}

/**
 * Handle copy button click
 */
function handleCopyClick() {
  copyToClipboard().catch(console.error);
}

/**
 * Handle open link button click
 */
function handleOpenLinkClick() {
  openGeneratedUrl();
}

// ============================================
// 6. Initialization
// ============================================

/**
 * Initialize the application
 */
function init() {
  // Initialize DOM references
  Elements.init();
  
  // Set placeholders
  setPlaceholders();
  
  // Attach event listeners
  if (Elements.mainBtn) {
    Elements.mainBtn.addEventListener('click', handleMainClick);
  }
  
  if (Elements.copyBtn) {
    Elements.copyBtn.addEventListener('click', handleCopyClick);
  }
  
  if (Elements.openLinkBtn) {
    Elements.openLinkBtn.addEventListener('click', handleOpenLinkClick);
  }
  
  console.log('[Aegir WebUI] Initialized');
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Export functions for inline onclick handlers (backward compatibility)
window.run = generateAndFetch;
window.copy = copyToClipboard;
window.openUrl = openGeneratedUrl;
