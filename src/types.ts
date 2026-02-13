export type Exchange = 'binance' | 'coinbase' | 'kraken' | 'bitstamp' | 'binance-futures' | 'bybit' | 'bitmex'

export type Coin = 'BTC' | 'ETH' | 'SOL'

export type MarketType = 'spot' | 'perp'

export type BookPriceLevel = {
  price: number
  amount: number
}

export type BookChange = {
  exchange: Exchange
  symbol: string
  isSnapshot: boolean
  bids: BookPriceLevel[]
  asks: BookPriceLevel[]
  timestamp: Date
}

export type Market = {
  exchange: Exchange
  symbol: string
  coin: Coin
  marketType: MarketType
}
