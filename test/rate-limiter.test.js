import {
  RateLimiter,
  backoffMs,
  parseRetryAfterMs,
  retryDelayMs,
  sharedLimiter,
} from '../src/rate-limiter'

const tick = () => new Promise((resolve) => setImmediate(resolve))

describe('RateLimiter', function () {
  describe('limits', function () {
    it('starts at 1 request per second when the starting limits are invalid', function () {
      expect(new RateLimiter({ limit: 0, intervalMs: -5 })).to.include({ limit: 1, intervalMs: 1000 })
      expect(new RateLimiter({ limit: 'x', intervalMs: 500 })).to.include({ limit: 1, intervalMs: 1000 })
      expect(new RateLimiter()).to.include({ limit: 1, intervalMs: 1000 })
    })

    it('takes valid starting limits, as numbers or strings', function () {
      expect(new RateLimiter({ limit: 5, intervalMs: 500 })).to.include({ limit: 5, intervalMs: 500 })
      expect(new RateLimiter({ limit: '7', intervalMs: '700' })).to.include({ limit: 7, intervalMs: 700 })
    })

    it('reads the limits from the first response that has them, and opens the gate on any', function () {
      const limiter = new RateLimiter({ limit: 10, intervalMs: 1000 })
      expect(limiter.gateOpen).to.eql(false)

      limiter.updateFromHeaders({ get: () => undefined })
      expect(limiter.gateOpen).to.eql(true)
      expect(limiter.hasSetFromResponse).to.eql(false)
      expect(limiter).to.include({ limit: 10, intervalMs: 1000 })

      limiter.updateFromHeaders({ 'X-RateLimit-Limit': '3', 'x-ratelimit-interval-ms': '300' })
      expect(limiter.hasSetFromResponse).to.eql(true)
      expect(limiter).to.include({ limit: 3, intervalMs: 300 })

      // Only the first response with the headers
      limiter.updateFromHeaders({ 'x-ratelimit-limit': '9', 'x-ratelimit-interval-ms': '900' })
      expect(limiter).to.include({ limit: 3, intervalMs: 300 })
    })
  })

  describe('acquire', function () {
    it('lets the first request go alone, then the rest once its response arrived', async function () {
      const limiter = new RateLimiter({ limit: 10, intervalMs: 20 })
      let secondAcquired = false

      await limiter.acquire()
      const second = limiter.acquire().then(() => { secondAcquired = true })
      await tick()
      expect(secondAcquired).to.eql(false)

      limiter.updateFromHeaders({})
      limiter.finish()
      await second
      expect(secondAcquired).to.eql(true)
    })

    it('lets the next request be the first when the first one failed without a response', async function () {
      const limiter = new RateLimiter({ limit: 10, intervalMs: 20 })
      await limiter.acquire()
      const second = limiter.acquire()

      limiter.finish()
      limiter.releaseSetupGate()
      await second

      expect(limiter.gateOpen).to.eql(false)
      expect(limiter.settingInProgress).to.eql(true)
    })

    it('counts requests in flight and those finished within the interval', async function () {
      const limiter = new RateLimiter({ limit: 2, intervalMs: 30 })
      limiter.updateFromHeaders({})

      await limiter.acquire()
      await limiter.acquire()
      let thirdAcquired = false
      const third = limiter.acquire().then(() => { thirdAcquired = true })
      await tick()
      expect(thirdAcquired).to.eql(false)

      // A response arrived: it still counts for an interval (plus the 50ms buffer)
      limiter.finish()
      await tick()
      expect(thirdAcquired).to.eql(false)

      await third
      expect(thirdAcquired).to.eql(true)
      expect(limiter.inFlight).to.eql(2)
    })

    it('wakes waiting requests when the limits are raised', async function () {
      const limiter = new RateLimiter({ limit: 1, intervalMs: 60000 })
      limiter.updateFromHeaders({})
      await limiter.acquire()
      let secondAcquired = false
      const second = limiter.acquire().then(() => { secondAcquired = true })
      await tick()
      expect(secondAcquired).to.eql(false)

      limiter.setLimits(2, 60000)
      await second
      expect(secondAcquired).to.eql(true)
    })
  })

  describe('sharedLimiter', function () {
    it('gives clients with the same base URL and credentials the same limiter', function () {
      const a = sharedLimiter('https://app.useanvil.com', 'Basic abc', 5, 500)
      expect(sharedLimiter('https://app.useanvil.com', 'Basic abc', 1, 1000)).to.equal(a)
      // The starting limits are the first client's
      expect(a).to.include({ limit: 5, intervalMs: 500 })
      expect(sharedLimiter('https://app.useanvil.com', 'Basic xyz')).to.not.equal(a)
      expect(sharedLimiter('https://staging.example.com', 'Basic abc')).to.not.equal(a)
    })
  })

  describe('delays', function () {
    it('parses retry-after seconds, capped at a minute', function () {
      expect(parseRetryAfterMs('0.3')).to.eql(300)
      expect(parseRetryAfterMs('2')).to.eql(2000)
      expect(parseRetryAfterMs(2)).to.eql(2000)
      expect(parseRetryAfterMs('-1')).to.eql(1000)
      expect(parseRetryAfterMs('3600')).to.eql(60000)
      expect(parseRetryAfterMs('Infinity')).to.be.undefined
      expect(parseRetryAfterMs('Wed, 21 Oct 2026 07:28:00 GMT')).to.be.undefined
      expect(parseRetryAfterMs(undefined)).to.be.undefined
      expect(parseRetryAfterMs(null)).to.be.undefined
    })

    it('waits retry-after plus the buffer after a 429, or a second without one', function () {
      expect(retryDelayMs('0.3')).to.eql(350)
      expect(retryDelayMs(undefined)).to.eql(1050)
      expect(retryDelayMs('nope')).to.eql(1050)
      expect(retryDelayMs('3600')).to.eql(60050)
    })

    it('backs off exponentially from 100ms, unless the response says when', function () {
      expect([0, 1, 2, 3, 4].map((attempt) => backoffMs(attempt))).to.eql([100, 200, 400, 800, 1600])
      expect(backoffMs(3, '0.5')).to.eql(500)
      expect(backoffMs(3, 'soon')).to.eql(800)
    })
  })
})
