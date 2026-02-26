/**
 * Aegir WebUI JavaScript v2.3
 * ===========================
 * Handles form submission, API calls, and UI interactions
 * 
 * Usage: Edit this file for logic changes
 * Build: Run `bun run build:webui` to encode to Base64
 */

// Placeholder logic - set default values based on current host
const host = location.hostname;
document.getElementById('bug').placeholder = host;
document.getElementById('sni').placeholder = host;

/**
 * Main function to generate and fetch config
 * Validates input, builds URL, fetches from API, displays result
 */
async function run() {
    const btn = document.getElementById('main-btn');
    const errDiv = document.getElementById('error');
    const resDiv = document.getElementById('result-area');
    const out = document.getElementById('output');

    // Reset state
    btn.disabled = true;
    btn.innerText = "Processing...";
    errDiv.style.display = 'none';
    resDiv.style.display = 'none';
    out.value = '';

    try {
        // Build URL from form inputs
        const bug = document.getElementById('bug').value.trim();
        const sni = document.getElementById('sni').value.trim();
        const cc = document.getElementById('cc').value.trim();
        const limit = document.getElementById('limit').value;
        const fmt = document.getElementById('fmt').value;

        // Build query parameters
        const p = new URLSearchParams();
        if (bug) p.append('domain', bug);
        if (sni) p.append('sni', sni);
        if (cc) p.append('cc', cc.toUpperCase());
        p.append('limit', limit);

        // Determine API path based on format
        let path = '/api/v1/sub';
        if (fmt === 'clash') {
            path = '/sub';
            p.append('format', 'clash');
            if (sni) p.append('host', sni);
        } else {
            p.append('format', fmt);
        }

        const targetUrl = location.origin + path + '?' + p.toString();

        // Fetch content with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

        const res = await fetch(targetUrl, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const text = await res.text();

        // Show result
        out.value = text;
        resDiv.style.display = 'block';
        window.generatedUrl = targetUrl; // Store for "Open Link" button

    } catch (e) {
        errDiv.innerText = e.name === 'AbortError' 
            ? 'Timeout: Server took too long' 
            : 'Error: ' + e.message;
        errDiv.style.display = 'block';
    } finally {
        btn.disabled = false;
        btn.innerText = "Generate & Fetch Config";
    }
}

/**
 * Copy result to clipboard
 */
function copy() {
    const el = document.getElementById('output');
    el.select();
    navigator.clipboard.writeText(el.value);
    const btn = document.querySelector('.actions button');
    const old = btn.innerText;
    btn.innerText = "Copied!";
    setTimeout(() => btn.innerText = old, 1500);
}

/**
 * Open generated URL in new tab
 */
function openUrl() {
    if (window.generatedUrl) {
        window.open(window.generatedUrl, '_blank');
    }
}
