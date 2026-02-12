import type { Exchange } from '../types'
import type { ExchangeFeed } from './base'
import { BinanceFeed } from './binance'
import { BitstampFeed } from './bitstamp'
import { CoinbaseFeed } from './coinbase'
import { KrakenFeed } from './kraken'

export function createFeed(exchange: Exchange): ExchangeFeed {
  switch (exchange) {
    case 'binance':
      return new BinanceFeed()
    case 'coinbase':
      return new CoinbaseFeed()
    case 'kraken':
      return new KrakenFeed()
    case 'bitstamp':
      return new BitstampFeed()
  }
}

export { BinanceFeed, BitstampFeed, CoinbaseFeed, KrakenFeed }
