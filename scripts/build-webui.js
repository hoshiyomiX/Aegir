#!/usr/bin/env node
/**
 * Aegir WebUI Build Script
 * =========================
 * Combines HTML, CSS, and JS files and encodes to Base64 for Cloudflare Workers
 * 
 * Usage: bun run build:webui
 * 
 * This script:
 * 1. Reads src/webui/index.html
 * 2. Inlines CSS from src/webui/styles.css
 * 3. Inlines JS from src/webui/app.js
 * 4. Encodes the combined HTML to Base64
 * 5. Updates src/index.js with the new BASE64_HTML constant
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// File paths
const WEBUI_DIR = path.join(__dirname, '..', 'src', 'webui');
const HTML_FILE = path.join(WEBUI_DIR, 'index.html');
const CSS_FILE = path.join(WEBUI_DIR, 'styles.css');
const JS_FILE = path.join(WEBUI_DIR, 'app.js');
const INDEX_FILE = path.join(__dirname, '..', 'src', 'index.js');

console.log('🔨 Building Aegir WebUI...\n');

// Read source files
console.log('📁 Reading source files...');
const html = fs.readFileSync(HTML_FILE, 'utf-8');
const css = fs.readFileSync(CSS_FILE, 'utf-8');
const js = fs.readFileSync(JS_FILE, 'utf-8');

console.log(`   - HTML: ${html.length} bytes`);
console.log(`   - CSS:  ${css.length} bytes`);
console.log(`   - JS:   ${js.length} bytes`);

// Combine: inline CSS and JS into HTML
console.log('\n🔧 Combining files...');
const combinedHtml = html
    .replace('{{CSS}}', css)
    .replace('{{JS}}', js);

console.log(`   - Combined HTML: ${combinedHtml.length} bytes`);

// Encode to Base64
console.log('\n📦 Encoding to Base64...');
const base64Html = Buffer.from(combinedHtml, 'utf-8').toString('base64');
console.log(`   - Base64 string: ${base64Html.length} characters`);

// Update index.js
console.log('\n📝 Updating src/index.js...');
const indexContent = fs.readFileSync(INDEX_FILE, 'utf-8');

// Find and replace the BASE64_HTML constant
const updatedIndex = indexContent.replace(
    /const BASE64_HTML = "[^"]+";/,
    `const BASE64_HTML = "${base64Html}";`
);

if (updatedIndex === indexContent) {
    console.error('❌ Error: Could not find BASE64_HTML constant in index.js');
    process.exit(1);
}

fs.writeFileSync(INDEX_FILE, updatedIndex);
console.log('   ✅ BASE64_HTML updated successfully!');

// Summary
console.log('\n✨ Build complete!');
console.log('\n📊 Summary:');
console.log(`   - Original size: ${combinedHtml.length} bytes`);
console.log(`   - Encoded size:  ${base64Html.length} bytes`);
console.log(`   - Overhead:      ${((base64Html.length / combinedHtml.length - 1) * 100).toFixed(1)}%`);
console.log('\n🚀 Ready to deploy! Run `bun run deploy` to deploy to Cloudflare Workers.');
