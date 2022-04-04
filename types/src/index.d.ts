export = Anvil;
declare class Anvil {
    /**
     * Perform some handy/necessary things for a GraphQL file upload to make it work
     * with this client and with our backend
     *
     * @param  {string|Buffer} pathOrStreamLikeThing - Either a string path to a file,
     *   a Buffer, or a Stream-like thing that is compatible with form-data as an append.
     * @param  {object} formDataAppendOptions - User can specify options to be passed to the form-data.append
     *   call. This should be done if a stream-like thing is not one of the common types that
     *   form-data can figure out on its own.
     *
     * @return {UploadWithOptions} - A class that wraps the stream-like-thing and any options
     *   up together nicely in a way that we can also tell that it was us who did it.
     */
    static prepareGraphQLFile(pathOrStreamLikeThing: string | Buffer, formDataAppendOptions: object): UploadWithOptions;
    /**
     * @param {AnvilOptions?} options
     */
    constructor(options: AnvilOptions | null);
    options: {
        baseURL: string;
        userAgent: string;
        requestLimit: number;
        requestLimitMS: number;
        apiKey: string;
        accessToken: string;
    };
    authHeader: string;
    hasSetLimiterFromResponse: boolean;
    limiterSettingInProgress: boolean;
    rateLimiterSetupPromise: Promise<any>;
    rateLimiterPromiseResolver: (value: any) => void;
    /**
     * @param {Object} options
     * @param {number} options.tokens
     * @param {number} options.intervalMs
     * @private
     */
    private _setRateLimiter;
    limitTokens: any;
    limitIntervalMs: number;
    limiter: RateLimiter;
    /**
     * Runs the createEtchPacket mutation.
     * @param {Object} data
     * @param {Object} data.variables
     * @param {string} data.responseQuery
     * @param {any} data.mutation
     * @returns {Promise<{data: *, errors: *, statusCode: *}>}
     */
    createEtchPacket({ variables, responseQuery, mutation }: {
        variables: any;
        responseQuery: string;
        mutation: any;
    }): Promise<{
        data: any;
        errors: any;
        statusCode: any;
    }>;
    /**
     * @param {string} documentGroupEid
     * @param {Object?} clientOptions
     * @returns {Promise<{data: *, response: *, errors: *, statusCode: *}>}
     */
    downloadDocuments(documentGroupEid: string, clientOptions?: any | null): Promise<{
        data: any;
        response: any;
        errors: any;
        statusCode: any;
    }>;
    /**
     * @param {string} pdfTemplateID
     * @param {Object} payload
     * @param {Object?} clientOptions
     * @returns {Promise<{data: *, response: *, errors: *, statusCode: *}>}
     */
    fillPDF(pdfTemplateID: string, payload: any, clientOptions?: any | null): Promise<{
        data: any;
        response: any;
        errors: any;
        statusCode: any;
    }>;
    /**
     * @param {Object} data
     * @param {Object} data.variables
     * @param {string} data.responseQuery
     * @param {any} data.mutation
     * @returns {Promise<{data: *, errors: *, statusCode: *}>}
     */
    forgeSubmit({ variables, responseQuery, mutation }: {
        variables: any;
        responseQuery: string;
        mutation: any;
    }): Promise<{
        data: any;
        errors: any;
        statusCode: any;
    }>;
    /**
     * @param {Object} payload
     * @param {Object?} clientOptions
     * @returns {Promise<{data: *, response: *, errors: *, statusCode: *}>}
     */
    generatePDF(payload: any, clientOptions?: any | null): Promise<{
        data: any;
        response: any;
        errors: any;
        statusCode: any;
    }>;
    /**
     * @param {Object} data
     * @param {Object} data.variables
     * @param {string} data.responseQuery
     * @returns {Promise<{data: *, errors: *, statusCode: *}>}
     */
    getEtchPacket({ variables, responseQuery }: {
        variables: any;
        responseQuery: string;
    }): Promise<{
        data: any;
        errors: any;
        statusCode: any;
    }>;
    /**
     * @param {Object} data
     * @param {Object} data.variables
     * @returns {Promise<{url: (*|string), errors: *, statusCode: *}>}
     */
    generateEtchSignUrl({ variables }: {
        variables: any;
    }): Promise<{
        url: (any | string);
        errors: any;
        statusCode: any;
    }>;
    /**
     * @param {Object} data
     * @param {Object} data.variables
     * @param {any} data.mutation
     * @returns {Promise<{data: *, errors: *, statusCode: *}>}
     */
    removeWeldData({ variables, mutation }: {
        variables: any;
        mutation: any;
    }): Promise<{
        data: any;
        errors: any;
        statusCode: any;
    }>;
    /**
     * @param {Object} data
     * @param {any} data.query
     * @param {Object} data.variables
     * @param {Object} clientOptions
     * @returns {Promise<{data: *, errors: *, statusCode: *}>}
     */
    requestGraphQL({ query, variables }: {
        query: any;
        variables: any;
    }, clientOptions: any): Promise<{
        data: any;
        errors: any;
        statusCode: any;
    }>;
    /**
     * @param {string} url
     * @param {Object} fetchOptions
     * @param {Object} clientOptions
     * @returns {Promise<{data: *, response: *, errors: *, statusCode: *}>}
     */
    requestREST(url: string, fetchOptions: any, clientOptions: any): Promise<{
        data: any;
        response: any;
        errors: any;
        statusCode: any;
    }>;
    /**
     * @param {string} url
     * @param {Object} options
     * @returns {Promise}
     * @private
     */
    private _request;
    /**
     * @param {CallableFunction} retryableRequestFn
     * @param {Object?} clientOptions
     * @returns {Promise<*>}
     * @private
     */
    private _wrapRequest;
    /**
     * @param {string} path
     * @returns {string}
     * @private
     */
    private _url;
    /**
     * @param {Object} headerObject
     * @param {Object} headerObject.options
     * @param {Object} headerObject.headers
     * @param {Object?} internalOptions
     * @returns {*&{headers: {}}}
     * @private
     */
    private _addHeaders;
    /**
     * @param {Object} options
     * @returns {*}
     * @private
     */
    private _addDefaultHeaders;
    /**
     * @param {CallableFunction} fn
     * @returns {Promise<*>}
     * @private
     */
    private _throttle;
}
declare namespace Anvil {
    export { AnvilOptions };
}
import { RateLimiter } from "limiter/dist/cjs/RateLimiter";
import UploadWithOptions = require("./UploadWithOptions");
type AnvilOptions = {
    baseURL: string | null;
    userAgent: string | null;
    requestLimit: number | null;
    requestLimitMS: number | null;
    apiKey: string | null;
    accessToken: string | null;
};
//# sourceMappingURL=index.d.ts.map