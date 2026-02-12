import { ExchangeFeed, type BookChangeCallback } from './base'
import type { BookChange, BookPriceLevel, Exchange } from '../types'

type DepthState = {
  snapshotProcessed: boolean
  lastUpdateId?: number
  bufferedUpdates: BinanceDepthData[]
}

type BinanceDepthData = {
  s: string
  U: number
  u: number
  b: [string, string][]
  a: [string, string][]
  E: number
}

export class BinanceFeed extends ExchangeFeed {
  readonly exchange: Exchange = 'binance'
  protected readonly wssUrl = 'wss://stream.binance.com:9443/stream'

  private depthStates = new Map<string, DepthState>()
  private symbols: string[] = []

  protected mapToSubscribeMessages(symbols: string[]) {
    return [
      {
        method: 'SUBSCRIBE',
        params: symbols.map((s) => `${s}@depth@100ms`),
        id: 1,
      },
    ]
  }

  protected messageIsError(msg: any): boolean {
    if (msg.result === null) return false // subscription confirmation
    if (msg.stream === undefined) return true
    if (msg.error !== undefined) return true
    return false
  }

  start(symbols: string[], onBookChange: BookChangeCallback) {
    this.symbols = symbols
    super.start(symbols, onBookChange)
  }

  protected onConnected() {
    // Reset state on every (re)connect — old book is stale
    for (const symbol of this.symbols) {
      this.depthStates.set(symbol, {
        snapshotProcessed: false,
        bufferedUpdates: [],
      })
    }
    // Fetch REST snapshots
    for (const symbol of this.symbols) {
      this.fetchRestSnapshot(symbol)
    }
  }

  private async fetchRestSnapshot(symbol: string) {
    try {
      const upperSymbol = symbol.toUpperCase()
      const url = `https://api.binance.com/api/v3/depth?symbol=${upperSymbol}&limit=5000`
      const response = await fetch(url)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const data = await response.json()

      const state = this.depthStates.get(symbol)
      if (!state || state.snapshotProcessed) return

      state.lastUpdateId = data.lastUpdateId
      state.snapshotProcessed = true

      // Build snapshot map for efficient delta application
      const bidMap = new Map<string, string>()
      const askMap = new Map<string, string>()
      for (const [p, a] of data.bids) bidMap.set(p, a)
      for (const [p, a] of data.asks) askMap.set(p, a)

      // Apply buffered updates that are newer than the snapshot
      let foundFirstValid = false
      for (const update of state.bufferedUpdates) {
        // Drop events where u <= lastUpdateId
        if (update.u <= data.lastUpdateId) continue

        // First valid event must satisfy: U <= lastUpdateId+1 AND u >= lastUpdateId+1
        if (!foundFirstValid) {
          if (update.U > data.lastUpdateId + 1) {
            // Gap — snapshot too old, re-fetch
            console.warn(`[binance] gap detected for ${symbol}, re-fetching snapshot`)
            state.snapshotProcessed = false
            state.bufferedUpdates = []
            this.fetchRestSnapshot(symbol)
            return
          }
          foundFirstValid = true
        }

        state.lastUpdateId = update.u
        for (const [p, a] of update.b) bidMap.set(p, a)
        for (const [p, a] of update.a) askMap.set(p, a)
      }
      state.bufferedUpdates = []

      // Convert maps to level arrays
      const bids: BookPriceLevel[] = []
      for (const [p, a] of bidMap) {
        const amount = Number(a)
        if (amount > 0) bids.push({ price: Number(p), amount })
      }
      const asks: BookPriceLevel[] = []
      for (const [p, a] of askMap) {
        const amount = Number(a)
        if (amount > 0) asks.push({ price: Number(p), amount })
      }

      this.emit({
        exchange: 'binance',
        symbol: upperSymbol,
        isSnapshot: true,
        bids,
        asks,
        timestamp: new Date(),
      })

      console.log(`[binance] snapshot for ${symbol}: ${bids.length} bids, ${asks.length} asks`)
    } catch (e) {
      console.error(`[binance] failed to fetch snapshot for ${symbol}:`, e)
      // Retry after delay
      setTimeout(() => this.fetchRestSnapshot(symbol), 3000)
    }
  }

  protected mapMessage(msg: any): BookChange | undefined {
    if (!msg.stream?.includes('@depth')) return undefined

    const data = msg.data as BinanceDepthData
    const symbol = data.s.toLowerCase()
    const state = this.depthStates.get(symbol)
    if (!state) return undefined

    if (!state.snapshotProcessed) {
      state.bufferedUpdates.push(data)
      return undefined
    }

    // Drop stale updates
    if (data.u <= state.lastUpdateId!) return undefined

    state.lastUpdateId = data.u

    return {
      exchange: 'binance',
      symbol: data.s,
      isSnapshot: false,
      bids: mapLevels(data.b),
      asks: mapLevels(data.a),
      timestamp: new Date(data.E),
    }
  }
}

function mapLevels(levels: [string, string][]): BookPriceLevel[] {
  return levels.map(([price, amount]) => ({
    price: Number(price),
    amount: Number(amount),
  }))
}
