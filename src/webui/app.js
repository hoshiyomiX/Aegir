/**
 * Aegir WebUI JavaScript v3.0
 * Material Design 3 Implementation
 */

// ========== State ==========
let proxyData = {};
let selectedProxy = null;
let generatedConfig = '';

// ========== DOM Elements ==========
const countrySelect = document.getElementById('country-select');
const proxySelect = document.getElementById('proxy-select');
const bugHostInput = document.getElementById('bug-host');
const reverseSniCheckbox = document.getElementById('reverse-sni');
const generateBtn = document.getElementById('generate-btn');
const errorMsg = document.getElementById('error-msg');
const resultSection = document.getElementById('result-section');
const configOutput = document.getElementById('config-output');
const copyBtn = document.getElementById('copy-btn');
const loadingOverlay = document.getElementById('loading-overlay');
const snackbar = document.getElementById('snackbar');

// ========== Country Flags ==========
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
function showSnackbar(message) {
    snackbar.textContent = message;
    snackbar.classList.add('show');
    setTimeout(() => snackbar.classList.remove('show'), 3000);
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
        option.textContent = `${flag} ${code} (${count})`;
        countrySelect.appendChild(option);
    });
}

function populateProxies(countryCode) {
    const proxies = proxyData[countryCode] || [];
    
    proxySelect.innerHTML = '<option value="">-- Select Proxy --</option>';
    proxySelect.disabled = proxies.length === 0;
    
    proxies.forEach((proxy) => {
        const option = document.createElement('option');
        option.value = proxy;
        option.textContent = proxy;
        proxySelect.appendChild(option);
    });
}

// ========== Event Handlers ==========
countrySelect.addEventListener('change', (e) => {
    selectedProxy = null;
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
        bugHostInput.placeholder = window.location.hostname;
    } else {
        selectedProxy = null;
    }
    
    updateGenerateButton();
    hideError();
});

generateBtn.addEventListener('click', async () => {
    if (!selectedProxy) {
        showError('Please select a proxy server');
        return;
    }
    
    const btnText = generateBtn.querySelector('span:last-child');
    const originalText = btnText.textContent;
    
    generateBtn.disabled = true;
    btnText.textContent = 'Generating...';
    hideError();
    
    try {
        const protocol = document.querySelector('input[name="protocol"]:checked').value;
        const port = document.querySelector('input[name="port"]:checked').value;
        const bugHost = bugHostInput.value.trim();
        const reverseSni = reverseSniCheckbox.checked;
        const workerHost = window.location.hostname;
        
        // Determine domain and SNI based on reverse SNI option
        let domain, sni;
        if (reverseSni && bugHost) {
            // Reverse: Bug Host becomes SNI, Worker becomes domain
            domain = workerHost;
            sni = bugHost;
        } else if (bugHost) {
            // Normal: Bug Host as both domain and SNI
            domain = bugHost;
            sni = bugHost;
        } else {
            // Default: Worker host for both
            domain = workerHost;
            sni = workerHost;
        }
        
        const params = new URLSearchParams();
        params.append('domain', domain);
        params.append('sni', sni);
        params.append('limit', '1');
        params.append('vpn', protocol);
        params.append('port', port);
        
        const targetUrl = `${window.location.origin}/api/v1/sub?${params.toString()}`;
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        
        const response = await fetch(targetUrl, { signal: controller.signal });
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        generatedConfig = await response.text();
        
        configOutput.value = generatedConfig;
        resultSection.style.display = 'block';
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
        copyBtn.querySelector('.material-icons-round').textContent = 'check';
        
        setTimeout(() => {
            copyBtn.classList.remove('copied');
            copyBtn.querySelector('.material-icons-round').textContent = 'content_copy';
        }, 2000);
        
        showSnackbar('Config copied to clipboard');
    } catch (error) {
        configOutput.select();
        document.execCommand('copy');
        showSnackbar('Config copied');
    }
});

configOutput.addEventListener('click', function() {
    this.select();
});

document.addEventListener('DOMContentLoaded', init);
