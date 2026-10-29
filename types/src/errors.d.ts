export function looksLikeJsonError({ json }: {
    json: any;
}): boolean;
export function normalizeJsonErrors({ json, statusText }: {
    json: any;
    statusText?: string;
}): any;
export function normalizeNodeError({ error, statusText }: {
    error: any;
    statusText?: string;
}): {
    name: any;
    message: any;
    code: any;
    cause: any;
    stack: any;
}[] | {
    name: string;
    message: string;
}[];
/**
 * What the client's methods reject with when the API responds with an error and
 * `throwOnError` is on. It reads the same as python-anvil's AnvilRequestError.
 */
export class AnvilRequestError extends Error {
    /**
     * @param {Object} options
     * @param {Array<import('@anvilco/types').ResponseError | import('@anvilco/types').RuntimeError>} options.errors
     *   The normalized errors, the same as a method resolves with when `throwOnError` is off
     * @param {number} [options.statusCode] The HTTP status code. GraphQL errors usually come with a 200.
     * @param {any} [options.data] Any data the API returned alongside the errors. A GraphQL
     *   response can be partially successful.
     * @param {import('undici').Response} [options.response] The fetch Response, e.g. for its headers
     */
    constructor({ errors, statusCode, data, response }: {
        errors: Array<import('@anvilco/types').ResponseError | import('@anvilco/types').RuntimeError>;
        statusCode?: number;
        data?: any;
        response?: import('undici').Response;
    });
    /** The HTTP status code. GraphQL errors usually come with a 200. */
    statusCode: number;
    /** The normalized errors, the same as a method resolves with when `throwOnError` is off */
    errors: (import("@anvilco/types").ResponseError | import("@anvilco/types").RuntimeError)[];
    /** Any data the API returned alongside the errors, e.g. a partially successful GraphQL query's */
    data: any;
    /** The fetch Response, e.g. for the rate limit headers */
    response: import("undici").Response;
}
//# sourceMappingURL=errors.d.ts.map