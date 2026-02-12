import type { BookChange, BookPriceLevel, Exchange } from './types'

/**
 * Maintains a single exchange's orderbook state.
 * Applies snapshots (full replace) and deltas (incremental updates).
 * amount=0 means remove that price level.
 */
export class OrderBook {
  readonly exchange: Exchange
  readonly symbol: string

  // Sorted: bids descending by price, asks ascending by price
  private _bids: Map<number, number> = new Map()
  private _asks: Map<number, number> = new Map()

  private _sortedBids: BookPriceLevel[] = []
  private _sortedAsks: BookPriceLevel[] = []
  private _dirty = true

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
  }

  topBids(n: number): BookPriceLevel[] {
    return this.bids.slice(0, n)
  }

  topAsks(n: number): BookPriceLevel[] {
    return this.asks.slice(0, n)
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
