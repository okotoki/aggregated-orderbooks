import { expect, test } from 'bun:test'
import { aggregate } from './aggregator'
import { OrderBook } from './orderbook'
import type { BookPriceLevel, Exchange } from './types'

function makeBook(exchange: Exchange, bids: BookPriceLevel[], asks: BookPriceLevel[]) {
  const book = new OrderBook(exchange, 'BTC-USDT')
  book.apply({
    exchange,
    symbol: 'BTC-USDT',
    isSnapshot: true,
    bids,
    asks,
    timestamp: new Date('2026-01-01T00:00:00Z'),
  })
  return book
}

test('grouped aggregation does not show ask levels inside the bid side', () => {
  const book = makeBook(
    'binance',
    [
      { price: 78615, amount: 1 },
      { price: 78605, amount: 1 },
      { price: 78595, amount: 1 },
    ],
    [
      { price: 78591, amount: 1 },
      { price: 78601, amount: 1 },
      { price: 78611, amount: 1 },
      { price: 78621, amount: 1 },
    ]
  )

  const aggregated = aggregate([book], 10, 10)

  expect(aggregated.bids.map((level) => level.price)).toEqual([78610, 78600, 78590])
  expect(aggregated.asks.map((level) => level.price)).toEqual([78620, 78630])
  expect(
    aggregated.asks.every((ask) =>
      aggregated.bids.every((bid) => ask.price > bid.price)
    )
  ).toBe(true)
})

test('crossed ask filtering happens before depth is applied', () => {
  const book = makeBook(
    'coinbase',
    [{ price: 100, amount: 1 }],
    [
      { price: 91, amount: 1 },
      { price: 101, amount: 1 },
      { price: 111, amount: 1 },
      { price: 121, amount: 1 },
    ]
  )

  const aggregated = aggregate([book], 2, 10)

  expect(aggregated.asks.map((level) => level.price)).toEqual([110, 120])
})
