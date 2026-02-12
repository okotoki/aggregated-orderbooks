# aggregated-orderbooks

Real-time aggregated orderbook from 4 crypto exchanges. Connects directly via WebSocket, merges everything into one unified book. Vibe-coded in an afternoon with Claude.

## Exchanges

- **Binance** — `wss://stream.binance.com`
- **Coinbase** — `wss://ws-feed.exchange.coinbase.com`
- **Kraken** — `wss://ws.kraken.com`
- **Bitstamp** — `wss://ws.bitstamp.net`

## Coins

BTC, ETH, SOL (all USDT pairs)

## Run

### CLI

```bash
# Show aggregated BTC orderbook
bun run src/cli.ts BTC

# Single exchange
bun run src/cli.ts ETH --exchange=binance

# Custom depth
bun run src/cli.ts SOL --depth=30
```

### Browser UI

```bash
bun run serve
# → http://localhost:3000
```

Or just open `docs/index.html` — it connects to exchanges directly from the browser, no server needed.

### Live Demo

[**okotoki.github.io/aggregated-orderbooks**](https://okotoki.github.io/aggregated-orderbooks/)

## How it works

1. **Connect** to each exchange via WebSocket
2. **Subscribe** to L2 orderbook channel (snapshot + deltas)
3. **Normalize** into a common `BookChange` format
4. **Maintain** per-exchange orderbook state (sorted bids/asks)
5. **Aggregate** — merge all books, sum amounts at matching price levels

Exchanges that send snapshots via REST (Binance, Bitstamp) buffer WebSocket deltas until the snapshot arrives, then replay.

## Stack

- [Bun](https://bun.sh) — runtime + bundler
- TypeScript
- Zero dependencies

13KB browser bundle. No React, no webpack, no node_modules sprawl.

---

Vibed by [TapeSurf](https://tapesurf.com)
