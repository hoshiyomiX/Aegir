<div align="center">

# Aegir

**High-Performance Serverless Proxy Generator for Cloudflare Workers**

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/hoshiyomiX/Aegir)

<img src="https://img.shields.io/badge/Version-2.0.0-0E7490?style=flat-square" alt="Version">
<img src="https://img.shields.io/badge/Cloudflare-Workers-F38020?style=flat-square&logo=cloudflare&logoColor=white" alt="Cloudflare Workers">
<img src="https://img.shields.io/badge/License-ISC-3B82F6?style=flat-square" alt="License">
<img src="https://img.shields.io/badge/Node.js-18+-339933?style=flat-square&logo=node.js&logoColor=white" alt="Node.js">

*Transform proxy lists into high-speed, load-balanced subscription links with enterprise-grade optimizations*

</div>

---

## Overview

Aegir is a modular, high-performance proxy subscription generator built specifically for **Cloudflare Workers**. It transforms standard proxy lists into ready-to-use subscription links compatible with popular VPN clients including V2Ray, Clash, and Shadowsocks.

### Key Highlights

| | |
|:---:|:---|
| **Ultra-Fast** | Streaming responses with near-instant Time To First Byte (TTFB) |
| **Auto Load-Balancing** | Intelligent proxy distribution across multiple endpoints |
| **Production-Ready** | Memory-safe with bounded caches and automatic cleanup mechanisms |
| **Multi-Protocol** | Full support for VLESS, Trojan, and Shadowsocks protocols |
| **Zero Dependencies** | Lightweight footprint with minimal attack surface |

---

## Quick Start

### Prerequisites

- Node.js 18+ (for local development)
- Cloudflare account with Workers enabled
- Wrangler CLI (`npm install -g wrangler`)

### Deployment

**Option 1: One-Click Deploy**

Click the **"Deploy to Cloudflare Workers"** button above.

**Option 2: Manual Deploy**

```bash
# Clone the repository
git clone https://github.com/hoshiyomiX/Aegir.git
cd Aegir

# Deploy to Cloudflare Workers
wrangler deploy
```

### Local Development

```bash
# Install dependencies
npm install

# Start local development server
wrangler dev

# Run linter
npm run lint
```

---

## API Reference

### Endpoints

| Endpoint | Method | Description |
|:---------|:------:|:------------|
| `/` | `GET` | Web UI for config generation |
| `/sub` | `GET` | Web UI (alias) |
| `/api/v1/sub` | `GET` | Generate subscription configs |
| `/api/v1/myip` | `GET` | Get client IP and Cloudflare metadata |
| `/api/v1/metrics` | `GET` | Worker health metrics and statistics |
| `/check` | `GET` | Health check for specific proxy |

### Usage Examples

```bash
# Basic subscription (raw URIs)
curl "https://your-worker.workers.dev/api/v1/sub?limit=20&format=raw"

# Filter by country codes
curl "https://your-worker.workers.dev/api/v1/sub?cc=SG,ID,JP&limit=50"

# V2Ray/Base64 format
curl "https://your-worker.workers.dev/api/v1/sub?format=v2ray"

# Clash YAML format
curl "https://your-worker.workers.dev/sub?format=clash&host=your-worker.workers.dev"

# Custom domain and SNI
curl "https://your-worker.workers.dev/api/v1/sub?domain=cdn.example.com&sni=example.com"

# Health check specific proxy
curl "https://your-worker.workers.dev/check?target=104.16.0.1:443"
```

### Query Parameters

| Parameter | Type | Default | Description |
|:----------|:----:|:-------:|:------------|
| `offset` | integer | `0` | Pagination offset |
| `limit` | integer | `20` | Maximum configs to return (1-100) |
| `cc` | string | — | Country codes, comma-separated (e.g., `SG,ID,JP`) |
| `port` | string | `443,80` | Ports to include |
| `vpn` | string | `trojan,vmess,ss` | Protocols to generate |
| `format` | string | `raw` | Output format: `raw`, `v2ray`, `clash` |
| `domain` | string | worker host | Custom filler domain |
| `sni` / `host` | string | worker host | Custom SNI |
| `prx-list` | URL | default | Custom proxy list URL |

### Response Headers

| Header | Description |
|:-------|:------------|
| `X-Pagination-Total` | Total available proxies |
| `X-Pagination-Has-More` | Whether more pages exist |
| `X-Pagination-Next-Offset` | Next page offset |
| `X-Cache-Status` | Cache status (`HIT` or `MISS`) |
| `X-Worker-Optimizations` | Active optimization flags |

---

## Configuration

### Environment Variables

Configure these in your `wrangler.toml` or Cloudflare dashboard:

| Variable | Description | Default |
|:---------|:------------|:--------|
| `PRX_BANK_URL` | Custom proxy list URL | FoolVPN Nautica |
| `REVERSE_PRX_TARGET` | Fallback reverse proxy target | `example.com` |

### Proxy List Format

Aegir expects a CSV format:

```csv
IP,Port,CountryCode,Organization
104.16.0.1,443,SG,Cloudflare
104.16.0.2,443,ID,Cloudflare
172.66.0.1,443,JP,Cloudflare
```

### Recommended Proxy Sources

| Source | Description |
|:-------|:------------|
| [CloudflareSpeedTest](https://github.com/XIU2/CloudflareSpeedTest) | Scan optimal IPs for your ISP |
| [Nautica](https://github.com/FoolVPN-ID/Nautica) | Pre-validated proxy lists |
| [cf-ip-scanner](https://github.com/vfarid/cf-ip-scanner) | Alternative IP scanner |

---

## Architecture

```
src/
├── index.js                 # Main entry point & routing
├── config/
│   └── constants.js         # Configuration constants
├── core/
│   ├── state.js             # Global state management
│   └── diagnostics.js       # Stats formatting
├── handlers/
│   ├── tcp.js               # TCP connection handler
│   ├── udp.js               # UDP relay handler
│   └── websocket.js         # WebSocket proxy handler
├── protocols/
│   ├── parsers.js           # Protocol header parsers
│   └── sniffer.js           # Protocol detection
├── services/
│   ├── cache.js             # Multi-tier caching
│   ├── configGenerator.js   # Subscription generator
│   ├── dns.js               # DNS-over-HTTPS resolver
│   ├── httpReverse.js       # Reverse proxy service
│   └── proxyProvider.js     # Proxy list provider
└── utils/
    ├── helpers.js           # Utility functions
    ├── network.js           # Network utilities
    └── streamPump.js        # Stream management
```

---

## Performance Optimizations

### Memory Safety

All caches and maps are bounded with automatic eviction policies:

| Cache | Max Size | Eviction Policy |
|:------|:--------:|:----------------|
| DNS Cache | 50 entries | LRU |
| Connection Pool | 20 entries | Oldest first |
| Latency Tracker | 100 entries | Oldest first |
| Pending Requests | 100 entries | Oldest first |
| Flag Emoji Cache | 300 entries | LRU |

### Optimization Techniques

| Code | Name | Description |
|:-----|:-----|:------------|
| OPT-11 | Tidal Streaming | Chunk-by-chunk streaming for instant TTFB |
| OPT-12 | Connection Pooling | Reuse TCP connections to reduce latency |
| OPT-14 | Adaptive Resilience | Dynamic timeout based on P95 latency history |
| OPT-16 | Smart Retry | Exponential backoff with jitter for failed connections |
| OPT-17 | Request Deduplication | Prevent "Thundering Herd" with request coalescing |
| OPT-18 | DNS Pre-warming | Pre-resolve critical domains in background |
| OPT-19 | Lazy Parsing | On-demand proxy list parsing to save memory |
| OPT-20 | Flux Interpolation | Direct string building for faster URL generation |

### Automatic Cleanup

- **5% probability**: Global cleanup triggered per request
- **10% probability**: DNS cache cleanup
- Stats auto-reset at 1M operations to prevent integer overflow

---

## Development

### Scripts

```bash
# Run linter
npm run lint

# Deploy to production
npm run deploy
```

### Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes following [Conventional Commits](https://www.conventionalcommits.org/)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Commit Convention

| Prefix | Usage |
|:-------|:------|
| `feat:` | New features |
| `fix:` | Bug fixes |
| `perf:` | Performance improvements |
| `docs:` | Documentation changes |
| `refactor:` | Code refactoring |
| `test:` | Adding tests |
| `chore:` | Maintenance tasks |

---

## Acknowledgments

This project builds upon the work of:

- **[EDtunnel](https://github.com/3Kmfi6HP/EDtunnel)** — Original concept
- **[zizifn/edgetunnel](https://github.com/zizifn/edgetunnel)** — Base implementation
- **[FoolVPN-ID/Nautica](https://github.com/FoolVPN-ID/Nautica)** — Proxy list provider

---

## License

This project is licensed under the **ISC License**.

---

<div align="center">

**[View on GitHub](https://github.com/hoshiyomiX/Aegir)**

Made with passion by [hoshiyomiX](https://github.com/hoshiyomiX)

</div>
