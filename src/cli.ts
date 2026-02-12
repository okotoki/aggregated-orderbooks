import { createFeed } from './exchanges'
import { getMarketsForCoin, COINS } from './markets'
import { OrderBook } from './orderbook'
import { aggregate, type AggregatedBook } from './aggregator'
import type { Coin, Exchange } from './types'

// Parse args
const args = process.argv.slice(2)
const coinArg = (args[0] || 'BTC').toUpperCase() as Coin
const depthArg = parseInt(args.find((a) => a.startsWith('--depth='))?.split('=')[1] || '20')
const exchangeFilter = args.find((a) => a.startsWith('--exchange='))?.split('=')[1] as Exchange | undefined

if (!COINS.includes(coinArg)) {
  console.error(`Unknown coin: ${coinArg}. Supported: ${COINS.join(', ')}`)
  process.exit(1)
}

console.log(`Aggregated Orderbook — ${coinArg}`)
console.log(`Depth: ${depthArg}, Exchanges: ${exchangeFilter || 'all'}`)
console.log('Connecting...\n')

let markets = getMarketsForCoin(coinArg)
if (exchangeFilter) {
  markets = markets.filter((m) => m.exchange === exchangeFilter)
}

// One orderbook per exchange
const orderbooks = new Map<string, OrderBook>()
const feeds: ReturnType<typeof createFeed>[] = []

// Group symbols by exchange
const exchangeSymbols = new Map<Exchange, string[]>()
for (const market of markets) {
  const existing = exchangeSymbols.get(market.exchange) || []
  existing.push(market.symbol)
  exchangeSymbols.set(market.exchange, existing)

  const key = `${market.exchange}:${market.symbol}`.toLowerCase()
  orderbooks.set(key, new OrderBook(market.exchange, market.symbol))
}

// Start feeds
for (const [exchange, symbols] of exchangeSymbols) {
  const feed = createFeed(exchange)
  feeds.push(feed)

  feed.start(symbols, (bookChange) => {
    const key = `${bookChange.exchange}:${bookChange.symbol}`.toLowerCase()
    const ob = orderbooks.get(key)
    if (ob) {
      ob.apply(bookChange)
      render()
    }
  })
}

// Rendering
let lastRender = 0
const RENDER_INTERVAL = 250 // ms

function render() {
  const now = Date.now()
  if (now - lastRender < RENDER_INTERVAL) return
  lastRender = now

  const allBooks = Array.from(orderbooks.values())
  const aggregated = aggregate(allBooks, depthArg)

  printBook(aggregated, coinArg)
}

function printBook(book: AggregatedBook, coin: string) {
  // Move cursor to top
  process.stdout.write('\x1B[2J\x1B[H')

  const PAD = 14
  const EXCHANGE_COLORS: Record<Exchange, string> = {
    binance: '\x1b[33m',   // yellow
    coinbase: '\x1b[34m',  // blue
    kraken: '\x1b[35m',    // magenta
    bitstamp: '\x1b[36m',  // cyan
  }
  const RESET = '\x1b[0m'
  const GREEN = '\x1b[32m'
  const RED = '\x1b[31m'
  const DIM = '\x1b[2m'

  console.log(`${DIM}Aggregated Orderbook — ${coin}${RESET}\n`)

  // Header
  console.log(
    `${'BIDS'.padEnd(40)}  ${'ASKS'.padStart(40)}`
  )
  console.log(
    `${'Price'.padEnd(PAD)} ${'Amount'.padEnd(PAD)} ${'Exchanges'.padEnd(12)}  ${'Exchanges'.padEnd(12)} ${'Amount'.padEnd(PAD)} ${'Price'.padEnd(PAD)}`
  )
  console.log('─'.repeat(86))

  const maxRows = Math.max(book.bids.length, book.asks.length)

  for (let i = 0; i < maxRows; i++) {
    const bid = book.bids[i]
    const ask = book.asks[i]

    let bidStr = ''
    if (bid) {
      const exchanges = bid.exchanges
        .map((e) => `${EXCHANGE_COLORS[e.exchange]}${e.exchange.slice(0, 3)}${RESET}`)
        .join(' ')
      bidStr = `${GREEN}${bid.price.toFixed(2).padEnd(PAD)}${RESET} ${bid.amount.toFixed(4).padEnd(PAD)} ${exchanges}`
    } else {
      bidStr = ' '.repeat(40)
    }

    let askStr = ''
    if (ask) {
      const exchanges = ask.exchanges
        .map((e) => `${EXCHANGE_COLORS[e.exchange]}${e.exchange.slice(0, 3)}${RESET}`)
        .join(' ')
      askStr = `${exchanges.padEnd(12)} ${ask.amount.toFixed(4).padEnd(PAD)} ${RED}${ask.price.toFixed(2)}${RESET}`
    }

    console.log(`${bidStr}  ${askStr}`)
  }

  // Status line
  const readyCount = Array.from(orderbooks.values()).filter((ob) => ob.ready).length
  console.log(`\n${DIM}${readyCount}/${orderbooks.size} exchanges connected${RESET}`)
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down...')
  for (const feed of feeds) feed.stop()
  process.exit(0)
})
