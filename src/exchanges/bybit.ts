import { ExchangeFeed } from './base'
import type { BookChange, BookPriceLevel, Exchange } from '../types'

export class BybitFeed extends ExchangeFeed {
  readonly exchange: Exchange = 'bybit'
  protected readonly wssUrl = 'wss://stream.bybit.com/v5/public/linear'

  private pingTimer?: Timer

  protected mapToSubscribeMessages(symbols: string[]) {
    return [
      {
        op: 'subscribe',
        args: symbols.map((s) => `orderbook.500.${s}`),
      },
    ]
  }

  protected messageIsError(msg: any): boolean {
    if (msg.op === 'subscribe') return !msg.success
    if (msg.op === 'pong') return false
    if (msg.topic === undefined) return true
    return false
  }

  protected onConnected() {
    // Bybit requires a ping every 20s to keep the connection alive
    this.pingTimer = setInterval(() => {
      this.ws?.send(JSON.stringify({ op: 'ping' }))
    }, 20000)
  }

  stop() {
    if (this.pingTimer) {
      clearInterval(this.pingTimer)
      this.pingTimer = undefined
    }
    super.stop()
  }

  protected mapMessage(msg: any): BookChange | undefined {
    if (!msg.topic?.startsWith('orderbook.')) return undefined

    const data = msg.data
    const symbol = data.s
    const isSnapshot = msg.type === 'snapshot'

    return {
      exchange: 'bybit',
      symbol,
      isSnapshot,
      bids: mapLevels(data.b),
      asks: mapLevels(data.a),
      timestamp: new Date(msg.ts),
    }
  }
}

function mapLevels(levels: [string, string][]): BookPriceLevel[] {
  return levels.map(([price, size]) => ({
    price: Number(price),
    amount: Number(size),
  }))
}
