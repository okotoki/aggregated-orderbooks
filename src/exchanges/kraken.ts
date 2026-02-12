import { ExchangeFeed } from './base'
import type { BookChange, BookPriceLevel, Exchange } from '../types'

export class KrakenFeed extends ExchangeFeed {
  readonly exchange: Exchange = 'kraken'
  protected readonly wssUrl = 'wss://ws.kraken.com'

  protected mapToSubscribeMessages(symbols: string[]) {
    return [
      {
        event: 'subscribe',
        pair: symbols,
        subscription: { name: 'book', depth: 500 },
      },
    ]
  }

  protected messageIsError(msg: any): boolean {
    if (Array.isArray(msg)) return false
    return msg.errorMessage !== undefined
  }

  protected mapMessage(msg: any): BookChange | undefined {
    if (!Array.isArray(msg)) return undefined

    const channelName = msg[msg.length - 2] as string
    if (!channelName?.startsWith?.('book')) return undefined

    const symbol = msg[msg.length - 1] as string

    // Snapshot: [channelID, { as: [], bs: [] }, channelName, pair]
    if (msg[1] && 'as' in msg[1]) {
      return {
        exchange: 'kraken',
        symbol,
        isSnapshot: true,
        bids: mapLevels(msg[1].bs),
        asks: mapLevels(msg[1].as),
        timestamp: getTimestamp(msg[1].bs, msg[1].as),
      }
    }

    // Delta: bids and asks can be in msg[1] and/or msg[2] in any order
    // Possible formats:
    //   [channelID, {a: [...]}, channelName, pair]
    //   [channelID, {b: [...]}, channelName, pair]
    //   [channelID, {a: [...]}, {b: [...]}, channelName, pair]
    //   [channelID, {b: [...]}, {a: [...]}, channelName, pair]
    const bids: BookPriceLevel[] = []
    const asks: BookPriceLevel[] = []

    // Check msg[1] and msg[2] for both 'a' and 'b'
    for (let i = 1; i < msg.length - 2; i++) {
      const part = msg[i]
      if (!part || typeof part !== 'object') continue
      if ('a' in part) asks.push(...mapLevels(part.a))
      if ('b' in part) bids.push(...mapLevels(part.b))
    }

    if (bids.length === 0 && asks.length === 0) return undefined

    return {
      exchange: 'kraken',
      symbol,
      isSnapshot: false,
      bids,
      asks,
      timestamp: new Date(),
    }
  }
}

type KrakenLevel = [string, string, string] // [price, amount, timestamp]

function mapLevels(levels: KrakenLevel[]): BookPriceLevel[] {
  if (!levels) return []
  return levels.map(([price, amount]) => ({
    price: Number(price),
    amount: Number(amount),
  }))
}

function getTimestamp(bids: any[], asks: any[]): Date {
  const allTimestamps = [
    ...(bids || []).map((l: any) => Number(l[2] ?? 0)),
    ...(asks || []).map((l: any) => Number(l[2] ?? 0)),
  ]
  const max = Math.max(...allTimestamps, 0)
  return max > 0 ? new Date(max * 1000) : new Date()
}
