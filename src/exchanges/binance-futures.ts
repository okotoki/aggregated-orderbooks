import { BinanceFeed } from './binance'
import type { Exchange } from '../types'

export class BinanceFuturesFeed extends BinanceFeed {
  readonly exchange: Exchange = 'binance-futures'
  protected readonly wssUrl = 'wss://fstream.binance.com/stream'

  protected get restBaseUrl(): string {
    return 'https://fapi.binance.com/fapi/v1/depth'
  }

  protected get snapshotLimit(): number {
    return 1000
  }
}
