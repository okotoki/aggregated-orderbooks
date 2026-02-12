import type { Market, Coin } from './types'

export const MARKETS: Market[] = [
  // BTC — all USDT for consistent pricing
  { exchange: 'binance', symbol: 'btcusdt', coin: 'BTC' },
  { exchange: 'coinbase', symbol: 'BTC-USDT', coin: 'BTC' },
  { exchange: 'kraken', symbol: 'XBT/USDT', coin: 'BTC' },
  { exchange: 'bitstamp', symbol: 'btcusdt', coin: 'BTC' },

  // ETH
  { exchange: 'binance', symbol: 'ethusdt', coin: 'ETH' },
  { exchange: 'coinbase', symbol: 'ETH-USDT', coin: 'ETH' },
  { exchange: 'kraken', symbol: 'ETH/USDT', coin: 'ETH' },
  { exchange: 'bitstamp', symbol: 'ethusdt', coin: 'ETH' },

  // SOL (bitstamp has no SOL/USDT, use USD — close enough for demo)
  { exchange: 'binance', symbol: 'solusdt', coin: 'SOL' },
  { exchange: 'coinbase', symbol: 'SOL-USDT', coin: 'SOL' },
  { exchange: 'kraken', symbol: 'SOL/USDT', coin: 'SOL' },
  { exchange: 'bitstamp', symbol: 'solusd', coin: 'SOL' },
]

export const COINS: Coin[] = ['BTC', 'ETH', 'SOL']

export function getMarketsForCoin(coin: Coin): Market[] {
  return MARKETS.filter((m) => m.coin === coin)
}
