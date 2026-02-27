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
                if (config.sni) proxy.servername = config.sni;
                if (config.flow) proxy.flow = config.flow;
                if (config.type === 'ws') {
                    proxy['ws-opts'] = {
                        path: decodeURIComponent(config.path),
                        headers: { Host: config.host }
                    };
                }
                proxy.udp = true;
                proxy['client-fingerprint'] = 'chrome';
            } else if (config.protocol === 'vmess') {
                proxy.uuid = config.uuid;
                proxy.alterId = 0;
                proxy.cipher = 'auto';
                proxy.network = config.type;
                proxy.tls = config.security === 'tls';
                if (config.sni) proxy.servername = config.sni;
                if (config.type === 'ws') {
                    proxy['ws-opts'] = {
                        path: decodeURIComponent(config.path),
                        headers: { Host: config.host }
                    };
                }
                proxy.udp = true;
            } else if (config.protocol === 'trojan') {
                proxy.password = config.password;
                proxy.network = config.type || 'tcp';
                proxy.tls = config.security === 'tls' || true;
                if (config.sni) proxy.sni = config.sni;
                proxy['skip-cert-verify'] = false;
                if (config.type === 'ws') {
                    proxy['ws-opts'] = {
                        path: decodeURIComponent(config.path),
                        headers: { Host: config.host }
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
     */
    buildClashYAML(proxies, proxyNames) {
        const lines = [];
        
        // Header
        lines.push('mixed-port: 7890');
        lines.push('allow-lan: true');
        lines.push('bind-address: "*"');
        lines.push('mode: rule');
        lines.push('log-level: silent');
        lines.push('ipv6: false');
        lines.push('external-controller: 127.0.0.1:9090');
        lines.push('');
        
        // DNS
        lines.push('dns:');
        lines.push('  enable: true');
        lines.push('  ipv6: false');
        lines.push('  enhanced-mode: redir-host');
        lines.push('  listen: 0.0.0.0:7874');
        lines.push('  default-nameserver:');
        lines.push('    - 8.8.8.8');
        lines.push('    - 1.1.1.1');
        lines.push('  nameserver:');
        lines.push('    - https://8.8.8.8/dns-query');
        lines.push('    - https://8.8.4.4/dns-query');
        lines.push('  fallback:');
        lines.push('    - https://1.1.1.1/dns-query');
        lines.push('    - 8.8.8.8');
        lines.push('');
        
        // Proxies (as list items)
        lines.push('proxies:');
        proxies.forEach(proxy => {
            lines.push(this.toYamlListItem(proxy, 2));
        });
        lines.push('');
        
        // Proxy Groups
        lines.push('proxy-groups:');
        lines.push('  - name: Tunnel');
        lines.push('    type: select');
        lines.push('    proxies:');
        lines.push('      - UrlTest');
        lines.push('      - Selector');
        proxyNames.forEach(name => {
            lines.push(`      - "${name}"`);
        });
        lines.push('  - name: UrlTest');
        lines.push('    type: url-test');
        lines.push('    interval: 300');
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
        
        // Rules
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
        
        // Always fetch raw URI from API
        const params = new URLSearchParams();
        params.append('domain', domain);
        params.append('sni', sni);
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
        
        // Convert locally based on selected format
        generatedConfig = ConfigConverter.convert(rawConfig, format);
        
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
