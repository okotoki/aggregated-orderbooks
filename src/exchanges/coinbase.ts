import { ExchangeFeed } from './base'
import type { BookChange, Exchange } from '../types'

export class CoinbaseFeed extends ExchangeFeed {
  readonly exchange: Exchange = 'coinbase'
  protected readonly wssUrl = 'wss://ws-feed.exchange.coinbase.com'

  protected mapToSubscribeMessages(symbols: string[]) {
    return [
      {
        type: 'subscribe',
        channels: [{ name: 'level2_batch', product_ids: symbols }],
      },
    ]
  }

  protected messageIsError(msg: any): boolean {
    return msg.type === 'error'
  }

  protected mapMessage(msg: any): BookChange | undefined {
    if (msg.type === 'snapshot') {
      return {
        exchange: 'coinbase',
        symbol: msg.product_id,
        isSnapshot: true,
        bids: msg.bids.map(([price, amount]: [string, string]) => ({
          price: Number(price),
          amount: Number(amount),
        })),
        asks: msg.asks.map(([price, amount]: [string, string]) => ({
          price: Number(price),
          amount: Number(amount),
        })),
        timestamp: new Date(),
      }
    }

    if (msg.type === 'l2update') {
      const bids: { price: number; amount: number }[] = []
      const asks: { price: number; amount: number }[] = []

      for (const [side, price, amount] of msg.changes) {
        const level = { price: Number(price), amount: Number(amount) }
        if (side === 'buy') bids.push(level)
        else asks.push(level)
      }

      return {
        exchange: 'coinbase',
        symbol: msg.product_id,
        isSnapshot: false,
        bids,
        asks,
        timestamp: new Date(msg.time),
      }
    }
  }
}
