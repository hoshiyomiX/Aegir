import { streamingStats } from '../core/state.js';
import { getFlagEmojiCached } from '../utils/helpers.js';
import { PROTOCOL_HORSE, PROTOCOL_FLASH, PROTOCOL_V2 } from '../config/constants.js';

// Clash YAML generator
export function generateClashYAML(configs, serviceName) {
  const lines = [];
  const proxyNames = [];
  const proxies = [];
  
  // Parse each config URI
  for (const configStr of configs) {
    try {
      const config = parseURI(configStr);
      if (!config) continue;
      
      const proxy = {
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
          proxy['ws-opts'] = {
            path: config.path,
            headers: { Host: config.host }
          };
        }
        if (proxy.tls) proxy['skip-cert-verify'] = true;
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
            path: config.path,
            headers: { Host: config.host }
          };
        }
        if (proxy.tls) proxy['skip-cert-verify'] = true;
        proxy.udp = true;
      } else if (config.protocol === 'trojan') {
        proxy.password = config.password;
        proxy.network = config.type || 'tcp';
        proxy.tls = true;
        if (config.sni) proxy.sni = config.sni;
        proxy['skip-cert-verify'] = true;
        if (config.type === 'ws') {
          proxy['ws-opts'] = {
            path: config.path,
            headers: { Host: config.host }
          };
        }
        proxy.udp = true;
      } else if (config.protocol === 'ss') {
        proxy.password = config.password;
        proxy.cipher = config.method || 'none';
        proxy.udp = true;
      }
      
      proxies.push(proxy);
      proxyNames.push(config.name);
    } catch (e) {
      continue;
    }
  }
  
  // Build YAML
  lines.push('mixed-port: 7890');
  lines.push('allow-lan: true');
  lines.push('mode: rule');
  lines.push('log-level: warning');
  lines.push('ipv6: false');
  lines.push('unified-delay: true');
  lines.push('tcp-concurrent: true');
  lines.push('external-controller: 127.0.0.1:9090');
  lines.push('');
  
  lines.push('dns:');
  lines.push('  enable: true');
  lines.push('  ipv6: false');
  lines.push('  enhanced-mode: fake-ip');
  lines.push('  fake-ip-range: 198.18.0.1/16');
  lines.push('  nameserver:');
  lines.push('    - 8.8.8.8');
  lines.push('    - 1.1.1.1');
  lines.push('');
  
  lines.push('proxies:');
  for (const proxy of proxies) {
    lines.push(toYamlListItem(proxy));
  }
  lines.push('');
  
  lines.push('proxy-groups:');
  lines.push('  - name: Tunnel');
  lines.push('    type: select');
  lines.push('    proxies:');
  lines.push('      - UrlTest');
  lines.push('      - Fallback');
  lines.push('      - Selector');
  for (const name of proxyNames) {
    lines.push(`      - "${name}"`);
  }
  lines.push('  - name: UrlTest');
  lines.push('    type: url-test');
  lines.push('    url: http://www.gstatic.com/generate_204');
  lines.push('    interval: 600');
  lines.push('    tolerance: 150');
  lines.push('    lazy: true');
  lines.push('    proxies:');
  for (const name of proxyNames) {
    lines.push(`      - "${name}"`);
  }
  lines.push('  - name: Fallback');
  lines.push('    type: fallback');
  lines.push('    url: http://www.gstatic.com/generate_204');
  lines.push('    interval: 600');
  lines.push('    lazy: true');
  lines.push('    proxies:');
  for (const name of proxyNames) {
    lines.push(`      - "${name}"`);
  }
  lines.push('  - name: Selector');
  lines.push('    type: select');
  lines.push('    proxies:');
  for (const name of proxyNames) {
    lines.push(`      - "${name}"`);
  }
  lines.push('');
  
  lines.push('rules:');
  lines.push('  - GEOIP,PRIVATE,DIRECT,no-resolve');
  lines.push('  - MATCH,Tunnel');
  
  return lines.join('\n');
}

function parseURI(uri) {
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
    
    if (protocol === 'vless' || protocol === 'vmess') {
      config.uuid = url.username;
      config.security = params.get('security') || 'tls';
      config.type = params.get('type') || 'ws';
      config.host = params.get('host') || '';
      config.path = params.get('path') || '/';
      config.sni = params.get('sni') || '';
      config.flow = params.get('flow') || '';
    } else if (protocol === 'trojan') {
      config.password = url.username;
      config.security = params.get('security') || 'tls';
      config.type = params.get('type') || 'tcp';
      config.host = params.get('host') || '';
      config.path = params.get('path') || '/';
      config.sni = params.get('sni') || '';
    } else if (protocol === 'ss') {
      config.password = url.username;
      config.method = 'none';
    }
    
    return config;
  } catch (e) {
    return null;
  }
}

function toYamlListItem(obj) {
  const lines = [];
  const entries = Object.entries(obj).filter(([_, v]) => v !== undefined && v !== null);
  
  entries.forEach(([key, value], index) => {
    if (index === 0) {
      lines.push(`- ${key}: ${formatValue(value)}`);
    } else {
      if (typeof value === 'object' && !Array.isArray(value)) {
        lines.push(`  ${key}:`);
        for (const [k, v] of Object.entries(value)) {
          if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
            lines.push(`    ${k}:`);
            for (const [nk, nv] of Object.entries(v)) {
              lines.push(`      ${nk}: ${formatValue(nv)}`);
            }
          } else {
            lines.push(`    ${k}: ${formatValue(v)}`);
          }
        }
      } else if (Array.isArray(value)) {
        lines.push(`  ${key}:`);
        for (const v of value) {
          lines.push(`    - "${v}"`);
        }
      } else {
        lines.push(`  ${key}: ${formatValue(value)}`);
      }
    }
  });
  
  return lines.join('\n');
}

function formatValue(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && (value.includes(':') || value.includes('#') || value.includes(' '))) {
    return `"${value}"`;
  }
  return value;
}

// OPTIMIZATION 11: Streaming response generator
// OPTIMIZATION 19: Use String Interpolation instead of URL objects for massive perf gain
export async function* generateConfigsStream(prxList, filterPort, filterVPN, filterLimit, fillerDomain, uuid, ssUsername, wsHost, sni, serviceName) {
  let configCount = 0;
  
  // REMOVED LOGGING to prevent CPU time limit issues
  streamingStats.activeStreams++;
  streamingStats.totalStreamed++;
  
  // Pre-calculate common parts
  const isFlashEmptySNI = (port) => port === 80;

  // IMPORTANT: Ensure prxList is an array and has items
  if (!Array.isArray(prxList)) {
    return; // Exit stream if invalid data
  }

  for (const prx of prxList) {
    if (configCount >= filterLimit) break;
    
    // SAFE ACCESS: Check if properties exist
    const country = prx.country || "XX";
    const cleanOrg = prx.org || "Unknown";
    const proxyIP = prx.prxIP; // Ensure this field exists in your proxy provider object!
    const proxyPort = prx.prxPort;

    if (!proxyIP || !proxyPort) continue; // Skip invalid proxy objects

    // Cache emoji lookup
    const flagEmoji = getFlagEmojiCached(country);
    
    // Path MUST be constructed carefully
    const proxyPath = `/${proxyIP}-${proxyPort}`;
    const encodedProxyPath = encodeURIComponent(proxyPath);

    for (const port of filterPort) {
      if (configCount >= filterLimit) break;
      
      const isTLS = port === 443;
      const security = isTLS ? "tls" : "none";
      const tlsLabel = isTLS ? "TLS" : "NTLS";
      
      for (const protocol of filterVPN) {
        if (configCount >= filterLimit) break;
        
        // Base config name
        const hashName = encodeURIComponent(`${configCount + 1} ${flagEmoji} ${cleanOrg} WS ${tlsLabel} [${serviceName}]`);
        let configStr = "";

        if (protocol === "ss") {
          // Shadowsocks URL format: ss://base64(method:password)@server:port?plugin=...#name
          const pluginParam = encodeURIComponent(
            `${PROTOCOL_V2}-plugin${isTLS ? ";tls" : ""};mux=0;mode=websocket;path=${proxyPath};host=${wsHost}`
          );
          configStr = `${protocol}://${ssUsername}@${fillerDomain}:${port}?plugin=${pluginParam}#${hashName}`;
        } else {
          // Standard V2Ray/Trojan/Vmess URL format
          // protocol://uuid@host:port?params#name
          
          let params = `security=${security}&type=ws&host=${wsHost}&path=${encodedProxyPath}&encryption=none`;
          
          // SNI handling - use separate sni parameter
          const finalSNI = (port === 80 && protocol === PROTOCOL_FLASH) ? "" : sni;
          if (finalSNI) {
            params += `&sni=${finalSNI}`;
          }

          configStr = `${protocol}://${uuid}@${fillerDomain}:${port}?${params}#${hashName}`;
        }

        streamingStats.streamingBytes += configStr.length;
        
        // Yield each config as it's generated
        yield configStr;
        configCount++;
      }
    }
  }
  
  streamingStats.activeStreams--;
}

export function createStreamingResponse(asyncGenerator, responseHeaders) {
  const encoder = new TextEncoder();
  let isFirst = true;
  
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const config of asyncGenerator) {
          // Add newline separator (except for first item)
          const line = isFirst ? config : `\n${config}`;
          isFirst = false;
          
          controller.enqueue(encoder.encode(line));
        }
        controller.close();
      } catch (err) {
        // Safe stream closure on error
        try { controller.close(); } catch(e) {}
      }
    },
  });
  
  return new Response(stream, {
    status: 200,
    headers: responseHeaders,
  });
}
