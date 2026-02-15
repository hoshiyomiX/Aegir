<div align="center">

# 🌊 Aegir

**High-Performance Serverless Proxy Generator for Cloudflare Workers**

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/hoshiyomiX/Aegir)

[![License](https://img.shields.io/badge/License-ISC-blue.svg)](LICENSE)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-orange?logo=cloudflare)](https://workers.cloudflare.com/)
[![Version](https://img.shields.io/badge/Version-2.0.0-green.svg)](https://github.com/hoshiyomiX/Aegir)

*Transform proxy lists into high-speed, load-balanced subscription links with enterprise-grade optimizations*

</div>

---

## 📖 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Quick Start](#quick-start)
- [API Documentation](#api-documentation)
- [Configuration](#configuration)
- [Architecture](#architecture)
- [Optimizations](#optimizations)
- [Development](#development)
- [Contributing](#contributing)
- [Acknowledgments](#acknowledgments)

---

## Overview

Aegir is a modular, high-performance proxy subscription generator designed specifically for Cloudflare Workers. It transforms standard proxy lists (IP, Port, Country, Organization) into ready-to-use subscription links compatible with popular VPN clients including V2Ray, Clash, and Shadowsocks.

### Why Aegir?

| Feature | Description |
|---------|-------------|
| ⚡ **Ultra-Fast** | Streaming responses with near-instant TTFB |
| 🔄 **Auto Load-Balancing** | Intelligent proxy distribution across multiple endpoints |
| 🛡️ **Production-Ready** | Memory-safe with bounded caches and automatic cleanup |
| 🌐 **Multi-Protocol** | Supports VLESS, Trojan, and Shadowsocks |
| 📦 **Zero Dependencies** | Lightweight and secure |

---

## Features

### 🚀 Core Capabilities

- **Streaming Response Generation** - Configs are streamed chunk-by-chunk for minimal latency
- **Multi-Format Output** - Raw URI, V2Ray Base64, and Clash YAML formats
- **Country Filtering** - Filter proxies by country code(s)
- **Pagination Support** - Handle large proxy lists efficiently
- **WebSocket Proxy** - Full proxy functionality via WebSocket tunneling
- **DNS-over-HTTPS** - Pre-warmed DNS cache for faster connections

### 🔧 Advanced Optimizations

| Code | Name | Description |
|------|------|-------------|
| OPT-11 | Tidal Streaming | Chunk-by-chunk streaming for instant TTFB |
| OPT-12 | Connection Pooling | Reuse TCP connections to reduce latency |
| OPT-14 | Adaptive Resilience | Dynamic timeout based on P95 latency history |
| OPT-16 | Smart Retry | Exponential backoff with jitter for failed connections |
| OPT-17 | Request Deduplication | Prevent "Thundering Herd" with request coalescing |
| OPT-18 | DNS Pre-warming | Pre-resolve critical domains in background |
| OPT-19 | Lazy Parsing | On-demand proxy list parsing to save memory |
| OPT-20 | Flux Interpolation | Direct string building for faster URL generation |

---

## Quick Start

### Prerequisites

- Node.js 18+ (for local development)
- Cloudflare account with Workers enabled
- Wrangler CLI (`npm install -g wrangler`)

### One-Click Deployment

Click the deploy button above or use the following command:

```bash
# Clone the repository
git clone https://github.com/hoshiyomiX/Aegir.git
cd Aegir

# Deploy to Cloudflare Workers
wrangler deploy
```

### Local Development

```bash
# Install dependencies (if any)
npm install

# Start local development server
wrangler dev

# Run linter
npm run lint
```

---

## API Documentation

### Endpoints Overview

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Web UI for config generation |
| `/sub` | GET | Web UI (alias) |
| `/sub?host=[domain]` | GET | Generate Clash/YAML subscription |
| `/api/v1/sub` | GET | Generate configs with full parameters |
| `/api/v1/myip` | GET | Get client IP and Cloudflare metadata |
| `/api/v1/metrics` | GET | Worker health metrics and statistics |
| `/check?target=IP:PORT` | GET | Health check for specific proxy |

### Subscription Generation

```bash
# Basic subscription (raw URIs)
GET /api/v1/sub?limit=20&format=raw

# Filter by country
GET /api/v1/sub?cc=SG,ID,JP&limit=50

# V2Ray/Base64 format
GET /api/v1/sub?format=v2ray

# Clash YAML format
GET /sub?format=clash&host=your-worker.workers.dev

# Custom domain and SNI
GET /api/v1/sub?domain=cdn.example.com&sni=example.com
```

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `offset` | integer | 0 | Pagination offset |
| `limit` | integer | 20 | Max configs (1-100) |
| `cc` | string | - | Country codes (comma-separated) |
| `port` | string | 443,80 | Ports to include |
| `vpn` | string | trojan,vmess,ss | Protocols to generate |
| `format` | string | raw | Output format: raw, v2ray, clash |
| `domain` | string | worker host | Custom filler domain |
| `sni` / `host` | string | worker host | Custom SNI |
| `prx-list` | URL | default | Custom proxy list URL |

### Response Headers

| Header | Description |
|--------|-------------|
| `X-Pagination-Total` | Total available proxies |
| `X-Pagination-Has-More` | Whether more pages exist |
| `X-Pagination-Next-Offset` | Next page offset |
| `X-Cache-Status` | HIT or MISS |
| `X-Worker-Optimizations` | Active optimization flags |

---

## Configuration

### Environment Variables

Set these in your `wrangler.toml` or Cloudflare dashboard:

| Variable | Description | Default |
|----------|-------------|---------|
| `PRX_BANK_URL` | Custom proxy list URL | FoolVPN Nautica |
| `REVERSE_PRX_TARGET` | Fallback reverse proxy target | example.com |

### Proxy List Format

Aegir expects a CSV format:

```csv
IP,Port,CountryCode,Organization
104.16.0.1,443,SG,Cloudflare
104.16.0.2,443,ID,Cloudflare
```

### Recommended Proxy Sources

| Source | Description |
|--------|-------------|
| [CloudflareSpeedTest](https://github.com/XIU2/CloudflareSpeedTest) | Scan optimal IPs for your ISP |
| [Nautica](https://github.com/FoolVPN-ID/Nautica) | Pre-validated proxy lists |
| [cf-ip-scanner](https://github.com/vfarid/cf-ip-scanner) | Alternative IP scanner |

---

## Architecture

```
src/
├── index.js              # Main entry point & routing
├── config/
│   └── constants.js      # Configuration constants
├── core/
│   ├── state.js          # Global state management
│   └── diagnostics.js    # Stats formatting
├── handlers/
│   ├── tcp.js            # TCP connection handler
│   ├── udp.js            # UDP relay handler
│   └── websocket.js      # WebSocket proxy handler
├── protocols/
│   ├── parsers.js        # Protocol header parsers
│   └── sniffer.js        # Protocol detection
├── services/
│   ├── cache.js          # Multi-tier caching
│   ├── configGenerator.js# Subscription generator
│   ├── dns.js            # DNS-over-HTTPS resolver
│   ├── httpReverse.js    # Reverse proxy service
│   └── proxyProvider.js  # Proxy list provider
└── utils/
    ├── helpers.js        # Utility functions
    ├── network.js        # Network utilities
    └── streamPump.js     # Stream management
```

---

## Optimizations

### Memory Safety

All caches and maps are bounded with automatic eviction:

| Cache | Max Size | Eviction Policy |
|-------|----------|-----------------|
| DNS Cache | 50 entries | LRU |
| Connection Pool | 20 entries | Oldest first |
| Latency Tracker | 100 entries | Oldest first |
| Pending Requests | 100 entries | Oldest first |
| Flag Emoji Cache | 300 entries | LRU |

### Automatic Cleanup

- **5% probability**: Global cleanup per request
- **10% probability**: DNS cache cleanup
- Stats auto-reset at 1M operations to prevent overflow

---

## Development

### Project Structure

```bash
# Check code quality
npm run lint

# Deploy to production
npm run deploy
```

### Adding New Features

1. Create feature branch from `refactor-modular`
2. Implement changes following existing patterns
3. Ensure bounded memory usage for any new caches
4. Submit PR with detailed description

---

## Contributing

Contributions are welcome! Please follow these guidelines:

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'feat: add amazing feature'`)
4. **Push** to the branch (`git push origin feature/amazing-feature`)
5. **Open** a Pull Request

### Commit Convention

Follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` - New features
- `fix:` - Bug fixes
- `perf:` - Performance improvements
- `docs:` - Documentation changes
- `refactor:` - Code refactoring
- `test:` - Adding tests

---

## Acknowledgments

This project is inspired by and builds upon:

- [EDtunnel](https://github.com/3Kmfi6HP/EDtunnel) - Original concept
- [zizifn/edgetunnel](https://github.com/zizifn/edgetunnel) - Base implementation
- [FoolVPN-ID/Nautica](https://github.com/FoolVPN-ID/Nautica) - Proxy list provider

---

## License

This project is licensed under the **ISC License** - see the [LICENSE](LICENSE) file for details.

---

<div align="center">

**[⬆ Back to Top](#-aegir)**

Made with ❤️ by [hoshiyomiX](https://github.com/hoshiyomiX)

</div>
