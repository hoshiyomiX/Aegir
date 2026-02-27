import { fetchWithDNS } from './dns.js';
import { getCachedData } from './cache.js';
import { paginateArray, shuffleArray } from '../utils/helpers.js';
import { CACHE_TTL, MAX_CONFIGS_PER_REQUEST, PRX_BANK_URL, KV_PRX_URL } from '../config/constants.js';

export async function getKVPrxList(kvPrxUrl = KV_PRX_URL, env) {
  if (!kvPrxUrl) {
    throw new Error("No URL Provided!");
  }

  return getCachedData(
    "kvPrxList",
    async () => {
      const kvPrx = await fetchWithDNS(kvPrxUrl); // Use DNS-optimized fetch
      if (kvPrx.status === 200) {
        return await kvPrx.json();
      }
      return {};
    },
    CACHE_TTL,
    env
  );
}

export async function getPrxListPaginated(prxBankUrl = PRX_BANK_URL, options = {}, env) {
  const targetUrl = prxBankUrl || env.PRX_BANK_URL || PRX_BANK_URL;
  
  // Input validation
  if (!targetUrl) {
    throw new Error("No URL Provided!");
  }
  
  // Validate URL format
  try {
    new URL(targetUrl);
  } catch {
    throw new Error(`Invalid proxy bank URL: ${targetUrl}`);
  }

  // Sanitize and validate options
  const offset = Math.max(0, parseInt(options.offset) || 0);
  const fetchAll = options.fetchAll;  // If true, return all proxies (for WebUI)
  const limit = fetchAll 
    ? parseInt(options.limit) || 10000  // No cap for fetchAll mode
    : Math.min(
        Math.max(1, parseInt(options.limit) || MAX_CONFIGS_PER_REQUEST),
        MAX_CONFIGS_PER_REQUEST
      );
  const filterCC = Array.isArray(options.filterCC)
    ? options.filterCC.filter(c => typeof c === 'string' && c.length <= 3)
    : [];
  const filterProxy = options.filterProxy;  // Specific proxy IP:PORT

  // Optimization: Cache the raw lines instead of parsed objects to save memory
  // Parsing is done lazily only on the requested slice
  const rawLines = await getCachedData(
    "prxListRaw",
    async () => {
      const prxBank = await fetchWithDNS(targetUrl); // Use DNS-optimized fetch
      if (prxBank.status === 200) {
        const text = (await prxBank.text()) || "";
        // Only split and filter empty lines, don't parse yet
        return text.split("\n").filter(line => line.trim().length > 0);
      }
      return [];
    },
    CACHE_TTL,
    env
  );

  // Priority 1: If specific proxy is requested, find and return it
  if (filterProxy) {
    const [targetIP, targetPort] = filterProxy.split(":");

    for (const line of rawLines) {
      const parts = line.split(",");
      const ip = parts[0];
      const port = parts[1];

      if (ip === targetIP && port === targetPort) {
        return {
          data: [{
            prxIP: ip || "Unknown",
            prxPort: port || "Unknown",
            country: parts[2] || "Unknown",
            org: parts[3] || "Unknown Org",
          }],
          pagination: {
            total: 1,
            offset: 0,
            limit: 1,
            hasMore: false,
            nextOffset: null
          }
        };
      }
    }

    // Proxy not found, return empty
    return {
      data: [],
      pagination: {
        total: 0,
        offset: 0,
        limit: 1,
        hasMore: false,
        nextOffset: null
      }
    };
  }

  // Priority 2: Country filter
  // If we have country filters, we MUST parse to check the country.
  // But if filterCC is empty, we can just slice.

  if (filterCC.length === 0) {
    // Fast path: No country filter, just slice the raw array
    // This avoids parsing thousands of lines we won't use
    const slicedLines = rawLines.slice(offset, offset + limit);
    
    // Parse only the slice
    const data = slicedLines.map(line => {
      const [prxIP, prxPort, country, org] = line.split(",");
      return {
        prxIP: prxIP || "Unknown",
        prxPort: prxPort || "Unknown",
        country: country || "Unknown",
        org: org || "Unknown Org",
      };
    });

    return {
      data,
      pagination: {
        total: rawLines.length,
        offset,
        limit,
        hasMore: offset + limit < rawLines.length,
        nextOffset: offset + limit < rawLines.length ? offset + limit : null
      }
    };
  } else {
    // Slow path: Country filter active
    // PERFORMANCE FIX: Early exit once we have enough items
    const filteredParsed = [];
    const lowerFilterCC = filterCC.map(c => c.toLowerCase());
    const targetCount = offset + limit; // We only need this many items
    
    for (const line of rawLines) {
      // Early exit: Stop if we have enough items
      if (filteredParsed.length >= targetCount) {
        break;
      }
      
      const parts = line.split(",");
      const country = parts[2] || "Unknown";
      
      if (lowerFilterCC.includes(country.toLowerCase())) {
        filteredParsed.push({
          prxIP: parts[0] || "Unknown",
          prxPort: parts[1] || "Unknown",
          country: country,
          org: parts[3] || "Unknown Org",
        });
      }
    }
    
    return paginateArray(filteredParsed, offset, limit, []); // Empty filterCC since we already filtered
  }
}
