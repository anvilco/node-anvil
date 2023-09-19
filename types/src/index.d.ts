export default Anvil;
export type AnvilOptions = {
    apiKey?: string;
    accessToken?: string;
    baseURL?: string;
    userAgent?: string;
    requestLimit?: number;
    requestLimitMS?: number;
};
export type GraphQLResponse = {
    statusCode: number;
    data?: GraphQLResponseData;
    errors?: Array<ResponseError>;
};
export type GraphQLResponseData = {
    data: {
        [key: string]: any;
    };
};
export type RESTResponse = {
    statusCode: number;
    data?: Buffer | Stream | any;
    errors?: Array<ResponseError>;
    /**
     * node-fetch Response
     */
    response?: any;
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
     * @param {AnvilOptions?} options
     */
    constructor(options: AnvilOptions | null);
    options: {
        apiKey?: string;
        accessToken?: string;
        baseURL: string;
        userAgent: string;
        requestLimit: number;
        requestLimitMS: number;
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
     * @returns {Promise<{url?: string, errors?: Array<ResponseError>, statusCode: number}>}
     */
    generateEtchSignUrl({ variables }: {
        variables: any;
    }): Promise<{
        url?: string;
        errors?: Array<ResponseError>;
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
    _request(...args: any[]): any;
    /**
     * @param {string} url
     * @param {Object} options
     * @returns {Promise}
     * @private
     */
    private __request;
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
}
declare namespace Anvil {
    export { UploadWithOptions };
    export { VERSION_LATEST };
    export { VERSION_LATEST_PUBLISHED };
}
import { Stream } from 'stream';
import { RateLimiter } from 'limiter';
import UploadWithOptions from './UploadWithOptions';
declare const VERSION_LATEST: -1;
declare const VERSION_LATEST_PUBLISHED: -2;
//# sourceMappingURL=index.d.ts.map