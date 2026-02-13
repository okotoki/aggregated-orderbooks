import type { Exchange } from '../types'
import type { ExchangeFeed } from './base'
import { BinanceFeed } from './binance'
import { BinanceFuturesFeed } from './binance-futures'
import { BitstampFeed } from './bitstamp'
import { BitMEXFeed } from './bitmex'
import { BybitFeed } from './bybit'
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
    case 'binance-futures':
      return new BinanceFuturesFeed()
    case 'bybit':
      return new BybitFeed()
    case 'bitmex':
      return new BitMEXFeed()
  }
}

export { BinanceFeed, BinanceFuturesFeed, BitstampFeed, BitMEXFeed, BybitFeed, CoinbaseFeed, KrakenFeed }
