import type { BookPriceLevel, Exchange } from './types'
import type { OrderBook } from './orderbook'

export type AggregatedLevel = {
  price: number
  amount: number
  exchanges: { exchange: Exchange; amount: number }[]
}

export type AggregatedBook = {
  bids: AggregatedLevel[]
  asks: AggregatedLevel[]
  grouping: number
}

/**
 * Auto-detect a reasonable grouping step based on the current price.
 * Goal: each bin covers a meaningful price range relative to the asset.
 */
export function autoGrouping(price: number): number {
  if (price <= 0) return 0.01
  if (price < 1) return 0.001
  if (price < 10) return 0.01
  if (price < 100) return 0.1
  if (price < 1000) return 1
  if (price < 10000) return 10
  if (price < 100000) return 100
  return 500
}

/**
 * Merges multiple exchange orderbooks into a single aggregated book.
 * Groups price levels into bins of `grouping` size.
 * Same bin → sum amounts, track which exchanges contributed.
 */
export function aggregate(
  orderbooks: OrderBook[],
  depth: number = 25,
  grouping?: number
): AggregatedBook {
  const readyBooks = orderbooks.filter((ob) => ob.ready)

  // Auto-detect grouping from best bid/ask if not specified
  if (grouping === undefined) {
    const bestPrices = readyBooks
      .map((ob) => {
        const bids = ob.topBids(1)
        const asks = ob.topAsks(1)
        return [...bids.map((l) => l.price), ...asks.map((l) => l.price)]
      })
      .flat()
      .filter((p) => p > 0)

    const midPrice =
      bestPrices.length > 0
        ? bestPrices.reduce((a, b) => a + b, 0) / bestPrices.length
        : 0
    grouping = autoGrouping(midPrice)
  }

  // Use all available levels — OrderBook already trims to a meaningful range.
  // With fine-grained books (Binance has $0.01 levels), a small slice would
  // only cover a few dollars, producing barely any bins at wider groupings.
  return {
    bids: mergeSide(
      readyBooks.map((ob) => ({
        exchange: ob.exchange,
        levels: ob.bids,
      })),
      depth,
      'desc',
      grouping
    ),
    asks: mergeSide(
      readyBooks.map((ob) => ({
        exchange: ob.exchange,
        levels: ob.asks,
      })),
      depth,
      'asc',
      grouping
    ),
    grouping,
  }
}

type ExchangeLevels = {
  exchange: Exchange
  levels: BookPriceLevel[]
}

/**
 * Round a price to the nearest bin.
 * For bids: floor to bin boundary (conservative — don't inflate bid price)
 * For asks: ceil to bin boundary (conservative — don't deflate ask price)
 */
function binPrice(price: number, grouping: number, direction: 'asc' | 'desc'): number {
  if (grouping <= 0) return price
  if (direction === 'desc') {
    // bids: floor
    return Math.floor(price / grouping) * grouping
  } else {
    // asks: ceil
    return Math.ceil(price / grouping) * grouping
  }
}

function mergeSide(
  sources: ExchangeLevels[],
  depth: number,
  direction: 'asc' | 'desc',
  grouping: number
): AggregatedLevel[] {
  const priceMap = new Map<
    number,
    { amount: number; exchanges: Map<Exchange, number> }
  >()

  for (const { exchange, levels } of sources) {
    for (const { price, amount } of levels) {
      if (amount === 0) continue
      const bin = binPrice(price, grouping, direction)
      const existing = priceMap.get(bin)
      if (existing) {
        existing.amount += amount
        existing.exchanges.set(
          exchange,
          (existing.exchanges.get(exchange) || 0) + amount
        )
      } else {
        const exchanges = new Map<Exchange, number>()
        exchanges.set(exchange, amount)
        priceMap.set(bin, { amount, exchanges })
      }
    }
  }

  const sorted = Array.from(priceMap.entries())
    .map(([price, data]) => ({
      price,
      amount: data.amount,
      exchanges: Array.from(data.exchanges.entries()).map(
        ([exchange, amount]) => ({ exchange, amount })
      ),
    }))
    .sort((a, b) =>
      direction === 'desc' ? b.price - a.price : a.price - b.price
    )

  return sorted.slice(0, depth)
}
