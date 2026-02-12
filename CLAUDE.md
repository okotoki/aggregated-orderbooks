# CLAUDE.md

## Project: aggregated-orderbooks

Open-source, real-time aggregated orderbook feed from multiple cryptocurrency exchanges. Vibe-coded in an afternoon.

## Scope

**In scope:**
- Connect to 4 major exchanges (Binance, Coinbase, Kraken, Bitstamp) via WebSocket
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

Vibe-coding this in one session. Each step gets committed so the git history tells the story.

### Phase 1: Skeleton
- [x] CLAUDE.md with project spec and build plan
- [x] `package.json`, `tsconfig.json`, basic project structure

### Phase 2: Exchange Connections — WebSocket Infrastructure
- [x] ReconnectingWebSocket — auto-reconnect with exponential backoff
- [x] Base `ExchangeFeed` class: connect, subscribe, normalize, emit `BookChange` events
- [x] Common types: `BookChange`, `BookPriceLevel`, `Exchange`

### Phase 3: Market Config
- [x] Hardcode supported markets per exchange per coin (BTC, ETH, SOL)
- [x] All USDT pairs for consistent pricing across exchanges
- [x] Symbol formats differ per exchange: Binance `btcusdt`, Coinbase `BTC-USDT`, Kraken `XBT/USDT`, Bitstamp `btcusdt`

### Phase 4: Exchange Implementations

Each exchange connects via WebSocket, subscribes to L2 orderbook, and normalizes into `BookChange { isSnapshot, bids, asks }`.

#### 4a. Coinbase
- **WSS**: `wss://ws-feed.exchange.coinbase.com`
- **Subscribe**: `{ type: 'subscribe', channels: [{ name: 'level2_batch', product_ids: ['BTC-USD'] }] }`
- **Snapshot**: Delivered automatically as first WS message (`type: 'snapshot'`)
- **Deltas**: `{ type: 'l2update', changes: [['buy'|'sell', price, amount]] }`
- **Symbol format**: `BTC-USD`
- **Quirks**: Snapshot bids/asks are `[price, amount]` strings. Deltas mix side into changes array. Rare invalid timestamps (`0001-01-01`).

#### 4b. Kraken
- **WSS**: `wss://ws.kraken.com`
- **Subscribe**: `{ event: 'subscribe', pair: ['XBT/USD'], subscription: { name: 'book', depth: 1000 } }`
- **Snapshot**: Delivered via WS as `[channelID, { as: [], bs: [] }, 'book-1000', 'XBT/USD']`
- **Deltas**: `[channelID, { a: [...] } | { b: [...] }, ...]` — bids/asks may be in separate objects or combined
- **Symbol format**: `XBT/USD` (XBT = BTC)
- **Quirks**: Array-based message format (not JSON objects). Heartbeat events. Book levels include timestamp as 3rd element.

#### 4c. Bitstamp
- **WSS**: `wss://ws.bitstamp.net`
- **Subscribe**: `{ event: 'bts:subscribe', data: { channel: 'diff_order_book_btcusd' } }`
- **Snapshot**: Must fetch via REST `https://www.bitstamp.net/api/v2/order_book/{symbol}?group=1`
- **Deltas**: `{ event: 'data', channel: 'diff_order_book_btcusd', data: { bids, asks, microtimestamp } }`
- **Symbol format**: lowercase concatenated `btcusd`
- **Quirks**: Buffer deltas until REST snapshot arrives. Replay buffered deltas newer than snapshot. May send `bts:request_reconnect`. Symbols must be lowercase.

#### 4d. Binance
- **WSS**: `wss://stream.binance.com:9443/stream`
- **Subscribe**: `{ method: 'SUBSCRIBE', params: ['btcusdt@depth'], id: 1 }`
- **Snapshot**: Must fetch via REST `https://data.binance.com/api/v3/depth?symbol=BTCUSDT&limit=5000`
- **Deltas**: `{ stream: 'btcusdt@depth', data: { s, U, u, b: [[price, amount]], a: [[price, amount]] } }`
- **Symbol format**: lowercase `btcusdt`
- **Quirks**: Buffer deltas until REST snapshot. Validate overlap: first delta must have `U <= lastUpdateId+1 AND u >= lastUpdateId+1`. Drop deltas where `u <= lastUpdateId`. Messages wrapped in `{ stream, data }`.

### Phase 5: Orderbook State Management
- [x] `OrderBook` class: maintains sorted bids (desc) and asks (asc) from snapshot + deltas
- [x] Apply snapshot: replace entire book
- [x] Apply delta: update price levels (amount=0 means remove)
- [x] Expose top N levels for bids/asks
- [x] One `OrderBook` instance per exchange per symbol

### Phase 6: Aggregated Orderbook
- [x] Merge all exchange orderbooks into one unified book
- [x] Same price level from different exchanges → sum amounts, track attribution
- [x] Keep bids sorted desc, asks sorted asc
- [x] Re-merge on every update from any exchange

### Phase 7: CLI
- [x] `bun run src/cli.ts BTC` — connect to all exchanges, print aggregated book
- [x] `--exchange binance` — single exchange passthrough mode
- [x] `--depth 20` — configurable depth
- [x] Pretty terminal output: updating in-place, colored bids/asks

### Phase 8: Browser UI
- [x] Static HTML + vanilla TS, bundled with bun (13KB minified)
- [x] Connects to exchanges directly from browser (all 4 support browser WebSocket)
- [x] Coin selector dropdown
- [x] Visual orderbook: horizontal bars for bids (green) / asks (red)
- [x] Exchange attribution per price level (colored dots)
- [x] Auto-updating in real-time

### Phase 9: Ship It
- [x] README.md — short, punchy, explains the "why"
- [x] GitHub Pages deployment for browser UI
- [x] Footer credit

### Commit Strategy
- Commit after every meaningful step (not just phases)
- Messages tell a story: what was built, what's next
- Goal: someone reading `git log` gets the full narrative
