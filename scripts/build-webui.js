#!/usr/bin/env node
/**
 * ============================================
 * Aegir WebUI Build Script
 * ============================================
 * 
 * This script builds the template.js file from
 * separate HTML, CSS, and JS files.
 * 
 * Usage:
 *   node scripts/build-webui.js
 * 
 * Output:
 *   Updates src/webui/template.js with embedded assets
 * 
 * ============================================
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// File paths
const WEBUI_DIR = path.join(__dirname, '..', 'src', 'webui');
const TEMPLATE_FILE = path.join(WEBUI_DIR, 'template.js');
const HTML_FILE = path.join(WEBUI_DIR, 'index.html');
const CSS_FILE = path.join(WEBUI_DIR, 'styles.css');
const JS_FILE = path.join(WEBUI_DIR, 'app.js');

/**
 * Read file contents
 * @param {string} filePath - Path to file
 * @returns {string} File contents
 */
function readFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch (error) {
    console.error(`Error reading ${filePath}:`, error.message);
    return '';
  }
}

/**
 * Escape string for JavaScript template literal
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
function escapeForTemplateLiteral(str) {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$/g, '\\$');
}

/**
 * Generate the template.js content
 */
function buildTemplate() {
  console.log('🔨 Building WebUI template...\n');
  
  // Read source files
  const cssContent = readFile(CSS_FILE);
  const jsContent = readFile(JS_FILE);
  
  if (!cssContent || !jsContent) {
    console.error('❌ Failed to read source files');
    process.exit(1);
  }
  
  console.log(`📄 CSS: ${cssContent.length} bytes`);
  console.log(`📄 JS:  ${jsContent.length} bytes`);
  
  // Escape for template literals
  const escapedCSS = escapeForTemplateLiteral(cssContent);
  const escapedJS = escapeForTemplateLiteral(jsContent);
  
  // Generate template content
  const templateContent = `/**
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
 * 
 * AUTO-GENERATED FILE - Do not edit directly!
 * Generated at: ${new Date().toISOString()}
 * 
 * ============================================
 */

// CSS Styles - Embedded from styles.css
const CSS_STYLES = \`${escapedCSS}\`;

// JavaScript Application - Embedded from app.js
const JS_APP = \`${escapedJS}\`;

// HTML Template - Constructed from components
const HTML_TEMPLATE = \`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Aegir Config v2.3</title>
  <style>\${CSS_STYLES}</style>
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
  <script>\${JS_APP}</script>
</body>
</html>\`;

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
`;
  
  // Write the template file
  fs.writeFileSync(TEMPLATE_FILE, templateContent, 'utf-8');
  
  console.log(`\n✅ Template built successfully!`);
  console.log(`📄 Output: ${TEMPLATE_FILE}`);
  console.log(`📄 Size: ${templateContent.length} bytes`);
}

// Run the build
buildTemplate();
