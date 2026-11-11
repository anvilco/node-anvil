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
export function sharedLimiter(baseURL: string, authHeader: string, limit?: number, intervalMs?: number): RateLimiter;
/**
 * A Retry-After header as milliseconds, capped, or undefined if it isn't a number of
 * seconds. The header may also be an HTTP date, which isn't honored. A cap, because the
 * header is the server's to set, and a proxy's mistake shouldn't hold a request for an hour.
 * @param {any} retryAfter
 * @returns {number | undefined}
 */
export function parseRetryAfterMs(retryAfter: any): number | undefined;
/**
 * How long to wait before retrying a 429: its Retry-After plus the buffer. Without a
 * usable Retry-After, a second: retrying every 50ms would hammer a server that is already
 * turning requests away.
 * @param {any} retryAfter
 * @returns {number}
 */
export function retryDelayMs(retryAfter: any): number;
/**
 * How long to wait before retry number `attempt + 1` of a request that failed with a
 * 5xx or couldn't connect: the response's Retry-After, or exponential backoff.
 * @param {number} attempt
 * @param {any} [retryAfter]
 * @returns {number}
 */
export function backoffMs(attempt: number, retryAfter?: any): number;
export const DEFAULT_REQUEST_LIMIT: 1;
export const DEFAULT_REQUEST_LIMIT_MS: 1000;
export const RETRY_BUFFER_MS: 50;
export const DEFAULT_RETRY_AFTER_MS: 1000;
export const MAX_RETRY_AFTER_MS: 60000;
export const DEFAULT_MAX_RETRIES: 5;
export const RETRY_STATUSES: readonly number[];
export const RETRY_BACKOFF_MS: 100;
export const LIMIT_HEADER: "x-ratelimit-limit";
export const INTERVAL_HEADER: "x-ratelimit-interval-ms";
export const RETRY_AFTER_HEADER: "retry-after";
/**
 * A sliding window rate limiter that learns its limits from the API.
 */
export class RateLimiter {
    /**
     * @param {Object} [options]
     * @param {number} [options.limit] Requests per interval until the API says otherwise
     * @param {number} [options.intervalMs]
     */
    constructor({ limit, intervalMs }?: {
        limit?: number;
        intervalMs?: number;
    });
    _change: {
        promise: Promise<any>;
        resolve: (value?: any) => void;
    };
    limit: number;
    intervalMs: number;
    inFlight: number;
    /** @type {number[]} */
    finishedAt: number[];
    hasSetFromResponse: boolean;
    gateOpen: boolean;
    settingInProgress: boolean;
    /** @type {(value?: any) => void} */
    _resolveSetup: (value?: any) => void;
    setupPromise: Promise<any>;
    /**
     * Set the limits, if both are positive numbers. Returns whether they were.
     * @param {any} limit
     * @param {any} intervalMs
     * @returns {boolean}
     */
    setLimits(limit: any, intervalMs: any): boolean;
    /**
     * Set the limits from a response's rate limit headers.
     *
     * The first response, whatever it carries, lets the requests waiting on it go. The
     * limits are taken from the first response that has them: a response from a proxy, or
     * an error served before the API's rate limit middleware, doesn't fix the client at
     * its starting limits for good.
     * @param {{ get: (name: string) => any } | Object} headers
     */
    updateFromHeaders(headers: any): void;
    /**
     * Wait until a request may be sent: for the first response, if it hasn't arrived, and
     * then until another request would keep us within `limit` requests in any
     * `intervalMs`, counting the ones out now and those whose response arrived within the
     * last interval. Takes a slot, which `finish` gives back.
     * @returns {Promise<void>}
     */
    acquire(): Promise<void>;
    /**
     * A request's response arrived, or it failed: it counts for another interval.
     */
    finish(): void;
    /**
     * The request whose response was to set the limits failed without one. Let the next
     * waiting request be the first instead.
     */
    releaseSetupGate(): void;
    _openGate(): void;
    _notify(): void;
}
