import { ExchangeFeed, type BookChangeCallback } from './base'
import type { BookChange, BookPriceLevel, Exchange } from '../types'

type BufferedUpdate = {
  microtimestamp: string
  timestamp: string
  bids: [string, string][]
  asks: [string, string][]
}

type SnapshotState = {
  received: boolean
  microtimestamp?: number
  bufferedUpdates: BufferedUpdate[]
}

export class BitstampFeed extends ExchangeFeed {
  readonly exchange: Exchange = 'bitstamp'
  protected readonly wssUrl = 'wss://ws.bitstamp.net'

  private snapshots = new Map<string, SnapshotState>()
  private symbols: string[] = []

  protected mapToSubscribeMessages(symbols: string[]) {
    return symbols.map((symbol) => ({
      event: 'bts:subscribe',
      data: { channel: `diff_order_book_${symbol}` },
    }))
  }

  protected messageIsError(msg: any): boolean {
    if (msg.event === 'bts:request_reconnect') return true
    return false
  }

  start(symbols: string[], onBookChange: BookChangeCallback) {
    this.symbols = symbols
    super.start(symbols, onBookChange)
  }

  protected onConnected() {
    // Reset state on every (re)connect — old book is stale
    for (const symbol of this.symbols) {
      this.snapshots.set(symbol, { received: false, bufferedUpdates: [] })
    }
    for (const symbol of this.symbols) {
      this.fetchRestSnapshot(symbol)
    }
  }

  private async fetchRestSnapshot(symbol: string) {
    try {
      // group=2 means no grouping — full price resolution
      const url = `https://www.bitstamp.net/api/v2/order_book/${symbol}?group=2`
      const response = await fetch(url)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const data = await response.json()

      const state = this.snapshots.get(symbol)
      if (!state || state.received) return

      const snapshotMicro = data.microtimestamp
        ? Number(data.microtimestamp)
        : Number(data.timestamp) * 1000000

      state.received = true
      state.microtimestamp = snapshotMicro

      // Emit snapshot
      this.emit({
        exchange: 'bitstamp',
        symbol: symbol.toUpperCase(),
        isSnapshot: true,
        bids: mapLevels(data.bids),
        asks: mapLevels(data.asks),
        timestamp: new Date(snapshotMicro / 1000),
      })

      // Replay buffered deltas newer than snapshot
      for (const update of state.bufferedUpdates) {
        if (Number(update.microtimestamp) > snapshotMicro) {
          state.microtimestamp = Number(update.microtimestamp)
          this.emit({
            exchange: 'bitstamp',
            symbol: symbol.toUpperCase(),
            isSnapshot: false,
            bids: mapLevels(update.bids),
            asks: mapLevels(update.asks),
            timestamp: new Date(Number(update.microtimestamp) / 1000),
          })
        }
      }
      state.bufferedUpdates = []

      console.log(`[bitstamp] snapshot for ${symbol}: ${data.bids.length} bids, ${data.asks.length} asks`)
    } catch (e) {
      console.error(`[bitstamp] failed to fetch snapshot for ${symbol}:`, e)
      // Retry after delay
      setTimeout(() => this.fetchRestSnapshot(symbol), 3000)
    }
  }

  protected mapMessage(msg: any): BookChange | undefined {
    if (msg.event === 'bts:subscription_succeeded') return undefined
    if (!msg.channel?.startsWith('diff_order_book_')) return undefined

    const symbol = msg.channel.replace('diff_order_book_', '')
    const state = this.snapshots.get(symbol)
    if (!state) return undefined

    if (msg.event === 'data') {
      if (!state.received) {
        state.bufferedUpdates.push(msg.data)
        return undefined
      }

      if (
        state.microtimestamp &&
        Number(msg.data.microtimestamp) <= state.microtimestamp
      ) {
        return undefined
      }

      state.microtimestamp = Number(msg.data.microtimestamp)

      return {
        exchange: 'bitstamp',
        symbol: symbol.toUpperCase(),
        isSnapshot: false,
        bids: mapLevels(msg.data.bids),
        asks: mapLevels(msg.data.asks),
        timestamp: new Date(Number(msg.data.microtimestamp) / 1000),
      }
    }

    return undefined
  }
}

function mapLevels(levels: [string, string][]): BookPriceLevel[] {
  return levels.map(([price, amount]) => ({
    price: Number(price),
    amount: Number(amount),
  }))
}
