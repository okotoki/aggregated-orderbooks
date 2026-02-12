import type { Market, Coin } from './types'

export const MARKETS: Market[] = [
  // BTC
  { exchange: 'binance', symbol: 'btcusdt', coin: 'BTC' },
  { exchange: 'coinbase', symbol: 'BTC-USD', coin: 'BTC' },
  { exchange: 'kraken', symbol: 'XBT/USD', coin: 'BTC' },
  { exchange: 'bitstamp', symbol: 'btcusd', coin: 'BTC' },

  // ETH
  { exchange: 'binance', symbol: 'ethusdt', coin: 'ETH' },
  { exchange: 'coinbase', symbol: 'ETH-USD', coin: 'ETH' },
  { exchange: 'kraken', symbol: 'ETH/USD', coin: 'ETH' },
  { exchange: 'bitstamp', symbol: 'ethusd', coin: 'ETH' },

  // SOL
  { exchange: 'binance', symbol: 'solusdt', coin: 'SOL' },
  { exchange: 'coinbase', symbol: 'SOL-USD', coin: 'SOL' },
  { exchange: 'kraken', symbol: 'SOL/USD', coin: 'SOL' },
  { exchange: 'bitstamp', symbol: 'solusd', coin: 'SOL' },
]

export const COINS: Coin[] = ['BTC', 'ETH', 'SOL']

export function getMarketsForCoin(coin: Coin): Market[] {
  return MARKETS.filter((m) => m.coin === coin)
}
