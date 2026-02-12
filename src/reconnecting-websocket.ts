export type ConnectionState = 'connecting' | 'connected' | 'disconnected'

interface Options {
  connectionTimeout?: number
  maxReconnectionDelay?: number
  minReconnectionDelay?: number
  maxRetries?: number
}

const DEFAULTS: Required<Options> = {
  connectionTimeout: 4000,
  maxReconnectionDelay: 10000,
  minReconnectionDelay: 3000,
  maxRetries: Infinity,
}

export class ReconnectingWebSocket {
  private ws?: WebSocket
  private retryCount = 0
  private shouldReconnect = true
  private connectTimeout?: Timer
  private messageQueue: string[] = []
  private opts: Required<Options>

  public onopen?: () => void
  public onclose?: () => void
  public onmessage?: (event: MessageEvent) => void
  public onerror?: (error: Event) => void

  constructor(
    private urlProvider: string | (() => string),
    options: Options = {}
  ) {
    this.opts = { ...DEFAULTS, ...options }
    this.connect()
  }

  get readyState(): number {
    return this.ws?.readyState ?? WebSocket.CONNECTING
  }

  send(data: string) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(data)
    } else {
      this.messageQueue.push(data)
    }
  }

  close() {
    this.shouldReconnect = false
    clearTimeout(this.connectTimeout)
    this.ws?.close()
  }

  reconnect() {
    this.shouldReconnect = true
    this.retryCount = 0
    this.ws?.close()
  }

  private getUrl(): string {
    return typeof this.urlProvider === 'function'
      ? this.urlProvider()
      : this.urlProvider
  }

  private getDelay(): number {
    if (this.retryCount === 0) return 0
    const delay =
      this.opts.minReconnectionDelay * Math.pow(1.3, this.retryCount - 1)
    return Math.min(delay, this.opts.maxReconnectionDelay)
  }

  private connect() {
    if (!this.shouldReconnect) return
    if (this.retryCount >= this.opts.maxRetries) return

    const delay = this.getDelay()
    this.retryCount++

    setTimeout(() => {
      if (!this.shouldReconnect) return

      const url = this.getUrl()
      this.ws = new WebSocket(url)

      this.connectTimeout = setTimeout(() => {
        this.ws?.close()
      }, this.opts.connectionTimeout)

      this.ws.onopen = () => {
        clearTimeout(this.connectTimeout)
        this.retryCount = 0

        // flush queued messages
        for (const msg of this.messageQueue) {
          this.ws!.send(msg)
        }
        this.messageQueue = []

        this.onopen?.()
      }

      this.ws.onclose = () => {
        clearTimeout(this.connectTimeout)
        this.onclose?.()
        if (this.shouldReconnect) {
          this.connect()
        }
      }

      this.ws.onmessage = (event) => {
        this.onmessage?.(event)
      }

      this.ws.onerror = (error) => {
        this.onerror?.(error)
      }
    }, delay)
  }
}
