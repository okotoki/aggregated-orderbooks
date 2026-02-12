import type { BookChange, BookPriceLevel, Exchange } from './types'

/**
 * Maintains a single exchange's orderbook state.
 * Applies snapshots (full replace) and deltas (incremental updates).
 * amount=0 means remove that price level.
 *
 * Trims levels outside a meaningful range to avoid bloat:
 * - Bids: drop anything more than 50% below best bid
 * - Asks: drop anything more than 100% above best ask
 */
export class OrderBook {
  readonly exchange: Exchange
  readonly symbol: string

  private _bids: Map<number, number> = new Map()
  private _asks: Map<number, number> = new Map()

  private _sortedBids: BookPriceLevel[] = []
  private _sortedAsks: BookPriceLevel[] = []
  private _dirty = true
  private _trimCounter = 0

  constructor(exchange: Exchange, symbol: string) {
    this.exchange = exchange
    this.symbol = symbol
  }

  get bids(): BookPriceLevel[] {
    if (this._dirty) this.rebuild()
    return this._sortedBids
  }

  get asks(): BookPriceLevel[] {
    if (this._dirty) this.rebuild()
    return this._sortedAsks
  }

  get ready(): boolean {
    return this._bids.size > 0 || this._asks.size > 0
  }

  get levelCount(): number {
    return this._bids.size + this._asks.size
  }

  apply(change: BookChange) {
    if (change.isSnapshot) {
      this._bids.clear()
      this._asks.clear()
    }

    for (const { price, amount } of change.bids) {
      if (amount === 0) this._bids.delete(price)
      else this._bids.set(price, amount)
    }

    for (const { price, amount } of change.asks) {
      if (amount === 0) this._asks.delete(price)
      else this._asks.set(price, amount)
    }

    this._dirty = true

    // Trim every 50 updates to keep maps lean
    if (++this._trimCounter >= 50) {
      this._trimCounter = 0
      this.trim()
    }
  }

  topBids(n: number): BookPriceLevel[] {
    return this.bids.slice(0, n)
  }

  topAsks(n: number): BookPriceLevel[] {
    return this.asks.slice(0, n)
  }

  private trim() {
    // Find best bid (highest) and best ask (lowest)
    let bestBid = 0
    for (const price of this._bids.keys()) {
      if (price > bestBid) bestBid = price
    }
    let bestAsk = Infinity
    for (const price of this._asks.keys()) {
      if (price < bestAsk) bestAsk = price
    }

    if (bestBid > 0) {
      const minBid = bestBid * 0.5 // drop bids more than 50% below
      for (const price of this._bids.keys()) {
        if (price < minBid) this._bids.delete(price)
      }
    }

    if (bestAsk < Infinity) {
      const maxAsk = bestAsk * 2.0 // drop asks more than 100% above
      for (const price of this._asks.keys()) {
        if (price > maxAsk) this._asks.delete(price)
      }
    }

    this._dirty = true
  }

  private rebuild() {
    this._sortedBids = Array.from(this._bids.entries())
      .map(([price, amount]) => ({ price, amount }))
      .sort((a, b) => b.price - a.price)

    this._sortedAsks = Array.from(this._asks.entries())
      .map(([price, amount]) => ({ price, amount }))
      .sort((a, b) => a.price - b.price)

    this._dirty = false
  }
}
