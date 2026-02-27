/**
 * Aegir WebUI JavaScript v3.1
 * Material Design 3 Implementation
 * Client-Side Config Converter
 */

// ========== State ==========
let proxyData = {};
let selectedProxy = null;
let generatedConfig = '';
let rawConfig = '';
let subscriptionUrl = '';  // Store URL for copy URL button

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
const copyUrlBtn = document.getElementById('copy-url-btn');
const qrBtn = document.getElementById('qr-btn');
const qrModal = document.getElementById('qr-modal');
const qrCanvas = document.getElementById('qr-canvas');
const qrCloseBtn = document.getElementById('qr-close-btn');
const qrHint = document.getElementById('qr-hint');
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

// ========== Client-Side Converter ==========
const ConfigConverter = {
    /**
     * Parse proxy URI to extract components
     */
    parseURI(uri) {
        try {
            const url = new URL(uri);
            const protocol = url.protocol.replace(':', '');
            const params = new URLSearchParams(url.search);
            
            const config = {
                protocol: protocol,
                name: decodeURIComponent(url.hash.replace('#', '')) || 'Proxy',
                server: url.hostname,
                port: parseInt(url.port) || 443,
            };
            
            // Parse protocol-specific params
            if (protocol === 'vless' || protocol === 'vmess') {
                config.uuid = url.username;
                config.security = params.get('security') || 'tls';
                config.type = params.get('type') || 'ws';
                config.host = params.get('host') || '';
                config.path = params.get('path') || '/';
                config.encryption = params.get('encryption') || 'none';
                config.sni = params.get('sni') || '';
                config.flow = params.get('flow') || '';
            } else if (protocol === 'trojan') {
                config.password = url.username;
                config.security = params.get('security') || 'tls';
                config.type = params.get('type') || 'ws';
                config.host = params.get('host') || '';
                config.path = params.get('path') || '/';
                config.sni = params.get('sni') || '';
            } else if (protocol === 'ss') {
                // Shadowsocks: ss://base64(method:password)@server:port?plugin=...#name
                config.method = 'none';
                config.password = url.username;
                const plugin = params.get('plugin');
                if (plugin) {
                    const pluginParams = new URLSearchParams(plugin.split(';').map(p => p.includes('=') ? p : `type=${p}`).join('&'));
                    config.plugin = pluginParams.get('type') || 'v2ray-plugin';
                    config.pluginOpts = {
                        mode: pluginParams.get('mode') || 'websocket',
                        path: pluginParams.get('path') || '/',
                        host: pluginParams.get('host') || '',
                        tls: plugin.includes('tls')
                    };
                }
            }
            
            return config;
        } catch (e) {
            console.error('Failed to parse URI:', e);
            return null;
        }
    },
    
    /**
     * Convert to V2Ray format (Base64 encoded)
     */
    toV2Ray(rawUriis) {
        // V2Ray format is base64 of URI(s)
        const uris = rawUriis.split('\n').filter(u => u.trim());
        const joined = uris.join('\n');
        return btoa(joined);
    },
    
    /**
     * Convert to Clash YAML format
     */
    toClash(rawUris) {
        const uris = rawUris.split('\n').filter(u => u.trim());
        const proxies = [];
        const proxyNames = [];
        
        uris.forEach(uri => {
            const config = this.parseURI(uri);
            if (!config) return;
            
            let proxy = {
                name: config.name,
                type: config.protocol,
                server: config.server,
                port: config.port
            };
            
            if (config.protocol === 'vless') {
                proxy.uuid = config.uuid;
                proxy.network = config.type;
                proxy.tls = config.security === 'tls';
                if (config.sni) proxy.sni = config.sni;
                if (config.flow) proxy.flow = config.flow;
                if (config.type === 'ws') {
                    // Use host from URI (Worker hostname) for WebSocket Host header
                    proxy['ws-opts'] = {
                        path: decodeURIComponent(config.path),
                        headers: { Host: config.host || config.server }
                    };
                }
                if (proxy.tls) {
                    proxy['skip-cert-verify'] = true;
                }
                proxy.udp = true;
                proxy['client-fingerprint'] = 'chrome';
            } else if (config.protocol === 'vmess') {
                proxy.uuid = config.uuid;
                proxy.alterId = 0;
                proxy.cipher = 'auto';
                proxy.network = config.type;
                proxy.tls = config.security === 'tls';
                if (config.sni) proxy.sni = config.sni;
                if (config.type === 'ws') {
                    proxy['ws-opts'] = {
                        path: decodeURIComponent(config.path),
                        headers: { Host: config.host || config.server }
                    };
                }
                if (proxy.tls) {
                    proxy['skip-cert-verify'] = true;
                }
                proxy.udp = true;
            } else if (config.protocol === 'trojan') {
                proxy.password = config.password;
                proxy.network = config.type || 'tcp';
                proxy.tls = config.security === 'tls' || true;
                if (config.sni) proxy.sni = config.sni;
                proxy['skip-cert-verify'] = true;
                if (config.type === 'ws') {
                    proxy['ws-opts'] = {
                        path: decodeURIComponent(config.path),
                        headers: { Host: config.host || config.server }
                    };
                }
                proxy.udp = true;
            } else if (config.protocol === 'ss') {
                proxy.password = config.password;
                proxy.cipher = config.method || 'none';
                if (config.plugin) {
                    proxy.plugin = config.plugin;
                    proxy['plugin-opts'] = config.pluginOpts;
                }
                proxy.udp = true;
            }
            
            proxies.push(proxy);
            proxyNames.push(config.name);
        });
        
        // Build Clash YAML
        let yaml = this.buildClashYAML(proxies, proxyNames);
        return yaml;
    },
    
    /**
     * Build Clash YAML string
     * Optimized for performance & battery balance
     */
    buildClashYAML(proxies, proxyNames) {
        const lines = [];
        
        // Header - Optimized settings
        lines.push('mixed-port: 7890');
        lines.push('allow-lan: true');
        lines.push('bind-address: "*"');
        lines.push('mode: rule');
        lines.push('log-level: warning');  // Reduce logging for battery
        lines.push('ipv6: false');
        lines.push('unified-delay: true');  // Better latency measurement
        lines.push('tcp-concurrent: true');  // Faster TCP connections
        lines.push('find-process-mode: strict');  // Reduce CPU for process matching
        lines.push('external-controller: 127.0.0.1:9090');
        lines.push('');
        
        // Sniffer - Improve routing accuracy
        lines.push('sniffer:');
        lines.push('  enable: true');
        lines.push('  force-dns-mapping: true');
        lines.push('  parse-pure-ip: true');
        lines.push('  sniff:');
        lines.push('    HTTP:');
        lines.push('      ports: [80, 8080-8880]');
        lines.push('      override-destination: true');
        lines.push('    TLS:');
        lines.push('      ports: [443, 8443]');
        lines.push('    QUIC:');
        lines.push('      ports: [443, 8443]');
        lines.push('');
        
        // DNS - Optimized for speed & battery
        lines.push('dns:');
        lines.push('  enable: true');
        lines.push('  prefer-h3: false');
        lines.push('  ipv6: false');
        lines.push('  enhanced-mode: fake-ip');
        lines.push('  fake-ip-range: 198.18.0.1/16');
        lines.push('  fake-ip-filter:');
        lines.push('    - "*.lan"');
        lines.push('    - "*.local"');
        lines.push('    - "+.stun.*.*"');
        lines.push('  default-nameserver:');
        lines.push('    - 8.8.8.8');
        lines.push('    - 1.1.1.1');
        lines.push('  nameserver:');
        lines.push('    - 8.8.8.8');
        lines.push('    - 1.1.1.1');
        lines.push('');
        
        // Proxies (as list items)
        lines.push('proxies:');
        proxies.forEach(proxy => {
            lines.push(this.toYamlListItem(proxy, 2));
        });
        lines.push('');
        
        // Proxy Groups - Optimized intervals
        lines.push('proxy-groups:');
        lines.push('  - name: Tunnel');
        lines.push('    type: select');
        lines.push('    proxies:');
        lines.push('      - UrlTest');
        lines.push('      - Fallback');
        lines.push('      - Selector');
        proxyNames.forEach(name => {
            lines.push(`      - "${name}"`);
        });
        lines.push('  - name: UrlTest');
        lines.push('    type: url-test');
        lines.push('    url: http://www.gstatic.com/generate_204');
        lines.push('    interval: 600');        // Check every 10 min (battery saver)
        lines.push('    tolerance: 150');       // 150ms tolerance before switching
        lines.push('    lazy: true');           // Only check when used
        lines.push('    proxies:');
        proxyNames.forEach(name => {
            lines.push(`      - "${name}"`);
        });
        lines.push('  - name: Fallback');
        lines.push('    type: fallback');
        lines.push('    url: http://www.gstatic.com/generate_204');
        lines.push('    interval: 600');
        lines.push('    lazy: true');
        lines.push('    proxies:');
        proxyNames.forEach(name => {
            lines.push(`      - "${name}"`);
        });
        lines.push('  - name: Selector');
        lines.push('    type: select');
        lines.push('    proxies:');
        proxyNames.forEach(name => {
            lines.push(`      - "${name}"`);
        });
        lines.push('');
        
        // Rules - Simple rules only
        lines.push('rules:');
        lines.push('  - GEOIP,PRIVATE,DIRECT,no-resolve');
        lines.push('  - MATCH,Tunnel');
        
        return lines.join('\n');
    },
    
    /**
     * Convert object to YAML entry (recursive)
     */
    toYamlEntry(obj, indent = 0) {
        const spaces = ' '.repeat(indent);
        const lines = [];
        
        Object.entries(obj).forEach(([key, value]) => {
            if (value === undefined || value === null) return;
            
            if (typeof value === 'object' && !Array.isArray(value)) {
                lines.push(`${spaces}${key}:`);
                // Recursively handle nested objects
                Object.entries(value).forEach(([k, v]) => {
                    if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
                        // Double nested object (like headers inside ws-opts)
                        lines.push(`${spaces}  ${k}:`);
                        Object.entries(v).forEach(([nk, nv]) => {
                            if (typeof nv === 'string' && (nv.includes(':') || nv.includes('#') || nv.includes(' '))) {
                                lines.push(`${spaces}    ${nk}: "${nv}"`);
                            } else {
                                lines.push(`${spaces}    ${nk}: ${nv}`);
                            }
                        });
                    } else if (typeof v === 'string' && (v.includes(':') || v.includes('#') || v.includes(' '))) {
                        lines.push(`${spaces}  ${k}: "${v}"`);
                    } else {
                        lines.push(`${spaces}  ${k}: ${v}`);
                    }
                });
            } else if (Array.isArray(value)) {
                lines.push(`${spaces}${key}:`);
                value.forEach(v => {
                    lines.push(`${spaces}  - "${v}"`);
                });
            } else if (typeof value === 'string' && (value.includes(':') || value.includes('#') || value.includes(' '))) {
                lines.push(`${spaces}${key}: "${value}"`);
            } else if (typeof value === 'boolean') {
                lines.push(`${spaces}${key}: ${value}`);
            } else {
                lines.push(`${spaces}${key}: ${value}`);
            }
        });
        
        return lines.join('\n');
    },
    
    /**
     * Convert object to YAML list item (for proxies array)
     * First property gets the `- ` prefix
     */
    toYamlListItem(obj, indent = 0) {
        const spaces = ' '.repeat(indent);
        const lines = [];
        const entries = Object.entries(obj).filter(([_, v]) => v !== undefined && v !== null);
        
        entries.forEach(([key, value], index) => {
            if (index === 0) {
                // First entry: use "- key: value" format
                if (typeof value === 'string' && (value.includes(':') || value.includes('#') || value.includes(' '))) {
                    lines.push(`${spaces}- ${key}: "${value}"`);
                } else {
                    lines.push(`${spaces}- ${key}: ${value}`);
                }
            } else {
                // Subsequent entries: use "  key: value" format
                if (typeof value === 'object' && !Array.isArray(value)) {
                    lines.push(`${spaces}  ${key}:`);
                    Object.entries(value).forEach(([k, v]) => {
                        if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
                            // Nested object (like headers inside ws-opts)
                            lines.push(`${spaces}    ${k}:`);
                            Object.entries(v).forEach(([nk, nv]) => {
                                if (typeof nv === 'string' && (nv.includes(':') || nv.includes('#') || nv.includes(' '))) {
                                    lines.push(`${spaces}      ${nk}: "${nv}"`);
                                } else {
                                    lines.push(`${spaces}      ${nk}: ${nv}`);
                                }
                            });
                        } else if (typeof v === 'string' && (v.includes(':') || v.includes('#') || v.includes(' '))) {
                            lines.push(`${spaces}    ${k}: "${v}"`);
                        } else {
                            lines.push(`${spaces}    ${k}: ${v}`);
                        }
                    });
                } else if (Array.isArray(value)) {
                    lines.push(`${spaces}  ${key}:`);
                    value.forEach(v => {
                        lines.push(`${spaces}    - "${v}"`);
                    });
                } else if (typeof value === 'string' && (value.includes(':') || value.includes('#') || value.includes(' '))) {
                    lines.push(`${spaces}  ${key}: "${value}"`);
                } else if (typeof value === 'boolean') {
                    lines.push(`${spaces}  ${key}: ${value}`);
                } else {
                    lines.push(`${spaces}  ${key}: ${value}`);
                }
            }
        });
        
        return lines.join('\n');
    },
    
    /**
     * Convert to sing-box JSON format
     */
    toSingBox(rawUris) {
        const uris = rawUris.split('\n').filter(u => u.trim());
        const outbounds = [];
        
        uris.forEach((uri, index) => {
            const config = this.parseURI(uri);
            if (!config) return;
            
            let outbound = {
                type: config.protocol,
                tag: config.name || `proxy-${index + 1}`,
                server: config.server,
                server_port: config.port
            };
            
            if (config.protocol === 'vless') {
                outbound.uuid = config.uuid;
                outbound.transport = {
                    type: config.type,
                    path: decodeURIComponent(config.path),
                    headers: { Host: config.host }
                };
                if (config.security === 'tls') {
                    outbound.tls = {
                        enabled: true,
                        server_name: config.sni,
                        insecure: false
                    };
                }
                if (config.flow) outbound.flow = config.flow;
            } else if (config.protocol === 'vmess') {
                outbound.uuid = config.uuid;
                outbound.alter_id = 0;
                outbound.security = 'auto';
                outbound.transport = {
                    type: config.type,
                    path: decodeURIComponent(config.path),
                    headers: { Host: config.host }
                };
                if (config.security === 'tls') {
                    outbound.tls = {
                        enabled: true,
                        server_name: config.sni,
                        insecure: false
                    };
                }
            } else if (config.protocol === 'trojan') {
                outbound.password = config.password;
                if (config.type === 'ws') {
                    outbound.transport = {
                        type: 'ws',
                        path: decodeURIComponent(config.path),
                        headers: { Host: config.host }
                    };
                }
                outbound.tls = {
                    enabled: true,
                    server_name: config.sni,
                    insecure: false
                };
            } else if (config.protocol === 'ss') {
                outbound.method = config.method || 'none';
                outbound.password = config.password;
                if (config.plugin) {
                    outbound.plugin = config.plugin;
                    outbound.plugin_opts = JSON.stringify(config.pluginOpts);
                }
            }
            
            outbounds.push(outbound);
        });
        
        // Build sing-box config
        return this.buildSingBoxConfig(outbounds);
    },
    
    /**
     * Build sing-box JSON config
     */
    buildSingBoxConfig(outbounds) {
        const proxyTags = outbounds.map(o => o.tag);
        
        const config = {
            log: {
                level: 'info',
                timestamp: true
            },
            dns: {
                servers: [
                    { tag: 'google', address: 'tls://8.8.8.8' },
                    { tag: 'local', address: '223.5.5.5', detour: 'direct' }
                ],
                rules: [
                    { outbound: 'any', server: 'local' }
                ],
                final: 'google',
                strategy: 'ipv4_only'
            },
            inbounds: [
                {
                    type: 'tun',
                    tag: 'tun-in',
                    inet4_address: '172.19.0.1/30',
                    auto_route: true,
                    strict_route: true,
                    stack: 'system'
                }
            ],
            outbounds: [
                {
                    type: 'selector',
                    tag: 'proxy',
                    outbounds: ['auto', ...proxyTags],
                    default: 'auto'
                },
                {
                    type: 'urltest',
                    tag: 'auto',
                    outbounds: proxyTags,
                    url: 'https://www.gstatic.com/generate_204',
                    interval: '3m',
                    tolerance: 50
                },
                ...outbounds,
                {
                    type: 'direct',
                    tag: 'direct'
                },
                {
                    type: 'block',
                    tag: 'block'
                },
                {
                    type: 'dns',
                    tag: 'dns-out'
                }
            ],
            route: {
                rules: [
                    { protocol: 'dns', outbound: 'dns-out' },
                    { ip_is_private: true, outbound: 'direct' }
                ],
                final: 'proxy',
                auto_detect_interface: true
            }
        };
        
        return JSON.stringify(config, null, 2);
    },
    
    /**
     * Main converter function
     */
    convert(rawUris, format) {
        switch (format) {
            case 'raw':
                return rawUris;
            case 'v2ray':
                return this.toV2Ray(rawUris);
            case 'clash':
                return this.toClash(rawUris);
            case 'singbox':
                return this.toSingBox(rawUris);
            default:
                return rawUris;
        }
    }
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

// ========== QR Code Generation ==========
function generateQRCode(text, canvas) {
    try {
        // Use 0 for auto type detection
        const qr = qrcode(0, 'M');  // Medium error correction
        qr.addData(text);
        qr.make();
        
        // Draw on canvas
        const ctx = canvas.getContext('2d');
        const moduleCount = qr.getModuleCount();
        const cellSize = Math.max(4, Math.floor(220 / moduleCount));  // Min 4px per cell
        const size = cellSize * moduleCount;
        
        canvas.width = size;
        canvas.height = size;
        
        // White background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, size, size);
        
        // Draw modules
        ctx.fillStyle = '#000000';
        for (let row = 0; row < moduleCount; row++) {
            for (let col = 0; col < moduleCount; col++) {
                if (qr.isDark(row, col)) {
                    ctx.fillRect(col * cellSize, row * cellSize, cellSize, cellSize);
                }
            }
        }
        
        return true;
    } catch (e) {
        console.error('QR generation failed:', e);
        
        // Fallback: show error on canvas
        const ctx = canvas.getContext('2d');
        canvas.width = 220;
        canvas.height = 220;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, 220, 220);
        ctx.fillStyle = '#ff0000';
        ctx.font = '14px Roboto';
        ctx.textAlign = 'center';
        ctx.fillText('Content too long', 110, 100);
        ctx.fillText('for QR code', 110, 120);
        ctx.fillText(`(${text.length} chars)`, 110, 145);
        
        return false;
    }
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
        const format = document.querySelector('input[name="format"]:checked').value;
        const bugHost = bugHostInput.value.trim();
        const reverseSni = reverseSniCheckbox.checked;
        const workerHost = window.location.hostname;
        
        // Determine domain, sni, and host based on mode:
        // No bug: server=worker, sni=worker, host=worker
        // Bug + Reverse SNI OFF: server=worker, sni=bug, host=bug
        // Bug + Reverse SNI ON: server=bug, sni=worker, host=worker
        let domain, sni, host;
        if (bugHost) {
            if (reverseSni) {
                // Reverse SNI ON: Server = bug, SNI & Host = worker
                domain = bugHost;      // server = bug host
                sni = workerHost;      // TLS SNI = worker hostname
                host = workerHost;     // Host header = worker hostname
            } else {
                // Reverse SNI OFF: Server = worker, SNI & Host = bug
                domain = workerHost;   // server = worker hostname
                sni = bugHost;         // TLS SNI = bug host
                host = bugHost;        // Host header = bug host
            }
        } else {
            // No bug input: everything = worker
            domain = workerHost;
            sni = workerHost;
            host = workerHost;
        }
        
        // Always fetch raw URI from API
        const params = new URLSearchParams();
        params.append('domain', domain);
        params.append('sni', sni);
        params.append('host', host);  // Add host parameter for ws header
        params.append('limit', '1');
        params.append('vpn', protocol);
        params.append('port', port);
        params.append('format', 'raw');  // Always raw from API
        
        const targetUrl = `${window.location.origin}/api/v1/sub?${params.toString()}`;
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        
        const response = await fetch(targetUrl, { signal: controller.signal });
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        // Get raw URI from API
        rawConfig = await response.text();
        
        // Store subscription URL for copy URL button (with correct format)
        // Replace format=raw with actual format for subscription
        subscriptionUrl = targetUrl.replace('format=raw', `format=${format}`);
        
        // Convert locally based on selected format
        generatedConfig = ConfigConverter.convert(rawConfig, format);
        
        configOutput.value = generatedConfig;
        resultSection.style.display = 'block';
        
        // Show copy URL button for Clash and sing-box formats
        copyUrlBtn.style.display = (format === 'clash' || format === 'singbox') ? 'flex' : 'none';
        
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

// Copy URL button (for Clash format)
copyUrlBtn.addEventListener('click', async () => {
    try {
        await navigator.clipboard.writeText(subscriptionUrl);
        
        copyUrlBtn.classList.add('copied');
        copyUrlBtn.querySelector('.material-icons-round').textContent = 'check';
        
        setTimeout(() => {
            copyUrlBtn.classList.remove('copied');
            copyUrlBtn.querySelector('.material-icons-round').textContent = 'link';
        }, 2000);
        
        showSnackbar('URL copied to clipboard');
    } catch (error) {
        showSnackbar('Failed to copy URL');
    }
});

// QR Code button
qrBtn.addEventListener('click', () => {
    const format = document.querySelector('input[name="format"]:checked').value;
    let qrContent;
    
    // For Clash format, always use URL (config is too long for QR)
    if (format === 'clash') {
        qrContent = subscriptionUrl;
        qrHint.textContent = 'Scan to import subscription URL';
    } else if (format === 'singbox') {
        // sing-box JSON is also long, use URL
        qrContent = subscriptionUrl;
        qrHint.textContent = 'Scan to import subscription URL';
    } else if (format === 'v2ray') {
        // V2Ray is base64 encoded, usually short enough
        qrContent = generatedConfig;
        qrHint.textContent = 'Scan to import V2Ray config';
    } else {
        // For raw URI, use the URI (short)
        qrContent = rawConfig;
        qrHint.textContent = 'Scan to import proxy URI';
    }
    
    // Check if content is too long for QR
    if (qrContent.length > 2900) {
        showSnackbar('Config too long for QR code. Use subscription URL instead.');
        return;
    }
    
    // Generate QR code
    const success = generateQRCode(qrContent, qrCanvas);
    
    if (success) {
        // Show modal
        qrModal.style.display = 'flex';
    } else {
        showSnackbar('Failed to generate QR code');
    }
});

// Close QR modal
qrCloseBtn.addEventListener('click', () => {
    qrModal.style.display = 'none';
});

// Close QR modal when clicking outside
qrModal.addEventListener('click', (e) => {
    if (e.target === qrModal) {
        qrModal.style.display = 'none';
    }
});

configOutput.addEventListener('click', function() {
    this.select();
});

document.addEventListener('DOMContentLoaded', init);
