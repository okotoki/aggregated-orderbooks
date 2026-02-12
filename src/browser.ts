import { createFeed } from './exchanges'
import { getMarketsForCoin, COINS } from './markets'
import { OrderBook } from './orderbook'
import { aggregate, type AggregatedBook, type AggregatedLevel } from './aggregator'
import type { Coin, Exchange } from './types'
import type { ExchangeFeed } from './exchanges/base'

let currentCoin: Coin = 'BTC'
let currentDepth = 25
let orderbooks = new Map<string, OrderBook>()
let feeds: ExchangeFeed[] = []
let lastRender = 0

const EXCHANGE_COLORS: Record<Exchange, string> = {
  binance: '#F0B90B',
  coinbase: '#0052FF',
  kraken: '#7B61FF',
  bitstamp: '#4A9C5E',
}

const EXCHANGE_NAMES: Record<Exchange, string> = {
  binance: 'Binance',
  coinbase: 'Coinbase',
  kraken: 'Kraken',
  bitstamp: 'Bitstamp',
}

function startFeeds(coin: Coin) {
  // Stop existing
  for (const feed of feeds) feed.stop()
  feeds = []
  orderbooks.clear()

  const markets = getMarketsForCoin(coin)
  const exchangeSymbols = new Map<Exchange, string[]>()

  for (const market of markets) {
    const existing = exchangeSymbols.get(market.exchange) || []
    existing.push(market.symbol)
    exchangeSymbols.set(market.exchange, existing)

    const key = `${market.exchange}:${market.symbol}`.toLowerCase()
    orderbooks.set(key, new OrderBook(market.exchange, market.symbol))
  }

  // Update status
  updateStatus('Connecting...')

  for (const [exchange, symbols] of exchangeSymbols) {
    const feed = createFeed(exchange)
    feeds.push(feed)

    feed.start(symbols, (bookChange) => {
      const key = `${bookChange.exchange}:${bookChange.symbol}`.toLowerCase()
      const ob = orderbooks.get(key)
      if (ob) {
        ob.apply(bookChange)
        scheduleRender()
      }
    })
  }
}

function scheduleRender() {
  const now = Date.now()
  if (now - lastRender < 200) return
  lastRender = now
  requestAnimationFrame(render)
}

function render() {
  const allBooks = Array.from(orderbooks.values())
  const book = aggregate(allBooks, currentDepth)

  const readyCount = allBooks.filter((ob) => ob.ready).length
  updateStatus(`${readyCount}/${orderbooks.size} exchanges connected`)

  renderBook(book)
}

function renderBook(book: AggregatedBook) {
  const bidsEl = document.getElementById('bids')!
  const asksEl = document.getElementById('asks')!

  const maxBidAmount = Math.max(...book.bids.map((l) => l.amount), 0.001)
  const maxAskAmount = Math.max(...book.asks.map((l) => l.amount), 0.001)

  bidsEl.innerHTML = book.bids.map((l) => renderBidRow(l, maxBidAmount)).join('')
  asksEl.innerHTML = book.asks.map((l) => renderAskRow(l, maxAskAmount)).join('')

  // Spread + grouping info
  if (book.bids.length > 0 && book.asks.length > 0) {
    const spread = book.asks[0].price - book.bids[0].price
    const spreadPct = ((spread / book.asks[0].price) * 100).toFixed(3)
    document.getElementById('spread')!.textContent =
      `Spread: $${spread.toFixed(2)} (${spreadPct}%)  ·  Grouping: $${book.grouping}`
  }
}

function renderBidRow(level: AggregatedLevel, maxAmount: number): string {
  const pct = (level.amount / maxAmount) * 100
  const exchangeDots = level.exchanges
    .map(
      (e) =>
        `<span class="exchange-dot" style="background:${EXCHANGE_COLORS[e.exchange]}" title="${EXCHANGE_NAMES[e.exchange]}: ${e.amount.toFixed(4)}"></span>`
    )
    .join('')

  return `<div class="row bid">
    <div class="bar-bg"><div class="bar bid-bar" style="width:${pct}%"></div></div>
    <span class="exchanges">${exchangeDots}</span>
    <span class="amount">${level.amount.toFixed(4)}</span>
    <span class="price">${level.price.toFixed(2)}</span>
  </div>`
}

function renderAskRow(level: AggregatedLevel, maxAmount: number): string {
  const pct = (level.amount / maxAmount) * 100
  const exchangeDots = level.exchanges
    .map(
      (e) =>
        `<span class="exchange-dot" style="background:${EXCHANGE_COLORS[e.exchange]}" title="${EXCHANGE_NAMES[e.exchange]}: ${e.amount.toFixed(4)}"></span>`
    )
    .join('')

  return `<div class="row ask">
    <span class="price">${level.price.toFixed(2)}</span>
    <span class="amount">${level.amount.toFixed(4)}</span>
    <span class="exchanges">${exchangeDots}</span>
    <div class="bar-bg"><div class="bar ask-bar" style="width:${pct}%"></div></div>
  </div>`
}

function updateStatus(text: string) {
  const el = document.getElementById('status')
  if (el) el.textContent = text
}

// Initialize
function init() {
  // Coin selector
  const selector = document.getElementById('coin-select') as HTMLSelectElement
  for (const coin of COINS) {
    const opt = document.createElement('option')
    opt.value = coin
    opt.textContent = coin
    if (coin === currentCoin) opt.selected = true
    selector.appendChild(opt)
  }

  selector.addEventListener('change', () => {
    currentCoin = selector.value as Coin
    document.getElementById('coin-label')!.textContent = currentCoin
    startFeeds(currentCoin)
  })

  // Legend
  const legend = document.getElementById('legend')!
  for (const [exchange, color] of Object.entries(EXCHANGE_COLORS)) {
    legend.innerHTML += `<span class="legend-item"><span class="exchange-dot" style="background:${color}"></span> ${EXCHANGE_NAMES[exchange as Exchange]}</span>`
  }

  document.getElementById('coin-label')!.textContent = currentCoin
  startFeeds(currentCoin)
}

document.addEventListener('DOMContentLoaded', init)
