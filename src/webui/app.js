/**
 * Aegir WebUI JavaScript v3.0
 * ===========================
 * Complete rewrite with new features:
 * - Proxy selection from API
 * - Protocol options (Trojan, VMess, SS)
 * - Bug inject support
 * - Copy to clipboard
 */

// ========== State ==========
let proxyData = {};
let selectedProxy = null;
let generatedConfig = '';
let generatedUrl = '';

// ========== DOM Elements ==========
const countrySelect = document.getElementById('country-select');
const proxySelect = document.getElementById('proxy-select');
const proxyInfo = document.getElementById('proxy-info');
const proxyBadge = document.getElementById('proxy-badge');
const bugHostInput = document.getElementById('bug-host');
const generateBtn = document.getElementById('generate-btn');
const errorMsg = document.getElementById('error-msg');
const resultSection = document.getElementById('result-section');
const configOutput = document.getElementById('config-output');
const copyBtn = document.getElementById('copy-btn');
const openBtn = document.getElementById('open-btn');
const loadingOverlay = document.getElementById('loading-overlay');
const toast = document.getElementById('toast');

// ========== Country Code to Flag Emoji ==========
const countryFlags = {
    'AD': '🇦🇩', 'AE': '🇦🇪', 'AF': '🇦🇫', 'AG': '🇦🇬', 'AI': '🇦🇮',
    'AL': '🇦🇱', 'AM': '🇦🇲', 'AO': '🇦🇴', 'AQ': '🇦🇶', 'AR': '🇦🇷',
    'AS': '🇦🇸', 'AT': '🇦🇹', 'AU': '🇦🇺', 'AW': '🇦🇼', 'AX': '🇦🇽',
    'AZ': '🇦🇿', 'BA': '🇧🇦', 'BB': '🇧🇧', 'BD': '🇧🇩', 'BE': '🇧🇪',
    'BF': '🇧🇫', 'BG': '🇧🇬', 'BH': '🇧🇭', 'BI': '🇧🇮', 'BJ': '🇧🇯',
    'BL': '🇧🇱', 'BM': '🇧🇲', 'BN': '🇧🇳', 'BO': '🇧🇴', 'BQ': '🇧🇶',
    'BR': '🇧🇷', 'BS': '🇧🇸', 'BT': '🇧🇹', 'BV': '🇧🇻', 'BW': '🇧🇼',
    'BY': '🇧🇾', 'BZ': '🇧🇿', 'CA': '🇨🇦', 'CC': '🇨🇨', 'CD': '🇨🇩',
    'CF': '🇨🇫', 'CG': '🇨🇬', 'CH': '🇨🇭', 'CI': '🇨🇮', 'CK': '🇨🇰',
    'CL': '🇨🇱', 'CM': '🇨🇲', 'CN': '🇨🇳', 'CO': '🇨🇴', 'CR': '🇨🇷',
    'CU': '🇨🇺', 'CV': '🇨🇻', 'CW': '🇨🇼', 'CX': '🇨🇽', 'CY': '🇨🇾',
    'CZ': '🇨🇿', 'DE': '🇩🇪', 'DJ': '🇩🇯', 'DK': '🇩🇰', 'DM': '🇩🇲',
    'DO': '🇩🇴', 'DZ': '🇩🇿', 'EC': '🇪🇨', 'EE': '🇪🇪', 'EG': '🇪🇬',
    'EH': '🇪🇭', 'ER': '🇪🇷', 'ES': '🇪🇸', 'ET': '🇪🇹', 'FI': '🇫🇮',
    'FJ': '🇫🇯', 'FK': '🇫🇰', 'FM': '🇫🇲', 'FO': '🇫🇴', 'FR': '🇫🇷',
    'GA': '🇬🇦', 'GB': '🇬🇧', 'GD': '🇬🇩', 'GE': '🇬🇪', 'GF': '🇬🇫',
    'GG': '🇬🇬', 'GH': '🇬🇭', 'GI': '🇬🇮', 'GL': '🇬🇱', 'GM': '🇬🇲',
    'GN': '🇬🇳', 'GP': '🇬🇵', 'GQ': '🇬🇶', 'GR': '🇬🇷', 'GS': '🇬🇸',
    'GT': '🇬🇹', 'GU': '🇬🇺', 'GW': '🇬🇼', 'GY': '🇬🇾', 'HK': '🇭🇰',
    'HM': '🇭🇲', 'HN': '🇭🇳', 'HR': '🇭🇷', 'HT': '🇭🇹', 'HU': '🇭🇺',
    'ID': '🇮🇩', 'IE': '🇮🇪', 'IL': '🇮🇱', 'IM': '🇮🇲', 'IN': '🇮🇳',
    'IO': '🇮🇴', 'IQ': '🇮🇶', 'IR': '🇮🇷', 'IS': '🇮🇸', 'IT': '🇮🇹',
    'JE': '🇯🇪', 'JM': '🇯🇲', 'JO': '🇯🇴', 'JP': '🇯🇵', 'KE': '🇰🇪',
    'KG': '🇰🇬', 'KH': '🇰🇭', 'KI': '🇰🇮', 'KM': '🇰🇲', 'KN': '🇰🇳',
    'KP': '🇰🇵', 'KR': '🇰🇷', 'KW': '🇰🇼', 'KY': '🇰🇾', 'KZ': '🇰🇿',
    'LA': '🇱🇦', 'LB': '🇱🇧', 'LC': '🇱🇨', 'LI': '🇱🇮', 'LK': '🇱🇰',
    'LR': '🇱🇷', 'LS': '🇱🇸', 'LT': '🇱🇹', 'LU': '🇱🇺', 'LV': '🇱🇻',
    'LY': '🇱🇾', 'MA': '🇲🇦', 'MC': '🇲🇨', 'MD': '🇲🇩', 'ME': '🇲🇪',
    'MF': '🇲🇫', 'MG': '🇲🇬', 'MH': '🇲🇭', 'MK': '🇲🇰', 'ML': '🇲🇱',
    'MM': '🇲🇲', 'MN': '🇲🇳', 'MO': '🇲🇴', 'MP': '🇲🇵', 'MQ': '🇲🇶',
    'MR': '🇲🇷', 'MS': '🇲🇸', 'MT': '🇲🇹', 'MU': '🇲🇺', 'MV': '🇲🇻',
    'MW': '🇲🇼', 'MX': '🇲🇽', 'MY': '🇲🇾', 'MZ': '🇲🇿', 'NA': '🇳🇦',
    'NC': '🇳🇨', 'NE': '🇳🇪', 'NF': '🇳🇫', 'NG': '🇳🇬', 'NI': '🇳🇮',
    'NL': '🇳🇱', 'NO': '🇳🇴', 'NP': '🇳🇵', 'NR': '🇳🇷', 'NU': '🇳🇺',
    'NZ': '🇳🇿', 'OM': '🇴🇲', 'PA': '🇵🇦', 'PE': '🇵🇪', 'PF': '🇵🇫',
    'PG': '🇵🇬', 'PH': '🇵🇭', 'PK': '🇵🇰', 'PL': '🇵🇱', 'PM': '🇵🇲',
    'PN': '🇵🇳', 'PR': '🇵🇷', 'PS': '🇵🇸', 'PT': '🇵🇹', 'PW': '🇵🇼',
    'PY': '🇵🇾', 'QA': '🇶🇦', 'RE': '🇷🇪', 'RO': '🇷🇴', 'RS': '🇷🇸',
    'RU': '🇷🇺', 'RW': '🇷🇼', 'SA': '🇸🇦', 'SB': '🇸🇧', 'SC': '🇸🇨',
    'SD': '🇸🇩', 'SE': '🇸🇪', 'SG': '🇸🇬', 'SH': '🇸🇭', 'SI': '🇸🇮',
    'SJ': '🇸🇯', 'SK': '🇸🇰', 'SL': '🇸🇱', 'SM': '🇸🇲', 'SN': '🇸🇳',
    'SO': '🇸🇴', 'SR': '🇸🇷', 'SS': '🇸🇸', 'ST': '🇸🇹', 'SV': '🇸🇻',
    'SX': '🇸🇽', 'SY': '🇸🇾', 'SZ': '🇸🇿', 'TC': '🇹🇨', 'TD': '🇹🇩',
    'TF': '🇹🇫', 'TG': '🇹🇬', 'TH': '🇹🇭', 'TJ': '🇹🇯', 'TK': '🇹🇰',
    'TL': '🇹🇱', 'TM': '🇹🇲', 'TN': '🇹🇳', 'TO': '🇹🇴', 'TR': '🇹🇷',
    'TT': '🇹🇹', 'TV': '🇹🇻', 'TW': '🇹🇼', 'TZ': '🇹🇿', 'UA': '🇺🇦',
    'UG': '🇺🇬', 'UM': '🇺🇲', 'US': '🇺🇸', 'UY': '🇺🇾', 'UZ': '🇺🇿',
    'VA': '🇻🇦', 'VC': '🇻🇨', 'VE': '🇻🇪', 'VG': '🇻🇬', 'VI': '🇻🇮',
    'VN': '🇻🇳', 'VU': '🇻🇺', 'WF': '🇼🇫', 'WS': '🇼🇸', 'XX': '🏳️',
    'YE': '🇾🇪', 'YT': '🇾🇹', 'ZA': '🇿🇦', 'ZM': '🇿🇲', 'ZW': '🇿🇼'
};

// ========== Utility Functions ==========
function showToast(message) {
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2500);
}

function showError(message) {
    errorMsg.textContent = message;
    errorMsg.style.display = 'block';
    setTimeout(() => errorMsg.style.display = 'none', 5000);
}

function hideError() {
    errorMsg.style.display = 'none';
}

function updateGenerateButton() {
    generateBtn.disabled = !selectedProxy;
}

// ========== Initialize ==========
async function init() {
    loadingOverlay.style.display = 'flex';
    
    try {
        const response = await fetch('/api/v1/proxies');
        if (!response.ok) throw new Error('Failed to fetch proxies');
        
        proxyData = await response.json();
        populateCountries();
        
    } catch (error) {
        console.error('Error loading proxies:', error);
        showError('Failed to load proxy list. Please refresh.');
        countrySelect.innerHTML = '<option value="">-- Error loading --</option>';
    } finally {
        loadingOverlay.style.display = 'none';
    }
}

function populateCountries() {
    const countries = Object.keys(proxyData).sort();
    
    countrySelect.innerHTML = '<option value="">-- Select Country --</option>';
    
    countries.forEach(code => {
        const flag = countryFlags[code] || '🏳️';
        const count = proxyData[code].length;
        const option = document.createElement('option');
        option.value = code;
        option.textContent = `${flag} ${code} (${count} proxies)`;
        countrySelect.appendChild(option);
    });
}

function populateProxies(countryCode) {
    const proxies = proxyData[countryCode] || [];
    
    proxySelect.innerHTML = '<option value="">-- Select Proxy --</option>';
    proxySelect.disabled = proxies.length === 0;
    
    proxies.forEach((proxy, index) => {
        const option = document.createElement('option');
        option.value = proxy;
        option.textContent = proxy;
        proxySelect.appendChild(option);
    });
    
    proxyInfo.style.display = 'none';
}

// ========== Event Handlers ==========
countrySelect.addEventListener('change', (e) => {
    selectedProxy = null;
    proxyInfo.style.display = 'none';
    updateGenerateButton();
    
    if (e.target.value) {
        populateProxies(e.target.value);
    } else {
        proxySelect.innerHTML = '<option value="">-- Select country first --</option>';
        proxySelect.disabled = true;
    }
});

proxySelect.addEventListener('change', (e) => {
    if (e.target.value) {
        selectedProxy = e.target.value;
        
        // Show proxy info badge
        const flag = countryFlags[countrySelect.value] || '🏳️';
        proxyBadge.textContent = `${flag} ${selectedProxy}`;
        proxyInfo.style.display = 'block';
        
        // Set bug host placeholder to current host
        bugHostInput.placeholder = window.location.hostname;
    } else {
        selectedProxy = null;
        proxyInfo.style.display = 'none';
    }
    
    updateGenerateButton();
    hideError();
});

generateBtn.addEventListener('click', async () => {
    if (!selectedProxy) {
        showError('Please select a proxy first');
        return;
    }
    
    const btnText = generateBtn.querySelector('.btn-text');
    const originalText = btnText.textContent;
    
    generateBtn.disabled = true;
    btnText.textContent = 'Generating...';
    hideError();
    
    try {
        const protocol = document.querySelector('input[name="protocol"]:checked').value;
        const port = document.querySelector('input[name="port"]:checked').value;
        const bugHost = bugHostInput.value.trim() || window.location.hostname;
        
        // Build API URL
        const params = new URLSearchParams();
        params.append('domain', bugHost);
        params.append('sni', bugHost);
        params.append('limit', '1');
        params.append('vpn', protocol);
        params.append('port', port);
        
        // Use the proxy as prx-list parameter (single proxy mode)
        const targetUrl = `${window.location.origin}/api/v1/sub?${params.toString()}`;
        
        // Fetch config
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        
        const response = await fetch(targetUrl, { signal: controller.signal });
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        generatedConfig = await response.text();
        generatedUrl = targetUrl;
        
        // Show result
        configOutput.value = generatedConfig;
        resultSection.style.display = 'block';
        
        // Scroll to result
        resultSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        
    } catch (error) {
        const message = error.name === 'AbortError' 
            ? 'Request timed out. Please try again.' 
            : `Error: ${error.message}`;
        showError(message);
    } finally {
        generateBtn.disabled = false;
        btnText.textContent = originalText;
        updateGenerateButton();
    }
});

copyBtn.addEventListener('click', async () => {
    try {
        await navigator.clipboard.writeText(configOutput.value);
        
        copyBtn.classList.add('copied');
        copyBtn.querySelector('.btn-icon').textContent = '✓';
        
        setTimeout(() => {
            copyBtn.classList.remove('copied');
            copyBtn.querySelector('.btn-icon').textContent = '📋';
        }, 2000);
        
        showToast('Config copied to clipboard!');
    } catch (error) {
        // Fallback for older browsers
        configOutput.select();
        document.execCommand('copy');
        showToast('Config copied!');
    }
});

openBtn.addEventListener('click', () => {
    if (generatedUrl) {
        window.open(generatedUrl, '_blank');
    }
});

// Select all text when clicking on textarea
configOutput.addEventListener('click', function() {
    this.select();
});

// Initialize on page load
document.addEventListener('DOMContentLoaded', init);
