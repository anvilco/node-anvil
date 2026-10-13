/// <reference types="node" />
export default Anvil;
export type AnvilOptions = {
    apiKey?: string;
    accessToken?: string;
    baseURL?: string;
    /**
     * Another spelling of baseURL
     */
    baseUrl?: string;
    userAgent?: string;
    requestLimit?: number;
    requestLimitMS?: number;
    /**
     * An undici dispatcher to send requests
     * with, e.g. a ProxyAgent. Defaults to an Agent of the client's own.
     */
    dispatcher?: import('undici').Dispatcher;
};
export type GraphQLResponse = {
    statusCode: number;
    data?: GraphQLResponseData;
    errors?: Array<ResponseError | NodeError>;
};
export type GraphQLResponseData = {
    data: {
        [key: string]: any;
    };
};
export type RESTResponse = {
    statusCode: number;
    data?: Buffer | ArrayBuffer | Stream | any;
    errors?: Array<ResponseError | NodeError>;
    /**
     * The fetch Response
     */
    response?: import('undici').Response;
};
export type NodeError = {
    name: string;
    message: string;
    stack: string;
    code: string;
    cause?: any;
};
export type ResponseError = {
    [key: string]: any;
    message: string;
    status?: number;
    name?: string;
    fields?: Array<ResponseErrorField>;
};
export type ResponseErrorField = {
    [key: string]: any;
    message: string;
    property?: string;
};
export type Readable = {
    path: string;
};
declare class Anvil {
    /**
     * Perform some handy/necessary things for a GraphQL file upload to make it work
     * with this client and with our backend
     *
     * @param  {string|Buffer|Readable|File|Blob} pathOrStreamLikeThing - Either a string path to a file,
     *   a Buffer, or a Stream-like thing that is compatible with form-data as an append.
     * @param  {Object} [formDataAppendOptions] - User can specify options to be passed to the form-data.append
     *   call. This should be done if a stream-like thing is not one of the common types that
     *   form-data can figure out on its own.
     *
     * @return {UploadWithOptions} - A class that wraps the stream-like-thing and any options
     *   up together nicely in a way that we can also tell that it was us who did it.
     */
    static prepareGraphQLFile(pathOrStreamLikeThing: string | Buffer | Readable | File | Blob, { ignoreFilenameValidation, ...formDataAppendOptions }?: any): UploadWithOptions;
    /**
     * The same as prepareGraphQLFile. See "Method names" in the README.
     * @param {Parameters<typeof Anvil.prepareGraphQLFile>} args
     * @returns {ReturnType<typeof Anvil.prepareGraphQLFile>}
     */
    static prepareGraphqlFile(pathOrStreamLikeThing: string | Blob | Buffer | File | Readable, args_1?: any): ReturnType<typeof Anvil.prepareGraphQLFile>;
    /**
     * The same as prepareGraphQLFile. See "Method names" in the README.
     * @param {Parameters<typeof Anvil.prepareGraphQLFile>} args
     * @returns {ReturnType<typeof Anvil.prepareGraphQLFile>}
     */
    static prepareGraphQlFile(pathOrStreamLikeThing: string | Blob | Buffer | File | Readable, args_1?: any): ReturnType<typeof Anvil.prepareGraphQLFile>;
    /**
     * @param {AnvilOptions?} options
     */
    constructor(options: AnvilOptions | null);
    /** @type {AnvilOptions & typeof defaultOptions & { requestLimit: number, requestLimitMS: number }} */
    options: AnvilOptions & typeof defaultOptions & {
        requestLimit: number;
        requestLimitMS: number;
    };
    authHeader: string;
    hasSetLimiterFromResponse: boolean;
    limiterSettingInProgress: boolean;
    rateLimiterSetupPromise: Promise<any>;
    rateLimiterPromiseResolver: (value: any) => void;
    /** @type {number[]} */
    requestTimes: number[];
    limitTokens: number;
    limitIntervalMs: number;
    /**
     * @param {Object} options
     * @param {number} options.tokens
     * @param {number} options.intervalMs
     * @private
     */
    private _setRateLimiter;
    /**
     * Runs the createEtchPacket mutation.
     * @param {Object} data
     * @param {Object} data.variables
     * @param {string} [data.responseQuery]
     * @param {string} [data.mutation]
     * @returns {Promise<GraphQLResponse>}
     */
    createEtchPacket({ variables, responseQuery, mutation }: {
        variables: any;
        responseQuery?: string;
        mutation?: string;
    }): Promise<GraphQLResponse>;
    /**
     * @param {string} documentGroupEid
     * @param {Object} [clientOptions]
     * @returns {Promise<RESTResponse>}
     */
    downloadDocuments(documentGroupEid: string, clientOptions?: any): Promise<RESTResponse>;
    /**
     * @param {string} pdfTemplateID
     * @param {Object} payload
     * @param {Object} [clientOptions]
     * @returns {Promise<RESTResponse>}
     */
    fillPDF(pdfTemplateID: string, payload: any, clientOptions?: any): Promise<RESTResponse>;
    /**
     * @param {Object} data
     * @param {Object} data.variables
     * @param {string} [data.responseQuery]
     * @param {string} [data.mutation]
     * @returns {Promise<GraphQLResponse>}
     */
    forgeSubmit({ variables, responseQuery, mutation }: {
        variables: any;
        responseQuery?: string;
        mutation?: string;
    }): Promise<GraphQLResponse>;
    /**
     * @param {Object} payload
     * @param {Object} [clientOptions]
     * @returns {Promise<RESTResponse>}
     */
    generatePDF(payload: any, clientOptions?: any): Promise<RESTResponse>;
    /**
     * @param {Object} data
     * @param {Object} data.variables
     * @param {string} [data.responseQuery]
     * @returns {Promise<GraphQLResponse>}
     */
    getEtchPacket({ variables, responseQuery }: {
        variables: any;
        responseQuery?: string;
    }): Promise<GraphQLResponse>;
    /**
     * @param {Object} data
     * @param {Object} data.variables
     * @returns {Promise<{url?: string, errors?: Array<ResponseError | NodeError>, statusCode: number}>}
     */
    generateEtchSignUrl({ variables }: {
        variables: any;
    }): Promise<{
        url?: string;
        errors?: Array<ResponseError | NodeError>;
        statusCode: number;
    }>;
    /**
     * @param {Object} data
     * @param {Object} data.variables
     * @param {string} [data.mutation]
     * @returns {Promise<GraphQLResponse>}
     */
    removeWeldData({ variables, mutation }: {
        variables: any;
        mutation?: string;
    }): Promise<GraphQLResponse>;
    /**
     * @param {Object} data
     * @param {string} data.query
     * @param {Object} [data.variables]
     * @param {Object} [clientOptions]
     * @returns {Promise<GraphQLResponse>}
     */
    requestGraphQL({ query, variables }: {
        query: string;
        variables?: any;
    }, clientOptions?: any): Promise<GraphQLResponse>;
    /**
     * @param {string} url
     * @param {Object} fetchOptions
     * @param {Object} [clientOptions]
     * @returns {Promise<RESTResponse>}
     */
    requestREST(url: string, fetchOptions: any, clientOptions?: any): Promise<RESTResponse>;
    /**
     * The same as fillPDF.
     * @param {Parameters<Anvil['fillPDF']>} args
     * @returns {ReturnType<Anvil['fillPDF']>}
     */
    fillPdf(pdfTemplateID: string, payload: any, clientOptions?: any): ReturnType<Anvil['fillPDF']>;
    /**
     * The same as generatePDF.
     * @param {Parameters<Anvil['generatePDF']>} args
     * @returns {ReturnType<Anvil['generatePDF']>}
     */
    generatePdf(payload: any, clientOptions?: any): ReturnType<Anvil['generatePDF']>;
    /**
     * The same as generateEtchSignUrl, spelled like the API's generateEtchSignURL mutation.
     * @param {Parameters<Anvil['generateEtchSignUrl']>} args
     * @returns {ReturnType<Anvil['generateEtchSignUrl']>}
     */
    generateEtchSignURL(args_0: {
        variables: any;
    }): ReturnType<Anvil['generateEtchSignUrl']>;
    /**
     * The same as requestGraphQL.
     * @param {Parameters<Anvil['requestGraphQL']>} args
     * @returns {ReturnType<Anvil['requestGraphQL']>}
     */
    requestGraphql(args_0: {
        query: string;
        variables?: any;
    }, clientOptions?: any): ReturnType<Anvil['requestGraphQL']>;
    /**
     * The same as requestGraphQL.
     * @param {Parameters<Anvil['requestGraphQL']>} args
     * @returns {ReturnType<Anvil['requestGraphQL']>}
     */
    requestGraphQl(args_0: {
        query: string;
        variables?: any;
    }, clientOptions?: any): ReturnType<Anvil['requestGraphQL']>;
    /**
     * The same as requestREST.
     * @param {Parameters<Anvil['requestREST']>} args
     * @returns {ReturnType<Anvil['requestREST']>}
     */
    requestRest(url: string, fetchOptions: any, clientOptions?: any): ReturnType<Anvil['requestREST']>;
    /**
     * @param {string} url
     * @param {Object} options
     * @returns {Promise<import('undici').Response>}
     * @private
     */
    private _request;
    /**
     * @param {CallableFunction} retryableRequestFn
     * @param {Object} [clientOptions]
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
     * @param {Object} [internalOptions]
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
    /**
     * Waits until another request would keep us within limitTokens requests in any
     * limitIntervalMs. The API counts requests the same way, over a sliding window, so
     * this avoids 429s without holding back requests that are within the limit.
     * @returns {Promise<void>}
     * @private
     */
    private _waitForRateLimit;
}
declare namespace Anvil {
    export { UploadWithOptions };
    export { VERSION_LATEST };
    export { VERSION_LATEST_PUBLISHED };
}
import { Stream } from 'stream';
declare namespace defaultOptions {
    let baseURL: string;
    let userAgent: string;
}
import { File } from 'buffer';
import UploadWithOptions from './UploadWithOptions';
declare const VERSION_LATEST: -1;
declare const VERSION_LATEST_PUBLISHED: -2;
//# sourceMappingURL=index.d.ts.map