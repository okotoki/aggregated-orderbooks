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

  protected mapToSubscribeMessages(symbols: string[]) {
    return symbols.map((symbol) => ({
      event: 'bts:subscribe',
      data: { channel: `diff_order_book_${symbol}` },
    }))
  }

  protected messageIsError(msg: any): boolean {
    if (msg.event === 'bts:request_reconnect') return true
    if (msg.channel === undefined && msg.event !== 'bts:subscription_succeeded')
      return false
    return false
  }

  start(symbols: string[], onBookChange: BookChangeCallback) {
    // Initialize snapshot state for each symbol
    for (const symbol of symbols) {
      this.snapshots.set(symbol, { received: false, bufferedUpdates: [] })
    }
    super.start(symbols, onBookChange)
  }

  protected onConnected() {
    // Fetch REST snapshots after subscribing
    for (const [symbol] of this.snapshots) {
      this.fetchRestSnapshot(symbol)
    }
  }

  private async fetchRestSnapshot(symbol: string) {
    // Wait a bit for WS to start delivering deltas
    await new Promise((r) => setTimeout(r, 1000))

    try {
      const url = `https://www.bitstamp.net/api/v2/order_book/${symbol}?group=1`
      const response = await fetch(url)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const data = await response.json()

      const state = this.snapshots.get(symbol)
      if (!state) return

      const snapshotMicro = data.microtimestamp
        ? Number(data.microtimestamp)
        : Number(data.timestamp) * 1000000

      state.received = true
      state.microtimestamp = snapshotMicro

      // Emit snapshot
      const bookChange: BookChange = {
        exchange: 'bitstamp',
        symbol: symbol.toUpperCase(),
        isSnapshot: true,
        bids: mapLevels(data.bids),
        asks: mapLevels(data.asks),
        timestamp: new Date(snapshotMicro / 1000),
      }

      // Manually invoke the callback through the ws message path
      // We need to call onBookChange which is private in base, so we use a workaround
      this.ws!.onmessage?.({
        data: JSON.stringify({
          _injectedSnapshot: true,
          bookChange,
        }),
      } as any)

      // Replay buffered deltas newer than snapshot
      for (const update of state.bufferedUpdates) {
        if (Number(update.microtimestamp) > snapshotMicro) {
          this.ws!.onmessage?.({
            data: JSON.stringify({
              event: 'data',
              channel: `diff_order_book_${symbol}`,
              data: update,
            }),
          } as any)
        }
      }
      state.bufferedUpdates = []

      console.log(`[bitstamp] snapshot received for ${symbol}`)
    } catch (e) {
      console.error(`[bitstamp] failed to fetch snapshot for ${symbol}:`, e)
    }
  }

  protected mapMessage(msg: any): BookChange | undefined {
    // Handle injected snapshots
    if (msg._injectedSnapshot) {
      return msg.bookChange
    }

    if (msg.event === 'bts:subscription_succeeded') return undefined
    if (!msg.channel?.startsWith('diff_order_book_')) return undefined

    const symbol = msg.channel.replace('diff_order_book_', '')
    const state = this.snapshots.get(symbol)
    if (!state) return undefined

    if (msg.event === 'data') {
      if (!state.received) {
        // Buffer until snapshot arrives
        state.bufferedUpdates.push(msg.data)
        return undefined
      }

      // Skip if older than snapshot
      if (
        state.microtimestamp &&
        Number(msg.data.microtimestamp) <= state.microtimestamp
      ) {
        return undefined
      }

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
