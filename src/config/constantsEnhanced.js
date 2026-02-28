/**
 * Enhanced Constants Configuration
 * Improved configuration with better defaults and tuning
 */

// ============ ENHANCED CACHE SETTINGS ============

export const CACHE_TTL = 3600000; // 1 hour in milliseconds
export const CACHE_L1_MAX_SIZE = 200; // Increased from implicit
export const CACHE_STALE_TTL = 60000; // 1 minute stale window

// ============ ENHANCED DNS CONFIGURATION ============

export const DNS_CACHE_TTL = 600000; // 10 minutes
export const DNS_NEGATIVE_CACHE_TTL = 300000; // 5 minutes for NXDOMAIN
export const DNS_STALE_TTL = 60000; // 1 minute stale window
export const DNS_RESOLVER = "https://cloudflare-dns.com/dns-query";
export const DNS_RESOLVER_FALLBACK = "https://dns.google/resolve";
export const DNS_TIMEOUT = 5000; // 5 seconds per resolver
export const DNS_CONCURRENT_QUERIES = 2;

// Known external domains for pre-warming
export const KNOWN_DOMAINS = [
  "raw.githubusercontent.com",
  "api.foolvpn.web.id",
  "id1.foolvpn.web.id",
  "foolvpn.web.id",
  "udp-relay.hobihaus.space"
];

// ============ ENHANCED CONNECTION POOLING ============

export const POOL_MAX_SIZE = 30; // Increased from 20
export const POOL_IDLE_TIMEOUT = 60000; // 60 seconds
export const POOL_HEALTH_CHECK_INTERVAL = 30000; // 30 seconds
export const POOL_MAX_AGE = 90000; // 90 seconds max age

// ============ ENHANCED BUFFER MANAGEMENT ============

export const BUFFER_HIGH_WATERMARK = 262144; // 256KB
export const BUFFER_LOW_WATERMARK = 65536;   // 64KB
export const CHUNK_SIZE_OPTIMAL = 65536;     // 64KB per chunk
export const MAX_QUEUE_SIZE = 512;

// Memory pressure thresholds
export const MEMORY_PRESSURE_LOW = 0.5;      // < 50%
export const MEMORY_PRESSURE_MEDIUM = 0.75;  // 50-75%
export const MEMORY_PRESSURE_HIGH = 0.9;     // 75-90%
export const MEMORY_PRESSURE_CRITICAL = 0.95; // > 90%

// ============ ENHANCED ADAPTIVE TIMEOUT ============

export const LATENCY_HISTORY_SIZE = 20;  // Increased from 10
export const TIMEOUT_MIN = 5000;          // Reduced from 8000 (5s min)
export const TIMEOUT_MAX = 45000;         // 45s max
export const TIMEOUT_MULTIPLIER = 3.0;    // Reduced from 3.5 for faster adaptation
export const TIMEOUT_DEFAULT = 20000;     // Reduced from 25000 (20s default)
export const UDP_RELAY_TIMEOUT = 15000;

// ============ ENHANCED WATERMARKS ============

export const WATERMARK_INTERACTIVE = 2;
export const WATERMARK_BALANCED = 4;
export const WATERMARK_BULK = 8;
export const THRESHOLD_BULK = 5242880;    // 5MB
export const THRESHOLD_MEDIUM = 1048576;  // 1MB

// ============ ENHANCED CHUNK BATCHING ============

export const COALESCE_THRESHOLD = 16384;  // 16KB
export const COALESCE_MAX_SIZE = 131072;  // 128KB
export const COALESCE_TIMEOUT = 5;        // 5ms

// ============ ENHANCED RETRY SETTINGS ============

export const RETRY_MAX_ATTEMPTS = 3;
export const RETRY_BASE_DELAY = 500;      // Reduced from 1000 (500ms base)
export const RETRY_MAX_DELAY = 8000;
export const RETRY_JITTER_FACTOR = 0.3;

// ============ CIRCUIT BREAKER SETTINGS ============

export const CIRCUIT_FAILURE_THRESHOLD = 5;
export const CIRCUIT_SUCCESS_THRESHOLD = 3;
export const CIRCUIT_TIMEOUT = 30000;      // 30 seconds
export const CIRCUIT_VOLUME_THRESHOLD = 10;
export const CIRCUIT_WINDOW_SIZE = 60000;  // 60 seconds

// ============ REQUEST DEDUPLICATION ============

export const REQUEST_COALESCE_TTL = 2000;
export const REQUEST_COALESCE_MAX_SIZE = 100;

// ============ PROTOCOL SETTINGS ============

const horse = "dHJvamFu";
const flash = "dm1lc3M=";
const v2 = "djJyYXk=";
const neko = "Y2xhc2g=";

export const PROTOCOL_HORSE = atob(horse);
export const PROTOCOL_FLASH = atob(flash);
export const PROTOCOL_V2 = atob(v2);
export const PROTOCOL_NEKO = atob(neko);
export const UUID_V4_REGEX = /^[0-9a-f]{8}[0-9a-f]{4}4[0-9a-f]{3}[89ab][0-9a-f]{3}[0-9a-f]{12}$/i;

export const PORTS = [443, 80];
export const PROTOCOLS = [PROTOCOL_HORSE, PROTOCOL_FLASH, "ss"];
export const SUB_PAGE_URL = "https://foolvpn.web.id/nautica";
export const KV_PRX_URL = "https://raw.githubusercontent.com/FoolVPN-ID/Nautica/refs/heads/main/kvProxyList.json";
export const PRX_BANK_URL = "https://raw.githubusercontent.com/FoolVPN-ID/Nautica/refs/heads/main/proxyList.txt";
export const DNS_SERVER_ADDRESS = "8.8.8.8";
export const DNS_SERVER_PORT = 53;
export const RELAY_SERVER_UDP = {
  host: "udp-relay.hobihaus.space",
  port: 7300,
};
export const PRX_HEALTH_CHECK_API = "https://id1.foolvpn.web.id/api/v1/check";

export const WS_READY_STATE_OPEN = 1;
export const WS_READY_STATE_CLOSING = 2;

export const CORS_HEADER_OPTIONS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,HEAD,POST,OPTIONS",
  "Access-Control-Max-Age": "86400",
};

export const MAX_CONFIGS_PER_REQUEST = 20;

// ============ FEATURE FLAGS ============

export const FEATURES = {
  CIRCUIT_BREAKER: true,
  ADAPTIVE_TIMEOUT: true,
  CONNECTION_POOLING: true,
  BUFFER_POOLING: true,
  INTELLIGENT_BATCHING: true,
  DNS_FAILOVER: true,
  STALE_WHILE_REVALIDATE: true,
  NEGATIVE_CACHING: true,
  PREDICTIVE_WARMUP: true,
  GRACEFUL_DEGRADATION: true,
  EVENT_DRIVEN: true
};
