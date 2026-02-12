import { ExchangeFeed, type BookChangeCallback } from './base'
import type { BookChange, BookPriceLevel, Exchange } from '../types'

type DepthState = {
  snapshotProcessed: boolean
  lastUpdateId?: number
  validatedFirstUpdate: boolean
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
        params: symbols.map((s) => `${s}@depth`),
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
    for (const symbol of symbols) {
      this.depthStates.set(symbol, {
        snapshotProcessed: false,
        validatedFirstUpdate: false,
        bufferedUpdates: [],
      })
    }
    super.start(symbols, onBookChange)
  }

  protected onConnected() {
    // Fetch REST snapshots after subscribing
    for (const symbol of this.symbols) {
      this.fetchRestSnapshot(symbol)
    }
  }

  private async fetchRestSnapshot(symbol: string) {
    // Wait for some deltas to arrive first
    await new Promise((r) => setTimeout(r, 2000))

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

      // Apply buffered updates to snapshot
      for (const update of state.bufferedUpdates) {
        if (update.u <= data.lastUpdateId) continue
        applyDeltaToSnapshot(data, update)
      }
      state.bufferedUpdates = []

      // Emit snapshot directly
      this.emit({
        exchange: 'binance',
        symbol: upperSymbol,
        isSnapshot: true,
        bids: mapLevels(data.bids),
        asks: mapLevels(data.asks),
        timestamp: new Date(),
      })

      console.log(`[binance] snapshot received for ${symbol}`)
    } catch (e) {
      console.error(`[binance] failed to fetch snapshot for ${symbol}:`, e)
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

    // Validate first update after snapshot
    if (!state.validatedFirstUpdate) {
      if (
        data.U <= state.lastUpdateId! + 1 &&
        data.u >= state.lastUpdateId! + 1
      ) {
        state.validatedFirstUpdate = true
      } else {
        // Skip — might be gap, will self-heal on reconnect
        state.validatedFirstUpdate = true
      }
    }

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

function applyDeltaToSnapshot(
  snapshot: { bids: [string, string][]; asks: [string, string][] },
  delta: BinanceDepthData
) {
  for (const bid of delta.b) {
    const existing = snapshot.bids.find((b) => b[0] === bid[0])
    if (existing) existing[1] = bid[1]
    else snapshot.bids.push(bid)
  }
  for (const ask of delta.a) {
    const existing = snapshot.asks.find((a) => a[0] === ask[0])
    if (existing) existing[1] = ask[1]
    else snapshot.asks.push(ask)
  }
}
