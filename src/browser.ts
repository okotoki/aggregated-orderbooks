import { createFeed } from './exchanges'
import { getMarketsForCoin, COINS } from './markets'
import { OrderBook } from './orderbook'
import { aggregate, autoGrouping, type AggregatedBook, type AggregatedLevel } from './aggregator'
import type { Coin, Exchange, MarketType } from './types'
import type { ExchangeFeed } from './exchanges/base'

let currentCoin: Coin = 'BTC'
let currentMarketType: MarketType = 'spot'
let currentDepth = 20
let currentGrouping: number | undefined = undefined // undefined = auto
let orderbooks = new Map<string, OrderBook>()
let feeds: ExchangeFeed[] = []
let lastRender = 0

const EXCHANGE_COLORS: Record<Exchange, string> = {
  binance: '#BBBBFF',
  coinbase: '#33CCFF',
  kraken: '#FF3366',
  bitstamp: '#66FF99',
  'binance-futures': '#FFD700',
  bybit: '#FF9933',
  bitmex: '#FF5555',
}

const EXCHANGE_NAMES: Record<Exchange, string> = {
  binance: 'Binance',
  coinbase: 'Coinbase',
  kraken: 'Kraken',
  bitstamp: 'Bitstamp',
  'binance-futures': 'Binance Futures',
  bybit: 'Bybit',
  bitmex: 'BitMEX',
}

function rebuildLegend(coin: Coin) {
  const legend = document.getElementById('legend')!
  const markets = getMarketsForCoin(coin, currentMarketType)
  legend.innerHTML = ''
  for (const market of markets) {
    const color = EXCHANGE_COLORS[market.exchange]
    legend.innerHTML += `<span class="legend-item" data-exchange="${market.exchange}">${EXCHANGE_NAMES[market.exchange]} <span class="legend-market">${market.symbol}</span> <span class="exchange-dot" style="background:${color}"></span></span>`
  }
}

function startFeeds(coin: Coin) {
  // Stop existing
  for (const feed of feeds) feed.stop()
  feeds = []
  orderbooks.clear()

  rebuildLegend(coin)

  const markets = getMarketsForCoin(coin, currentMarketType)
  const exchangeSymbols = new Map<Exchange, string[]>()

  for (const market of markets) {
    const existing = exchangeSymbols.get(market.exchange) || []
    existing.push(market.symbol)
    exchangeSymbols.set(market.exchange, existing)

    const key = `${market.exchange}:${market.symbol}`.toLowerCase()
    orderbooks.set(key, new OrderBook(market.exchange, market.symbol))
  }

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
  const book = aggregate(allBooks, currentDepth, currentGrouping)

  renderBook(book)
  updateLegend(allBooks)
}

/**
 * Fill gaps in a level array so every bin step is represented.
 * Missing bins get amount=0, no exchanges.
 */
function fillGaps(levels: AggregatedLevel[], grouping: number, depth: number, direction: 'desc' | 'asc'): AggregatedLevel[] {
  if (levels.length === 0 || grouping <= 0) return levels
  const filled: AggregatedLevel[] = []
  let price = levels[0].price
  let idx = 0

  while (filled.length < depth) {
    // Round to avoid floating point drift
    const rounded = Math.round(price * 1e8) / 1e8

    if (idx < levels.length && Math.abs(levels[idx].price - rounded) < grouping * 0.01) {
      filled.push(levels[idx])
      idx++
    } else {
      filled.push({ price: rounded, amount: 0, exchanges: [] })
    }

    price = direction === 'desc' ? price - grouping : price + grouping
  }

  return filled
}

function renderBook(book: AggregatedBook) {
  const bidsEl = document.getElementById('bids')!
  const asksEl = document.getElementById('asks')!

  const bids = fillGaps(book.bids, book.grouping, currentDepth, 'desc')
  const asks = fillGaps(book.asks, book.grouping, currentDepth, 'asc')

  const maxAmount = Math.max(
    ...bids.map((l) => l.amount),
    ...asks.map((l) => l.amount),
    0.001
  )

  // Compute cumulative amounts from spread outward
  let bidCum = 0
  const bidCums = bids.map((l) => { bidCum += l.amount; return bidCum })
  let askCum = 0
  const askCums = asks.map((l) => { askCum += l.amount; return askCum })
  const maxCum = Math.max(bidCum, askCum, 0.001)

  // Asks: highest at top, best ask at bottom (near spread)
  asksEl.innerHTML = asks.map((l, i) => renderRow(l, maxAmount, askCums[i], maxCum, 'ask')).reverse().join('')
  // Bids: best bid at top (near spread), descending
  bidsEl.innerHTML = bids.map((l, i) => renderRow(l, maxAmount, bidCums[i], maxCum, 'bid')).join('')

  // Update grouping selector to reflect current auto value
  updateGroupingOptions(book.grouping)
}

function renderExchangeBar(level: AggregatedLevel, maxAmount: number): string {
  if (level.amount === 0) return ''
  const title = level.exchanges
    .map((e) => `${EXCHANGE_NAMES[e.exchange]}: ${e.amount.toFixed(4)}`)
    .join('\n')
  // Each exchange gets a segment proportional to its share of maxAmount
  const segments = level.exchanges
    .map((e) => {
      const w = (e.amount / maxAmount) * 100
      return `<div class="bar-seg" style="width:${w}%;background:${EXCHANGE_COLORS[e.exchange]}" title="${title}"></div>`
    })
    .join('')
  return segments
}

function renderRow(level: AggregatedLevel, maxAmount: number, cumulative: number, maxCum: number, side: 'bid' | 'ask'): string {
  const empty = level.amount === 0
  const cls = empty ? `row ${side} empty` : `row ${side}`
  const cumPct = (cumulative / maxCum) * 100

  return `<div class="${cls}">
    <span class="price">${level.price.toFixed(2)}</span>
    <span class="amount">${empty ? '' : level.amount.toFixed(4)}</span>
    <div class="bar-bg"><div class="cum-fill" style="width:${cumPct}%"></div>${renderExchangeBar(level, maxAmount)}</div>
    <span class="cumulative">${empty ? '' : cumulative.toFixed(2)}</span>
  </div>`
}

function updateLegend(allBooks: OrderBook[]) {
  const legend = document.getElementById('legend')!
  const items = legend.querySelectorAll('.legend-item')

  for (const item of items) {
    const exchange = item.getAttribute('data-exchange') as Exchange
    if (!exchange) continue

    const books = allBooks.filter((ob) => ob.exchange === exchange)
    if (books.some((ob) => ob.ready)) {
      item.classList.add('active')
    } else {
      item.classList.remove('active')
    }
  }

}

function getGroupingOptions(baseGrouping: number): number[] {
  // Offer auto value, plus some multiples and fractions
  const options = new Set<number>()
  options.add(baseGrouping / 10)
  options.add(baseGrouping / 5)
  options.add(baseGrouping / 2)
  options.add(baseGrouping)
  options.add(baseGrouping * 2)
  options.add(baseGrouping * 5)
  options.add(baseGrouping * 10)
  return Array.from(options).filter((v) => v >= 0.001).sort((a, b) => a - b)
}

let lastGroupingBase = 0

function updateGroupingOptions(currentAutoGrouping: number) {
  if (currentAutoGrouping === lastGroupingBase) return
  lastGroupingBase = currentAutoGrouping

  const selector = document.getElementById('grouping-select') as HTMLSelectElement
  const options = getGroupingOptions(currentAutoGrouping)

  selector.innerHTML = ''
  const autoOpt = document.createElement('option')
  autoOpt.value = 'auto'
  autoOpt.textContent = `Group: Auto ($${currentAutoGrouping})`
  selector.appendChild(autoOpt)

  for (const val of options) {
    const opt = document.createElement('option')
    opt.value = String(val)
    opt.textContent = `Group: $${val}`
    if (currentGrouping === val) opt.selected = true
    selector.appendChild(opt)
  }

  if (currentGrouping === undefined) {
    selector.value = 'auto'
  }
}

function updateMarketTypeButtons() {
  const spotBtn = document.getElementById('btn-spot')!
  const perpBtn = document.getElementById('btn-perp')!
  spotBtn.classList.toggle('active', currentMarketType === 'spot')
  perpBtn.classList.toggle('active', currentMarketType === 'perp')
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
    lastGroupingBase = 0 // reset so grouping options refresh for new coin
    currentGrouping = undefined
    startFeeds(currentCoin)
  })

  // Grouping selector
  const groupingSelector = document.getElementById('grouping-select') as HTMLSelectElement
  groupingSelector.addEventListener('change', () => {
    if (groupingSelector.value === 'auto') {
      currentGrouping = undefined
    } else {
      currentGrouping = parseFloat(groupingSelector.value)
    }
    scheduleRender()
    // Force immediate render
    lastRender = 0
    render()
  })

  // Spot/Perps toggle
  const spotBtn = document.getElementById('btn-spot')!
  const perpBtn = document.getElementById('btn-perp')!

  spotBtn.addEventListener('click', () => {
    if (currentMarketType === 'spot') return
    currentMarketType = 'spot'
    updateMarketTypeButtons()
    lastGroupingBase = 0
    currentGrouping = undefined
    startFeeds(currentCoin)
  })

  perpBtn.addEventListener('click', () => {
    if (currentMarketType === 'perp') return
    currentMarketType = 'perp'
    updateMarketTypeButtons()
    lastGroupingBase = 0
    currentGrouping = undefined
    startFeeds(currentCoin)
  })

  updateMarketTypeButtons()
  startFeeds(currentCoin)
}

document.addEventListener('DOMContentLoaded', init)
