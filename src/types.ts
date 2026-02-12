export type Exchange = 'binance' | 'coinbase' | 'kraken' | 'bitstamp'

export type Coin = 'BTC' | 'ETH' | 'SOL'

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
}
