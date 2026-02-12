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
}

/**
 * Merges multiple exchange orderbooks into a single aggregated book.
 * Same price → sum amounts, track which exchange contributed what.
 */
export function aggregate(
  orderbooks: OrderBook[],
  depth: number = 25
): AggregatedBook {
  const readyBooks = orderbooks.filter((ob) => ob.ready)

  return {
    bids: mergeSide(
      readyBooks.map((ob) => ({ exchange: ob.exchange, levels: ob.topBids(depth * 2) })),
      depth,
      'desc'
    ),
    asks: mergeSide(
      readyBooks.map((ob) => ({ exchange: ob.exchange, levels: ob.topAsks(depth * 2) })),
      depth,
      'asc'
    ),
  }
}

type ExchangeLevels = {
  exchange: Exchange
  levels: BookPriceLevel[]
}

function mergeSide(
  sources: ExchangeLevels[],
  depth: number,
  direction: 'asc' | 'desc'
): AggregatedLevel[] {
  // Collect all levels with exchange attribution
  const priceMap = new Map<number, { amount: number; exchanges: { exchange: Exchange; amount: number }[] }>()

  for (const { exchange, levels } of sources) {
    for (const { price, amount } of levels) {
      const existing = priceMap.get(price)
      if (existing) {
        existing.amount += amount
        existing.exchanges.push({ exchange, amount })
      } else {
        priceMap.set(price, {
          amount,
          exchanges: [{ exchange, amount }],
        })
      }
    }
  }

  // Sort and take top N
  const sorted = Array.from(priceMap.entries())
    .map(([price, data]) => ({ price, ...data }))
    .sort((a, b) =>
      direction === 'desc' ? b.price - a.price : a.price - b.price
    )

  return sorted.slice(0, depth)
}
