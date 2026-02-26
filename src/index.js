import { 
  PORTS, 
  PROTOCOLS, 
  PRX_BANK_URL, 
  KV_PRX_URL,
  MAX_CONFIGS_PER_REQUEST,
  CORS_HEADER_OPTIONS,
  SUB_PAGE_URL,
  PROTOCOL_V2,
  PROTOCOL_NEKO,
  CONVERTER_URL,
  PRX_HEALTH_CHECK_API
} from './config/constants.js';

import { 
  dnsCache, 
  pendingRequests, 
  coalesceStats,
  performGlobalCleanup,
  getMemorySummary
} from './core/state.js';

import { formatStats } from './core/diagnostics.js';
import { websocketHandler } from './handlers/websocket.js';
import { getKVPrxList, getPrxListPaginated } from './services/proxyProvider.js';
import { generateConfigsStream, createStreamingResponse } from './services/configGenerator.js';
import { reverseWeb } from './services/httpReverse.js';
import { prewarmDNS, cleanupDNSCache, fetchWithDNS } from './services/dns.js';

// ============ WebUI HTML Template v2.3 ============
// Clean HTML/CSS/JS embedded directly (no Base64, easier to maintain)
// To modify: edit src/webui/*.css, *.js, *.html and rebuild

const WEBUI_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Aegir Config v2.3</title>
<style>
:root{--primary:#00f2ea;--bg:#050505;--panel:#111;--text:#eee;--border:#333}
*{box-sizing:border-box}
body{background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;padding:15px}
.card{background:var(--panel);width:100%;max-width:420px;padding:25px;border-radius:12px;border:1px solid var(--border);box-shadow:0 10px 40px rgba(0,0,0,0.6)}
h2{text-align:center;margin:0 0 20px;color:var(--primary);font-weight:800;letter-spacing:1px}
h2 span{font-size:0.4em;color:#666;vertical-align:middle;background:#222;padding:2px 6px;border-radius:4px}
.group{margin-bottom:15px}
label{display:block;margin-bottom:5px;font-size:0.75rem;color:#888;text-transform:uppercase;font-weight:700;letter-spacing:0.5px}
input,select,textarea{width:100%;background:#000;border:1px solid #2a2a2a;color:#fff;padding:10px;border-radius:6px;font-size:14px;transition:border 0.2s}
input:focus,select:focus,textarea:focus{border-color:var(--primary);outline:none}
button{width:100%;background:var(--primary);color:#000;font-weight:800;border:none;padding:12px;border-radius:6px;cursor:pointer;text-transform:uppercase;letter-spacing:1px;margin-top:10px;transition:opacity 0.2s}
button:hover{opacity:0.9}
button:disabled{opacity:0.5;cursor:not-allowed}
#result-area{margin-top:20px;display:none;animation:fadeIn 0.3s ease}
textarea{height:120px;font-family:monospace;font-size:12px;line-height:1.4;color:#a5f3fc;resize:vertical;border-color:#333}
.actions{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:5px}
.sec-btn{background:#222;color:#fff;font-weight:600;font-size:12px}
.sec-btn:hover{background:#333}
@keyframes fadeIn{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}
.error-msg{color:#ff4444;font-size:12px;margin-top:10px;text-align:center;display:none}
</style>
</head>
<body>
<div class="card">
<h2>Aegir 🌊 <span>v2.3</span></h2>
<div class="group"><label>Bug IP / Server Address</label><input id="bug" type="text" placeholder="e.g. 104.16.x.x or cdn.domain.com"></div>
<div class="group"><label>SNI / WebSocket Host</label><input id="sni" type="text" placeholder="Auto-detect (Worker Host)"></div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
<div class="group"><label>Country (CC)</label><input id="cc" type="text" placeholder="SG,ID"></div>
<div class="group"><label>Limit</label><select id="limit"><option value="1">Single</option><option value="10">List (10)</option><option value="50" selected>Bulk (50)</option></select></div>
</div>
<div class="group"><label>Output Format</label><select id="fmt"><option value="raw">Raw URI (VLESS/Trojan)</option><option value="v2ray">V2Ray / Xray (Base64)</option><option value="clash">Clash Provider (YAML)</option></select></div>
<button id="main-btn" onclick="run()">Generate & Fetch Config</button>
<div id="error" class="error-msg"></div>
<div id="result-area"><label>Result Content</label><textarea id="output" readonly onclick="this.select()"></textarea><div class="actions"><button class="sec-btn" onclick="copy()">Copy All</button><button class="sec-btn" onclick="openUrl()">Open Link</button></div></div>
</div>
<script>
const host=location.hostname;
document.getElementById('bug').placeholder=host;
document.getElementById('sni').placeholder=host;
async function run(){
const btn=document.getElementById('main-btn');
const errDiv=document.getElementById('error');
const resDiv=document.getElementById('result-area');
const out=document.getElementById('output');
btn.disabled=true;
btn.innerText="Processing...";
errDiv.style.display='none';
resDiv.style.display='none';
out.value='';
try{
const bug=document.getElementById('bug').value.trim();
const sni=document.getElementById('sni').value.trim();
const cc=document.getElementById('cc').value.trim();
const limit=document.getElementById('limit').value;
const fmt=document.getElementById('fmt').value;
const p=new URLSearchParams();
if(bug)p.append('domain',bug);
if(sni)p.append('sni',sni);
if(cc)p.append('cc',cc.toUpperCase());
p.append('limit',limit);
let path='/api/v1/sub';
if(fmt==='clash'){path='/sub';p.append('format','clash');if(sni)p.append('host',sni)}else{p.append('format',fmt)}
const targetUrl=location.origin+path+'?'+p.toString();
const controller=new AbortController();
const timeoutId=setTimeout(()=>controller.abort(),15000);
const res=await fetch(targetUrl,{signal:controller.signal});
clearTimeout(timeoutId);
if(!res.ok)throw new Error('HTTP '+res.status);
const text=await res.text();
out.value=text;
resDiv.style.display='block';
window.generatedUrl=targetUrl;
}catch(e){
errDiv.innerText=e.name==='AbortError'?'Timeout: Server took too long':'Error: '+e.message;
errDiv.style.display='block';
}finally{
btn.disabled=false;
btn.innerText="Generate & Fetch Config";
}
}
function copy(){
const el=document.getElementById('output');
el.select();
navigator.clipboard.writeText(el.value);
const btn=document.querySelector('.actions button');
const old=btn.innerText;
btn.innerText="Copied!";
setTimeout(()=>btn.innerText=old,1500);
}
function openUrl(){if(window.generatedUrl)window.open(window.generatedUrl,'_blank')}
</script>
</body>
</html>`;

/**
 * Get the WebUI HTML
 * @returns {string} Complete HTML document
 */
function getDecodedHtml() {
  return WEBUI_HTML;
}

// ============ REQUEST DEDUPLICATION (FIXED) ============

// Constants for deduplication
const DEDUP_TTL_MS = 2000; // Time-to-live for pending request entries
const DEDUP_MAX_SIZE = 100; // Maximum pending requests

/**
 * Generates a unique key for request deduplication
 * @param {Request} request - The incoming request
 * @returns {string} - Unique request key
 */
function getRequestKey(request) {
  const url = new URL(request.url);
  const params = new URLSearchParams();
  const paramKeys = ['offset', 'limit', 'cc', 'port', 'vpn', 'format', 'domain', 'prx-list', 'sni', 'host'];
  for (const key of paramKeys) {
    const value = url.searchParams.get(key);
    if (value) params.set(key, value);
  }
  return url.pathname + '?' + params.toString();
}

/**
 * Request deduplication with proper cleanup
 * CRITICAL FIX: Removed setTimeout, using explicit cleanup instead
 * CRITICAL FIX v2: Handle streaming responses properly with tee()
 * 
 * @param {Request} request - The incoming request
 * @param {Function} handler - The request handler function
 * @returns {Promise<Response>} - The response
 */
async function deduplicateRequest(request, handler) {
  // Only deduplicate GET requests
  if (request.method !== 'GET') {
    return handler();
  }

  const requestKey = getRequestKey(request);
  
  // Check if there's already a pending request for this key
  if (pendingRequests.has(requestKey)) {
    const pendingEntry = pendingRequests.get(requestKey);
    
    // CRITICAL FIX: Check if the entry is still valid (not expired)
    if (pendingEntry && Date.now() - pendingEntry.timestamp < DEDUP_TTL_MS) {
      coalesceStats.hits++;
      coalesceStats.saved++;
      try {
        const result = await pendingEntry.promise;
        
        // CRITICAL FIX: Handle streaming responses properly
        // Use tee() to create two identical streams
        if (result.body) {
          const [stream1, stream2] = result.body.tee();
          // Replace the original body with one stream
          const originalResponse = new Response(stream1, result);
          // Return the other stream to the waiting client
          return new Response(stream2, originalResponse);
        }
        
        // For non-streaming responses, clone is safe
        return result.clone();
      } catch (err) {
        // If the pending promise rejects, remove it and try again
        pendingRequests.delete(requestKey);
        // Fall through to create new request
      }
    } else {
      // Entry expired, remove it
      pendingRequests.delete(requestKey);
    }
  }

  // Check size limit and remove oldest if needed
  if (pendingRequests.size >= DEDUP_MAX_SIZE) {
    // Find and remove the oldest entry
    let oldestKey = null;
    let oldestTime = Infinity;
    for (const [key, entry] of pendingRequests.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }
    if (oldestKey) {
      pendingRequests.delete(oldestKey);
    }
  }

  coalesceStats.misses++;

  // Create the promise for this request
  const timestamp = Date.now();
  let resolvePromise;
  let rejectPromise;
  
  const promise = new Promise((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });

  // Store the pending request with timestamp
  pendingRequests.set(requestKey, { promise, timestamp });

  try {
    // Execute the handler
    const response = await handler();
    
    // Resolve the promise for any waiting consumers
    resolvePromise(response);
    
    // Schedule cleanup using request context (if available) or direct cleanup
    // Note: We don't use setTimeout as it's unreliable in Workers
    // Instead, we clean up on next request or via periodic cleanup
    
    return response;
  } catch (err) {
    // On error, remove from pending and reject
    pendingRequests.delete(requestKey);
    rejectPromise(err);
    throw err;
  } finally {
    // CRITICAL FIX: Clean up after response is sent
    // Use a microtask to ensure response is sent first
    Promise.resolve().then(() => {
      // Only delete if it's still our entry (not replaced by another request)
      const entry = pendingRequests.get(requestKey);
      if (entry && entry.timestamp === timestamp) {
        pendingRequests.delete(requestKey);
      }
    });
  }
}

// ============ CACHING HELPERS ============

function getCacheKey(request) {
  const url = new URL(request.url);
  const params = new URLSearchParams();
  const paramKeys = ['offset', 'limit', 'cc', 'port', 'vpn', 'format', 'domain', 'prx-list', 'sni', 'host'];
  for (const key of paramKeys) {
    const value = url.searchParams.get(key);
    if (value) params.set(key, value);
  }
  const cacheUrl = new URL(url.origin + url.pathname);
  cacheUrl.search = params.toString();
  return new Request(cacheUrl.toString(), { method: 'GET', headers: request.headers });
}

async function handleCachedRequest(request, handler) {
  if (request.method !== 'GET') return handler();
  
  const cache = caches.default;
  const cacheKey = getCacheKey(request);
  
  // Try cache first
  let response = await cache.match(cacheKey);
  if (response) {
    const newResponse = new Response(response.body, response);
    newResponse.headers.set('X-Cache-Status', 'HIT');
    return newResponse;
  }
  
  // No cache hit, execute handler
  response = await handler();
  
  // Cache successful responses with Cache-Control header
  if (response.status === 200 && response.headers.has('Cache-Control')) {
    try {
      const responseToCache = response.clone();
      await cache.put(cacheKey, responseToCache);
    } catch (cacheErr) {
      // Cache put can fail, don't let it break the response
      console.error("Cache put error:", cacheErr);
    }
    const newResponse = new Response(response.body, response);
    newResponse.headers.set('X-Cache-Status', 'MISS');
    return newResponse;
  }
  
  return response;
}

// ============ HEALTH CHECK ============

async function checkPrxHealth(prxIP, prxPort) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);
  
  try {
    const req = await fetchWithDNS(`${PRX_HEALTH_CHECK_API}?ip=${prxIP}:${prxPort}`, {
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return await req.json();
  } catch (err) {
    clearTimeout(timeoutId);
    return { error: err.message || "Health check failed" };
  }
}

// ============ CACHE HEADERS ============

function addCacheHeaders(headers, ttl = 3600, browserTTL = 1800) {
  headers["Cache-Control"] = `public, max-age=${browserTTL}, s-maxage=${ttl}, stale-while-revalidate=86400`;
  headers["CDN-Cache-Control"] = `public, max-age=${ttl}`;
  headers["Cloudflare-CDN-Cache-Control"] = `max-age=${ttl}`;
  headers["Vary"] = "Accept-Encoding";
  headers["ETag"] = `"${Date.now().toString(36)}"`;
}

// ============ MAIN EXPORT ============

export default {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);
      const appDomain = url.hostname;
      const serviceName = appDomain.split(".")[0];

      // CRITICAL FIX: Perform global cleanup periodically using ctx.waitUntil
      // This ensures cleanup happens in background without blocking response
      if (Math.random() < 0.05) { // 5% chance per request
        ctx.waitUntil(Promise.resolve().then(performGlobalCleanup));
      }

      // Pre-warm DNS cache on cold start
      if (dnsCache && dnsCache.size === 0) {
        ctx.waitUntil(prewarmDNS());
      }

      // Periodic DNS cache cleanup
      if (Math.random() < 0.1) {
        ctx.waitUntil(Promise.resolve().then(cleanupDNSCache));
      }

      // Handle WebSocket upgrade
      const upgradeHeader = request.headers.get("Upgrade");
      if (upgradeHeader === "websocket") {
        const prxMatch = url.pathname.match(/^\/(.+[:=-]\d+)$/);
        let prxIP = "";
        
        if (url.pathname.length === 3 || url.pathname.match(",")) {
          const prxKeys = url.pathname.replace("/", "").toUpperCase().split(",");
          const prxKey = prxKeys[Math.floor(Math.random() * prxKeys.length)];
          const kvPrx = await getKVPrxList(KV_PRX_URL, env);
          if (kvPrx && kvPrx[prxKey]) {
            prxIP = kvPrx[prxKey][Math.floor(Math.random() * kvPrx[prxKey].length)];
          }
          return await websocketHandler(request, prxIP);
        } else if (prxMatch) {
          prxIP = prxMatch[1];
          return await websocketHandler(request, prxIP);
        }
      }

      // ============ ROUTING LOGIC ============

      // Serve WebUI (CRITICAL FIX: Use cached HTML)
      if (url.pathname === "/" || url.pathname === "/sub") {
        const html = getDecodedHtml();
        return new Response(html, { 
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
            "Pragma": "no-cache",
            "Expires": "0"
          }
        });
      } 
      
      // Health check endpoint
      else if (url.pathname.startsWith("/check")) {
        const target = url.searchParams.get("target")?.split(":") || [];
        if (target.length < 1) {
          return new Response(JSON.stringify({ error: "Invalid target" }), { 
            status: 400,
            headers: { ...CORS_HEADER_OPTIONS, "Content-Type": "application/json" }
          });
        }
        
        const resultPromise = checkPrxHealth(target[0], target[1] || "443");
        const result = await Promise.race([
          resultPromise,
          new Promise((resolve) => setTimeout(() => resolve({ error: "Health check timeout" }), 5000)),
        ]);
        
        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { 
            ...CORS_HEADER_OPTIONS, 
            "Content-Type": "application/json", 
            "Cache-Control": "public, max-age=300" 
          },
        });
      } 
      
      // API endpoints
      else if (url.pathname.startsWith("/api/v1")) {
        const apiPath = url.pathname.replace("/api/v1", "");
        
        if (apiPath.startsWith("/sub")) {
          return deduplicateRequest(request, () => {
            return handleCachedRequest(request, async () => {
              // Parse and validate parameters
              const offset = Math.max(0, parseInt(url.searchParams.get("offset")) || 0);
              const filterCC = url.searchParams.get("cc")?.toUpperCase().split(",").filter(Boolean) || [];
              const filterPort = url.searchParams.get("port")?.split(",").map(p => parseInt(p)).filter(p => p > 0 && p < 65536) || PORTS;
              const filterVPN = url.searchParams.get("vpn")?.split(",").filter(Boolean) || PROTOCOLS;
              const filterLimit = Math.min(Math.max(1, parseInt(url.searchParams.get("limit")) || MAX_CONFIGS_PER_REQUEST), MAX_CONFIGS_PER_REQUEST);
              const filterFormat = url.searchParams.get("format") || "raw";
              
              const fillerDomain = url.searchParams.get("domain") || appDomain;
              const customSNI = url.searchParams.get("sni") || url.searchParams.get("host") || appDomain;
              const prxBankUrl = url.searchParams.get("prx-list") || env.PRX_BANK_URL || PRX_BANK_URL;
              
              const { data: prxList, pagination } = await getPrxListPaginated(prxBankUrl, { offset, limit: filterLimit, filterCC }, env);
              const uuid = crypto.randomUUID();
              const ssUsername = btoa(`none:${uuid}`);
              const stats = formatStats();
              
              const responseHeaders = {
                ...CORS_HEADER_OPTIONS,
                "X-Pagination-Offset": offset.toString(),
                "X-Pagination-Limit": filterLimit.toString(),
                "X-Pagination-Total": pagination.total.toString(),
                "X-Pagination-Has-More": pagination.hasMore.toString(),
                "X-Pool-Stats": stats.pool,
                "X-Buffer-Stats": stats.buffer,
                "X-Timeout-Stats": stats.timeout,
                "X-Retry-Stats": stats.retry,
                "X-Batch-Stats": stats.batch,
                "X-Dedup-Stats": stats.dedup,
                "X-Streaming-Stats": stats.streaming,
                "X-DNS-Stats": stats.dns,
                "X-Worker-Optimizations": "OPT11-18-ACTIVE-FIXED",
              };

              if (pagination.nextOffset !== null) {
                responseHeaders["X-Pagination-Next-Offset"] = pagination.nextOffset.toString();
              }

              if (filterFormat === "raw") {
                responseHeaders["Content-Type"] = "text/plain; charset=utf-8";
                responseHeaders["X-Streaming-Mode"] = "ACTIVE";
                addCacheHeaders(responseHeaders, 3600, 1800);
                const configStream = generateConfigsStream(prxList, filterPort, filterVPN, filterLimit, fillerDomain, uuid, ssUsername, customSNI, serviceName);
                return createStreamingResponse(configStream, responseHeaders, filterFormat);
                
              } else if (filterFormat === PROTOCOL_V2) {
                const result = [];
                const configStream = generateConfigsStream(prxList, filterPort, filterVPN, filterLimit, fillerDomain, uuid, ssUsername, customSNI, serviceName);
                for await (const config of configStream) result.push(config);
                const finalResult = btoa(result.join("\n"));
                responseHeaders["Content-Type"] = "text/plain; charset=utf-8";
                responseHeaders["X-Streaming-Mode"] = "BUFFERED";
                addCacheHeaders(responseHeaders, 3600, 1800);
                return new Response(finalResult, { status: 200, headers: responseHeaders });
                
              } else {
                // Converter format
                const result = [];
                const configStream = generateConfigsStream(prxList, filterPort, filterVPN, filterLimit, fillerDomain, uuid, ssUsername, customSNI, serviceName);
                for await (const config of configStream) result.push(config);
                
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 8000);
                
                try {
                  const res = await fetchWithDNS(CONVERTER_URL, {
                    method: "POST",
                    body: JSON.stringify({ url: result.join(","), format: filterFormat, template: "cf" }),
                    signal: controller.signal
                  });
                  clearTimeout(timeoutId);
                  
                  if (res.ok) {
                    const finalResult = await res.text();
                    responseHeaders["Content-Type"] = res.headers.get("Content-Type") || "text/plain; charset=utf-8";
                    responseHeaders["X-Streaming-Mode"] = "CONVERTER";
                    addCacheHeaders(responseHeaders, 3600, 1800);
                    return new Response(finalResult, { status: 200, headers: responseHeaders });
                  } else {
                    return new Response(JSON.stringify({ error: "Converter service error" }), { 
                      status: 502, 
                      headers: { ...CORS_HEADER_OPTIONS, "Content-Type": "application/json" }
                    });
                  }
                } catch (converterErr) {
                  clearTimeout(timeoutId);
                  return new Response(JSON.stringify({ error: "Converter service timeout or unavailable" }), { 
                    status: 504, 
                    headers: { ...CORS_HEADER_OPTIONS, "Content-Type": "application/json" }
                  });
                }
              }
            });
          });
          
        } else if (apiPath.startsWith("/myip")) {
          return new Response(JSON.stringify({
            ip: request.headers.get("cf-connecting-ipv6") || request.headers.get("cf-connecting-ip") || request.headers.get("x-real-ip"),
            colo: request.headers.get("cf-ray")?.split("-")[1],
            ...request.cf,
          }), { 
            headers: { 
              ...CORS_HEADER_OPTIONS, 
              "Content-Type": "application/json", 
              "Cache-Control": "private, max-age=60" 
            } 
          });
        } else if (apiPath.startsWith("/metrics")) {
          // Health metrics endpoint for monitoring
          const stats = formatStats();
          const memory = getMemorySummary();
          return new Response(JSON.stringify({
            version: "2.0.0",
            timestamp: new Date().toISOString(),
            memory,
            stats: {
              pool: stats.pool,
              buffer: stats.buffer,
              timeout: stats.timeout,
              retry: stats.retry,
              batch: stats.batch,
              dedup: stats.dedup,
              streaming: stats.streaming,
              dns: stats.dns
            },
            cf: {
              colo: request.headers.get("cf-ray")?.split("-")[1],
              country: request.cf?.country,
              asn: request.cf?.asn
            }
          }, null, 2), {
            headers: {
              ...CORS_HEADER_OPTIONS,
              "Content-Type": "application/json",
              "Cache-Control": "private, max-age=10"
            }
          });
        }
      }

      // Default: Reverse Proxy for unknown paths
      const targetReversePrx = env.REVERSE_PRX_TARGET || "example.com";
      return await reverseWeb(request, targetReversePrx);
      
    } catch (err) {
      console.error("Worker error:", err);
      return new Response(`An error occurred: ${err.toString()}`, { 
        status: 500, 
        headers: { ...CORS_HEADER_OPTIONS, "Content-Type": "text/plain; charset=utf-8" } 
      });
    }
  },
};
