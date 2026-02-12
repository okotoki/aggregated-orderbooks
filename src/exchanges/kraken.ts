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
    if ('as' in msg[1]) {
      return {
        exchange: 'kraken',
        symbol,
        isSnapshot: true,
        bids: mapLevels(msg[1].bs),
        asks: mapLevels(msg[1].as),
        timestamp: getTimestamp(msg[1].bs, msg[1].as),
      }
    }

    // Delta: bids and asks may be in separate objects or combined
    const asks: BookPriceLevel[] = 'a' in msg[1] ? mapLevels(msg[1].a) : []
    const bids: BookPriceLevel[] = []

    if ('b' in msg[1]) {
      bids.push(...mapLevels(msg[1].b))
    } else if (msg[2] && typeof msg[2] !== 'string' && 'b' in msg[2]) {
      bids.push(...mapLevels(msg[2].b))
    }

    return {
      exchange: 'kraken',
      symbol,
      isSnapshot: false,
      bids,
      asks,
      timestamp: getTimestamp(bids.length ? msg[1].b || msg[2]?.b : [], asks.length ? msg[1].a || [] : []),
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
