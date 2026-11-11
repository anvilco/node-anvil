// Keeps requests within the API's rate limit, and says how long to wait before retrying
// those that weren't.
//
// The API counts requests over a sliding window: at most `X-RateLimit-Limit` requests in
// any `X-RateLimit-Interval-Ms`. The limiter counts the same way, so it only holds a
// request back when the limit has been reached, and never delays requests within it.
//
// The API counts a request from the moment it arrives, which the client can't see. It
// is somewhere between when the request was sent and when the response came back, so a
// request counts here from when it is sent until an interval after its response. That
// way the API never counts more requests in its window than the client counted in its
// own, whatever the latency.
//
// Every response carries those headers, so the client's first request goes out alone,
// and the limits in its response become the limits for every request after it. Requests
// made in the meantime wait for that first response.
//
// The API's limit is per account, so every client in the process with the same base URL
// and credentials shares one limiter (`sharedLimiter`), and with it the limits the first
// response taught. Separate processes can't share one; each learns the limits for itself.
import { createHash } from 'crypto'
import { performance } from 'perf_hooks'

// Until the first response says what the account's rate limit is, this many requests
// per interval
export const DEFAULT_REQUEST_LIMIT = 1
export const DEFAULT_REQUEST_LIMIT_MS = 1000

// Added to every wait for the rate limit, and to a 429's Retry-After, to allow for
// requests that were sent further apart than they arrive
export const RETRY_BUFFER_MS = 50
// How long to wait before retrying a 429 that has no usable Retry-After header, and the
// most a Retry-After header can make the client wait
export const DEFAULT_RETRY_AFTER_MS = 1000
export const MAX_RETRY_AFTER_MS = 60000

// How many times to retry a request that failed with one of these statuses or couldn't
// connect, and the backoff before the first retry, doubled each time: 100ms, 200ms,
// 400ms, 800ms, 1.6s. A request that was sent but got no complete response (a timeout, a
// connection dropped mid-response) is not retried: the API may have processed it.
export const DEFAULT_MAX_RETRIES = 5
export const RETRY_STATUSES = Object.freeze([500, 502, 503, 504])
export const RETRY_BACKOFF_MS = 100

export const LIMIT_HEADER = 'x-ratelimit-limit'
export const INTERVAL_HEADER = 'x-ratelimit-interval-ms'
export const RETRY_AFTER_HEADER = 'retry-after'

/**
 * A sliding window rate limiter that learns its limits from the API.
 */
export class RateLimiter {
  /**
   * @param {Object} [options]
   * @param {number} [options.limit] Requests per interval until the API says otherwise
   * @param {number} [options.intervalMs]
   */
  constructor ({ limit, intervalMs } = {}) {
    // Resolved and replaced whenever the limiter's state changes, to wake waiting requests
    this._change = newChange()
    // Fall back to 1 request per second if the starting limits are invalid
    this.limit = DEFAULT_REQUEST_LIMIT
    this.intervalMs = DEFAULT_REQUEST_LIMIT_MS
    this.setLimits(limit, intervalMs)

    // How many requests are out now, and when the responses of recent ones arrived,
    // oldest first. A request counts from when it is sent until an interval after its
    // response.
    this.inFlight = 0
    /** @type {number[]} */
    this.finishedAt = []
    // Whether the limits have been set from an API response. Until they have, every
    // response is checked for the headers.
    this.hasSetFromResponse = false
    // Whether the first response has arrived, whatever it carried. Until it has, only
    // the request whose response it will be may go.
    this.gateOpen = false
    this.settingInProgress = false
    /** @type {(value?: any) => void} */
    this._resolveSetup = () => {}
    this.setupPromise = new Promise((resolve) => {
      this._resolveSetup = resolve
    })
  }

  /**
   * Set the limits, if both are positive numbers. Returns whether they were.
   * @param {any} limit
   * @param {any} intervalMs
   * @returns {boolean}
   */
  setLimits (limit, intervalMs) {
    limit = positiveInt(limit)
    intervalMs = positiveInt(intervalMs)
    if (limit === undefined || intervalMs === undefined) {
      return false
    }
    // Requests already sent still count against the new limits
    this.limit = limit
    this.intervalMs = intervalMs
    this._notify()
    return true
  }

  /**
   * Set the limits from a response's rate limit headers.
   *
   * The first response, whatever it carries, lets the requests waiting on it go. The
   * limits are taken from the first response that has them: a response from a proxy, or
   * an error served before the API's rate limit middleware, doesn't fix the client at
   * its starting limits for good.
   * @param {{ get: (name: string) => any } | Object} headers
   */
  updateFromHeaders (headers) {
    this._openGate()
    if (this.hasSetFromResponse) {
      return
    }
    if (this.setLimits(header(headers, LIMIT_HEADER), header(headers, INTERVAL_HEADER))) {
      this.hasSetFromResponse = true
    }
  }

  /**
   * Wait until a request may be sent: for the first response, if it hasn't arrived, and
   * then until another request would keep us within `limit` requests in any
   * `intervalMs`, counting the ones out now and those whose response arrived within the
   * last interval. Takes a slot, which `finish` gives back.
   * @returns {Promise<void>}
   */
  async acquire () {
    // Until the first response has arrived, only the request whose response it will be may go
    while (this.settingInProgress && !this.gateOpen) {
      await this._change.promise
    }
    if (!this.gateOpen) {
      this.settingInProgress = true
    }

    for (;;) {
      // Not Date.now(), so that changes to the system clock can't hold requests up
      const now = performance.now()
      // Responses that arrived before this no longer count. The buffer allows for the
      // API's clock and the client's ticking apart.
      const windowStart = now - this.intervalMs - RETRY_BUFFER_MS
      while (this.finishedAt.length && this.finishedAt[0] <= windowStart) {
        this.finishedAt.shift()
      }

      if (this.inFlight + this.finishedAt.length < this.limit) {
        this.inFlight++
        return
      }

      if (this.finishedAt.length) {
        // Wait for the oldest response to leave the window, or for the limits to change
        await Promise.race([sleep(this.finishedAt[0] - windowStart), this._change.promise])
      } else {
        // Every slot is a request still out; a response will wake us
        await this._change.promise
      }
    }
  }

  /**
   * A request's response arrived, or it failed: it counts for another interval.
   */
  finish () {
    this.inFlight--
    this.finishedAt.push(performance.now())
    this._notify()
  }

  /**
   * The request whose response was to set the limits failed without one. Let the next
   * waiting request be the first instead.
   */
  releaseSetupGate () {
    if (!this.gateOpen) {
      this.settingInProgress = false
      this._notify()
    }
  }

  _openGate () {
    if (!this.gateOpen) {
      this.gateOpen = true
      this.settingInProgress = false
      this._resolveSetup()
      this._notify()
    }
  }

  // Wakes everything waiting on the limiter's state
  _notify () {
    const { resolve } = this._change
    this._change = newChange()
    resolve()
  }
}

function newChange () {
  /** @type {(value?: any) => void} */
  let resolve = () => {}
  const promise = new Promise((_resolve) => { resolve = _resolve })
  return { promise, resolve }
}

// Keyed on a hash of the credentials, not the credentials, and holding each limiter only
// as long as a client does: a service that makes a client per OAuth token must not keep
// every token it has ever seen.
/** @type {Map<string, WeakRef<RateLimiter>>} */
const shared = new Map()
const forgotten = new FinalizationRegistry((key) => {
  const ref = shared.get(key)
  if (ref && !ref.deref()) {
    shared.delete(key)
  }
})

/**
 * The limiter every client with this base URL and credentials shares.
 *
 * The starting limits only apply when this makes the limiter, i.e. for the first
 * client; after that the limits come from the API anyway. A limiter lives as long as a
 * client holds it; the next client made after the last one is gone learns the limits
 * again from its first response.
 * @param {string} baseURL
 * @param {string} authHeader
 * @param {number} [limit]
 * @param {number} [intervalMs]
 * @returns {RateLimiter}
 */
export function sharedLimiter (baseURL, authHeader, limit, intervalMs) {
  const key = `${baseURL}\n${createHash('sha256').update(authHeader).digest('hex')}`
  let limiter = shared.get(key)?.deref()
  if (!limiter) {
    limiter = new RateLimiter({ limit, intervalMs })
    shared.set(key, new WeakRef(limiter))
    forgotten.register(limiter, key)
  }
  return limiter
}

/**
 * A Retry-After header as milliseconds, capped, or undefined if it isn't a number of
 * seconds. The header may also be an HTTP date, which isn't honored. A cap, because the
 * header is the server's to set, and a proxy's mistake shouldn't hold a request for an hour.
 * @param {any} retryAfter
 * @returns {number | undefined}
 */
export function parseRetryAfterMs (retryAfter) {
  const seconds = Math.abs(parseFloat(retryAfter))
  if (!Number.isFinite(seconds)) {
    return undefined
  }
  return Math.min(Math.round(seconds * 1000), MAX_RETRY_AFTER_MS)
}

/**
 * How long to wait before retrying a 429: its Retry-After plus the buffer. Without a
 * usable Retry-After, a second: retrying every 50ms would hammer a server that is already
 * turning requests away.
 * @param {any} retryAfter
 * @returns {number}
 */
export function retryDelayMs (retryAfter) {
  return (parseRetryAfterMs(retryAfter) ?? DEFAULT_RETRY_AFTER_MS) + RETRY_BUFFER_MS
}

/**
 * How long to wait before retry number `attempt + 1` of a request that failed with a
 * 5xx or couldn't connect: the response's Retry-After, or exponential backoff.
 * @param {number} attempt
 * @param {any} [retryAfter]
 * @returns {number}
 */
export function backoffMs (attempt, retryAfter) {
  return parseRetryAfterMs(retryAfter) ?? RETRY_BACKOFF_MS * 2 ** attempt
}

// A fetch Headers object, or a plain object
function header (headers, name) {
  if (!headers) {
    return undefined
  }
  if (typeof headers.get === 'function') {
    return headers.get(name)
  }
  const key = Object.keys(headers).find((k) => k.toLowerCase() === name)
  return key === undefined ? undefined : headers[key]
}

function positiveInt (value) {
  const number = parseInt(value)
  return number > 0 ? number : undefined
}

function sleep (ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}
