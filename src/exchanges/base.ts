import { ReconnectingWebSocket } from '../reconnecting-websocket'
import type { BookChange, Exchange } from '../types'

export type BookChangeCallback = (bookChange: BookChange) => void

export abstract class ExchangeFeed {
  protected ws?: ReconnectingWebSocket
  private symbols: string[] = []
  private onBookChange?: BookChangeCallback
  private staleTimer?: Timer
  private messageCount = 0

  abstract readonly exchange: Exchange
  protected abstract readonly wssUrl: string

  protected abstract mapToSubscribeMessages(symbols: string[]): any[]
  protected abstract mapMessage(msg: any): BookChange | undefined
  protected abstract messageIsError(msg: any): boolean

  start(symbols: string[], onBookChange: BookChangeCallback) {
    this.symbols = symbols
    this.onBookChange = onBookChange

    this.ws = new ReconnectingWebSocket(this.wssUrl, {
      connectionTimeout: 4000,
      minReconnectionDelay: 3000,
      maxReconnectionDelay: 10000,
    })

    this.ws.onopen = () => {
      console.log(`[${this.exchange}] connected`)
      const msgs = this.mapToSubscribeMessages(this.symbols)
      for (const msg of msgs) {
        this.ws!.send(JSON.stringify(msg))
      }
      this.onConnected()
      this.startStaleMonitor()
    }

    this.ws.onclose = () => {
      console.log(`[${this.exchange}] disconnected`)
      this.stopStaleMonitor()
    }

    this.ws.onmessage = (event) => {
      const data =
        typeof event.data === 'string' ? JSON.parse(event.data) : event.data

      if (this.messageIsError(data)) {
        console.error(`[${this.exchange}] error:`, data)
        return
      }

      this.messageCount++
      const bookChange = this.mapMessage(data)
      if (bookChange) {
        this.onBookChange?.(bookChange)
      }
    }

    this.ws.onerror = (error) => {
      console.error(`[${this.exchange}] ws error:`, error)
    }
  }

  stop() {
    this.stopStaleMonitor()
    this.ws?.close()
  }

  /** Override if exchange needs to fetch REST snapshots after connecting */
  protected onConnected() {}

  /** Emit a BookChange directly (used for injecting REST snapshots) */
  protected emit(bookChange: BookChange) {
    this.onBookChange?.(bookChange)
  }

  private startStaleMonitor() {
    this.staleTimer = setInterval(() => {
      if (this.messageCount === 0) {
        console.warn(`[${this.exchange}] stale connection, reconnecting`)
        this.ws?.reconnect()
      }
      this.messageCount = 0
    }, 15000)
  }

  private stopStaleMonitor() {
    if (this.staleTimer) {
      clearInterval(this.staleTimer)
      this.staleTimer = undefined
    }
  }
}
