/**
 * ============================================
 * Aegir WebUI - Template Module
 * ============================================
 * 
 * This module provides the WebUI HTML for Cloudflare Workers.
 * 
 * For development:
 *   - Edit the separate CSS/JS/HTML files in src/webui/
 *   - Run: node scripts/build-webui.js to update this file
 * 
 * For production:
 *   - This file is imported directly by index.js
 *   - HTML is pre-built and optimized
 * 
 * ============================================
 */

// CSS Styles - Embedded from styles.css
const CSS_STYLES = `
/* ============================================
 * Aegir WebUI v2.3 - Stylesheet
 * ============================================
 * Structure:
 *   1. CSS Variables (Design Tokens)
 *   2. Base Reset
 *   3. Layout Components
 *   4. Form Elements
 *   5. Buttons
 *   6. Result Area
 *   7. Animations
 *   8. Utility Classes
 * ============================================ */

/* ============================================
 * 1. CSS Variables (Design Tokens)
 * ============================================ */
:root {
  /* Colors */
  --primary: #00f2ea;
  --bg: #050505;
  --panel: #111;
  --text: #eee;
  --border: #333;
  
  /* Typography */
  --font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  --font-mono: 'SF Mono', 'Fira Code', 'Consolas', monospace;
  
  /* Spacing */
  --spacing-xs: 5px;
  --spacing-sm: 10px;
  --spacing-md: 15px;
  --spacing-lg: 20px;
  --spacing-xl: 25px;
  
  /* Border Radius */
  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 12px;
  
  /* Transitions */
  --transition-fast: 0.2s ease;
  --transition-normal: 0.3s ease;
  
  /* Shadows */
  --shadow-card: 0 10px 40px rgba(0, 0, 0, 0.6);
}

/* ============================================
 * 2. Base Reset
 * ============================================ */
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

/* ============================================
 * 3. Layout Components
 * ============================================ */
body {
  background: var(--bg);
  color: var(--text);
  font-family: var(--font-family);
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  margin: 0;
  padding: var(--spacing-md);
}

.card {
  background: var(--panel);
  width: 100%;
  max-width: 420px;
  padding: var(--spacing-xl);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-card);
}

/* ============================================
 * 4. Form Elements
 * ============================================ */

/* Header */
.page-title {
  text-align: center;
  margin: 0 0 var(--spacing-lg);
  color: var(--primary);
  font-weight: 800;
  letter-spacing: 1px;
}

.page-title .version-badge {
  font-size: 0.4em;
  color: #666;
  vertical-align: middle;
  background: #222;
  padding: 2px 6px;
  border-radius: var(--radius-sm);
}

/* Form Groups */
.group {
  margin-bottom: var(--spacing-md);
}

.group-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--spacing-sm);
}

/* Labels */
label {
  display: block;
  margin-bottom: var(--spacing-xs);
  font-size: 0.75rem;
  color: #888;
  text-transform: uppercase;
  font-weight: 700;
  letter-spacing: 0.5px;
}

/* Input Fields */
input,
select,
textarea {
  width: 100%;
  background: #000;
  border: 1px solid #2a2a2a;
  color: #fff;
  padding: var(--spacing-sm);
  border-radius: var(--radius-md);
  font-size: 14px;
  transition: border var(--transition-fast);
}

input:focus,
select:focus,
textarea:focus {
  border-color: var(--primary);
  outline: none;
}

/* Select Dropdown */
select {
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='%23888' viewBox='0 0 16 16'%3E%3Cpath d='M8 11L3 6h10l-5 5z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 10px center;
  padding-right: 30px;
}

/* ============================================
 * 5. Buttons
 * ============================================ */
.btn {
  width: 100%;
  font-weight: 800;
  border: none;
  padding: 12px;
  border-radius: var(--radius-md);
  cursor: pointer;
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-top: var(--spacing-sm);
  transition: opacity var(--transition-fast);
}

.btn:hover {
  opacity: 0.9;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Primary Button */
.btn-primary {
  background: var(--primary);
  color: #000;
}

/* Secondary Button */
.btn-secondary {
  background: #222;
  color: #fff;
  font-weight: 600;
  font-size: 12px;
}

.btn-secondary:hover {
  background: #333;
}

/* Button Group */
.actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--spacing-sm);
  margin-top: var(--spacing-xs);
}

/* ============================================
 * 6. Result Area
 * ============================================ */
#result-area {
  margin-top: var(--spacing-lg);
  display: none;
  animation: fadeIn var(--transition-normal);
}

textarea {
  height: 120px;
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: 1.4;
  color: #a5f3fc;
  resize: vertical;
  border-color: #333;
}

/* Error Message */
.error-msg {
  color: #ff4444;
  font-size: 12px;
  margin-top: var(--spacing-sm);
  text-align: center;
  display: none;
}

/* ============================================
 * 7. Animations
 * ============================================ */
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(5px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.6;
  }
}

/* ============================================
 * 8. Utility Classes
 * ============================================ */
.hidden {
  display: none !important;
}

.visible {
  display: block !important;
}

.text-center {
  text-align: center;
}

.mt-10 {
  margin-top: var(--spacing-sm);
}

.mt-20 {
  margin-top: var(--spacing-lg);
}

/* Loading State */
.btn.loading {
  position: relative;
  color: transparent;
}

.btn.loading::after {
  content: '';
  position: absolute;
  width: 16px;
  height: 16px;
  top: 50%;
  left: 50%;
  margin-left: -8px;
  margin-top: -8px;
  border: 2px solid #000;
  border-radius: 50%;
  border-top-color: transparent;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
`;

// JavaScript Application - Embedded from app.js
const JS_APP = `
/**
 * ============================================
 * Aegir WebUI v2.3 - Application Logic
 * ============================================
 */

// Configuration Constants
const CONFIG = {
  TIMEOUT_MS: 15000,
  COPY_FEEDBACK_MS: 1500,
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

// DOM Element References
const Elements = {
  bugInput: null,
  sniInput: null,
  ccInput: null,
  limitSelect: null,
  formatSelect: null,
  mainBtn: null,
  copyBtn: null,
  openLinkBtn: null,
  resultArea: null,
  outputTextarea: null,
  errorDiv: null,
  
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

// Utility Functions
function setPlaceholders() {
  const host = location.hostname;
  if (Elements.bugInput) Elements.bugInput.placeholder = host;
  if (Elements.sniInput) Elements.sniInput.placeholder = host;
}

function getFormValues() {
  return {
    bug: Elements.bugInput?.value?.trim() || '',
    sni: Elements.sniInput?.value?.trim() || '',
    cc: Elements.ccInput?.value?.trim() || '',
    limit: Elements.limitSelect?.value || '50',
    format: Elements.formatSelect?.value || 'raw'
  };
}

function buildTargetUrl(values) {
  const params = new URLSearchParams();
  if (values.bug) params.append('domain', values.bug);
  if (values.sni) params.append('sni', values.sni);
  if (values.cc) params.append('cc', values.cc.toUpperCase());
  params.append('limit', values.limit);
  
  let path;
  if (values.format === CONFIG.FORMATS.CLASH) {
    path = CONFIG.API_PATHS.CLASH;
    params.append('format', 'clash');
    if (values.sni) params.append('host', values.sni);
  } else {
    path = CONFIG.API_PATHS.SUBSCRIPTION;
    params.append('format', values.format);
  }
  
  return location.origin + path + '?' + params.toString();
}

function showError(message) {
  if (Elements.errorDiv) {
    Elements.errorDiv.innerText = message;
    Elements.errorDiv.style.display = 'block';
  }
}

function hideError() {
  if (Elements.errorDiv) Elements.errorDiv.style.display = 'none';
}

function showResult() {
  if (Elements.resultArea) Elements.resultArea.style.display = 'block';
}

function hideResult() {
  if (Elements.resultArea) Elements.resultArea.style.display = 'none';
}

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

// Core Functions
async function generateAndFetch() {
  setButtonLoading(true);
  hideError();
  hideResult();
  if (Elements.outputTextarea) Elements.outputTextarea.value = '';
  
  try {
    const values = getFormValues();
    const targetUrl = buildTargetUrl(values);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONFIG.TIMEOUT_MS);
    
    const response = await fetch(targetUrl, { signal: controller.signal });
    clearTimeout(timeoutId);
    
    if (!response.ok) throw new Error('HTTP ' + response.status);
    
    const text = await response.text();
    if (Elements.outputTextarea) Elements.outputTextarea.value = text;
    showResult();
    window.generatedUrl = targetUrl;
    
  } catch (error) {
    let errorMessage = error.name === 'AbortError' 
      ? 'Timeout: Server took too long' 
      : 'Error: ' + error.message;
    showError(errorMessage);
  } finally {
    setButtonLoading(false);
  }
}

async function copyToClipboard() {
  if (!Elements.outputTextarea) return;
  try {
    Elements.outputTextarea.select();
    await navigator.clipboard.writeText(Elements.outputTextarea.value);
    const btn = Elements.copyBtn;
    if (btn) {
      const originalText = btn.innerText;
      btn.innerText = 'Copied!';
      setTimeout(() => { btn.innerText = originalText; }, CONFIG.COPY_FEEDBACK_MS);
    }
  } catch (error) {
    console.error('Failed to copy:', error);
  }
}

function openGeneratedUrl() {
  if (window.generatedUrl) window.open(window.generatedUrl, '_blank');
}

// Initialization
function init() {
  Elements.init();
  setPlaceholders();
  if (Elements.mainBtn) Elements.mainBtn.addEventListener('click', generateAndFetch);
  if (Elements.copyBtn) Elements.copyBtn.addEventListener('click', copyToClipboard);
  if (Elements.openLinkBtn) Elements.openLinkBtn.addEventListener('click', openGeneratedUrl);
  console.log('[Aegir WebUI] Initialized');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Export for backward compatibility
window.run = generateAndFetch;
window.copy = copyToClipboard;
window.openUrl = openGeneratedUrl;
`;

// HTML Template - Constructed from components
const HTML_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Aegir Config v2.3</title>
  <style>${CSS_STYLES}</style>
</head>
<body>
  <div class="card">
    <h2 class="page-title">Aegir 🌊 <span class="version-badge">v2.3</span></h2>

    <div class="group">
      <label for="bug">Bug IP / Server Address</label>
      <input id="bug" type="text" placeholder="e.g. 104.16.x.x or cdn.domain.com">
    </div>

    <div class="group">
      <label for="sni">SNI / WebSocket Host</label>
      <input id="sni" type="text" placeholder="Auto-detect (Worker Host)">
    </div>

    <div class="group-grid">
      <div class="group">
        <label for="cc">Country (CC)</label>
        <input id="cc" type="text" placeholder="SG,ID">
      </div>
      <div class="group">
        <label for="limit">Limit</label>
        <select id="limit">
          <option value="1">Single</option>
          <option value="10">List (10)</option>
          <option value="50" selected>Bulk (50)</option>
        </select>
      </div>
    </div>

    <div class="group">
      <label for="fmt">Output Format</label>
      <select id="fmt">
        <option value="raw">Raw URI (VLESS/Trojan)</option>
        <option value="v2ray">V2Ray / Xray (Base64)</option>
        <option value="clash">Clash Provider (YAML)</option>
      </select>
    </div>

    <button id="main-btn" class="btn btn-primary">Generate & Fetch Config</button>
    <div id="error" class="error-msg"></div>

    <div id="result-area">
      <label for="output">Result Content</label>
      <textarea id="output" readonly onclick="this.select()"></textarea>
      <div class="actions">
        <button class="btn btn-secondary copy-btn">Copy All</button>
        <button class="btn btn-secondary open-link-btn">Open Link</button>
      </div>
    </div>
  </div>
  <script>${JS_APP}</script>
</body>
</html>`;

/**
 * Get the WebUI HTML
 * @returns {string} Complete HTML document
 */
export function getWebUI() {
  return HTML_TEMPLATE;
}

/**
 * Get CSS styles only (for external use)
 * @returns {string} CSS styles
 */
export function getStyles() {
  return CSS_STYLES;
}

/**
 * Get JavaScript application only (for external use)
 * @returns {string} JavaScript code
 */
export function getJavaScript() {
  return JS_APP;
}

// Default export for convenience
export default HTML_TEMPLATE;
