import type { Market, Coin, MarketType } from './types'

export const MARKETS: Market[] = [
  // === SPOT ===

  // BTC — all USDT for consistent pricing
  { exchange: 'binance', symbol: 'btcusdt', coin: 'BTC', marketType: 'spot' },
  { exchange: 'coinbase', symbol: 'BTC-USD', coin: 'BTC', marketType: 'spot' },
  { exchange: 'kraken', symbol: 'XBT/USD', coin: 'BTC', marketType: 'spot' },
  { exchange: 'bitstamp', symbol: 'btcusdt', coin: 'BTC', marketType: 'spot' },

  // ETH
  { exchange: 'binance', symbol: 'ethusdt', coin: 'ETH', marketType: 'spot' },
  { exchange: 'coinbase', symbol: 'ETH-USDT', coin: 'ETH', marketType: 'spot' },
  { exchange: 'kraken', symbol: 'ETH/USDT', coin: 'ETH', marketType: 'spot' },
  { exchange: 'bitstamp', symbol: 'ethusdt', coin: 'ETH', marketType: 'spot' },

  // SOL (bitstamp has no SOL/USDT, use USD — close enough for demo)
  { exchange: 'binance', symbol: 'solusdt', coin: 'SOL', marketType: 'spot' },
  { exchange: 'coinbase', symbol: 'SOL-USDT', coin: 'SOL', marketType: 'spot' },
  { exchange: 'kraken', symbol: 'SOL/USDT', coin: 'SOL', marketType: 'spot' },
  { exchange: 'bitstamp', symbol: 'solusd', coin: 'SOL', marketType: 'spot' },

  // === PERPS ===

  // BTC perps
  { exchange: 'binance-futures', symbol: 'btcusdt', coin: 'BTC', marketType: 'perp' },
  { exchange: 'bybit', symbol: 'BTCUSDT', coin: 'BTC', marketType: 'perp' },
  { exchange: 'bitmex', symbol: 'XBTUSD', coin: 'BTC', marketType: 'perp' },

  // ETH perps
  { exchange: 'binance-futures', symbol: 'ethusdt', coin: 'ETH', marketType: 'perp' },
  { exchange: 'bybit', symbol: 'ETHUSDT', coin: 'ETH', marketType: 'perp' },
  { exchange: 'bitmex', symbol: 'ETHUSD', coin: 'ETH', marketType: 'perp' },

  // SOL perps
  { exchange: 'binance-futures', symbol: 'solusdt', coin: 'SOL', marketType: 'perp' },
  { exchange: 'bybit', symbol: 'SOLUSDT', coin: 'SOL', marketType: 'perp' },
  { exchange: 'bitmex', symbol: 'SOLUSD', coin: 'SOL', marketType: 'perp' },
]

export const COINS: Coin[] = ['BTC', 'ETH', 'SOL']

export const MARKET_TYPES: MarketType[] = ['spot', 'perp']

export function getMarketsForCoin(coin: Coin, marketType: MarketType = 'spot'): Market[] {
  return MARKETS.filter((m) => m.coin === coin && m.marketType === marketType)
}
