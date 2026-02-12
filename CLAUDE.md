# CLAUDE.md

## Project: aggregated-orderbooks

Open-source, real-time aggregated orderbook feed from multiple cryptocurrency exchanges. Vibe-coded in an afternoon.

## Scope

**In scope:**
- Connect to 3-5 major exchanges (Binance, Bybit, Coinbase, Kraken) via WebSocket
- Normalize orderbook data into a common format
- Merge/aggregate books across exchanges into a single unified orderbook
- Stream the aggregated result in real-time
- Basic browser UI: select multiple coins, visualize aggregated orderbooks
- Hosted on GitHub Pages for zero-friction demo

**Out of scope:**
- Historical data
- Candles, trades, heatmaps, or any derived analytics
- Production-grade reliability, SLAs, rate limit management
- Comprehensive exchange coverage

## Tech

- Bun
- TypeScript
- Minimal dependencies
- Browser-based UI (served via GitHub Pages)
- Two modes: `bunx` CLI for raw feed, or browser UI for visualization

## Tone

Experimental, casual. README should be short and punchy. No enterprise docs. Weekend project that happens to work.

---

## Build Plan

This is the step-by-step plan for vibe-coding this project in one session. Each step gets committed so the git history tells the story.

### Phase 1: Skeleton
- [x] CLAUDE.md with project spec and build plan
- [ ] `package.json`, `tsconfig.json`, basic project structure
- [ ] Entry point stubs: `src/cli.ts`, `src/index.ts`

### Phase 2: Exchange Connections
- [ ] Define common types: `OrderbookUpdate`, `Exchange`, `NormalizedOrder`
- [ ] Binance WebSocket feed (BTC-USDT orderbook stream)
- [ ] Bybit WebSocket feed
- [ ] Coinbase WebSocket feed
- [ ] Kraken WebSocket feed
- [ ] Each exchange: connect, subscribe, normalize into common format

### Phase 3: Aggregation Engine
- [ ] Per-exchange orderbook state management (apply snapshots + deltas)
- [ ] Merge all exchange books into one sorted aggregated book
- [ ] Configurable depth (top N levels)
- [ ] Re-aggregate on every update from any exchange

### Phase 4: CLI Output
- [ ] `bunx` entry point that connects to all exchanges for a given symbol
- [ ] Pretty-print aggregated orderbook to terminal (updating in-place)
- [ ] Symbol selection via CLI arg

### Phase 5: Browser UI
- [ ] Static HTML page with vanilla JS/TS (no framework)
- [ ] WebSocket or direct browser connections to exchanges
- [ ] Coin selector (BTC, ETH, SOL, etc.)
- [ ] Visual orderbook: bids/asks with depth bars, exchange attribution
- [ ] Auto-updating in real-time

### Phase 6: Ship It
- [ ] README.md — short, punchy, with demo GIF/screenshot
- [ ] GitHub Pages config for browser UI
- [ ] Final cleanup pass

### Commit Strategy
- Commit after every meaningful step (not just phases)
- Messages tell a story: what was built, what's next
- Goal: someone reading `git log` gets the full narrative
