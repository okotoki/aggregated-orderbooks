import { ExchangeFeed } from './base'
import type { BookChange, BookPriceLevel, Exchange } from '../types'

type BitMEXLevel = {
  symbol: string
  id: number
  side: 'Buy' | 'Sell'
  size: number
  price: number
}

export class BitMEXFeed extends ExchangeFeed {
  readonly exchange: Exchange = 'bitmex'
  protected readonly wssUrl = 'wss://ws.bitmex.com/realtime'

  // id → level for efficient updates/deletes
  private levelMap = new Map<number, BitMEXLevel>()
  private gotPartial = new Map<string, boolean>()

  protected mapToSubscribeMessages(symbols: string[]) {
    return [
      {
        op: 'subscribe',
        args: symbols.map((s) => `orderBookL2:${s}`),
      },
    ]
  }

  protected messageIsError(msg: any): boolean {
    if (msg.info) return false // welcome message
    if (msg.subscribe) return false // subscription confirmation
    if (msg.success !== undefined) return !msg.success
    if (msg.error) return true
    if (msg.table === undefined) return true
    return false
  }

  protected mapMessage(msg: any): BookChange | undefined {
    if (msg.table !== 'orderBookL2') return undefined

    const action = msg.action as string
    const data = msg.data as BitMEXLevel[]
    if (!data || data.length === 0) return undefined

    const symbol = data[0].symbol

    if (action === 'partial') {
      // Snapshot — clear and rebuild
      // Remove old levels for this symbol
      for (const [id, level] of this.levelMap) {
        if (level.symbol === symbol) this.levelMap.delete(id)
      }
      for (const level of data) {
        this.levelMap.set(level.id, level)
      }
      this.gotPartial.set(symbol, true)

      return this.buildBookChange(symbol, true)
    }

    // Drop all messages before first partial
    if (!this.gotPartial.get(symbol)) return undefined

    if (action === 'insert') {
      for (const level of data) {
        this.levelMap.set(level.id, level)
      }
    } else if (action === 'update') {
      for (const update of data) {
        const existing = this.levelMap.get(update.id)
        if (existing) {
          existing.size = update.size
        }
      }
    } else if (action === 'delete') {
      for (const level of data) {
        this.levelMap.delete(level.id)
      }
    }

    return this.buildBookChange(symbol, false)
  }

  private buildBookChange(symbol: string, isSnapshot: boolean): BookChange {
    const bids: BookPriceLevel[] = []
    const asks: BookPriceLevel[] = []

    for (const level of this.levelMap.values()) {
      if (level.symbol !== symbol) continue
      // BitMEX inverse perps: size is in contracts (USD). Convert to base currency.
      const entry = { price: level.price, amount: level.size / level.price }
      if (level.side === 'Buy') bids.push(entry)
      else asks.push(entry)
    }

    return {
      exchange: 'bitmex',
      symbol,
      isSnapshot,
      bids,
      asks,
      timestamp: new Date(),
    }
  }
}
