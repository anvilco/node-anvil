/// <reference types="node" />
export default Anvil;
/**
 * `baseUrl` is another spelling of `baseURL`. `dispatcher` is an undici dispatcher to send
 * requests with, e.g. a ProxyAgent; it defaults to an Agent of the client's own.
 */
export type AnvilOptions = import('@anvilco/types').AnvilOptions & {
    baseUrl?: string;
    dispatcher?: import('undici').Dispatcher;
};
export type GraphQLResponse = import('@anvilco/types').GraphQLResponse<GraphQLResponseData>;
/**
 * The body of a GraphQL response: the query's result under `data`
 */
export type GraphQLResponseData = {
    data: {
        [key: string]: any;
    };
};
/**
 * `data` is a Buffer, ArrayBuffer, Node stream or parsed JSON, depending on the request's
 * `dataType`. `response` is the fetch Response.
 */
export type RESTResponse = import('@anvilco/types').RESTResponse<any> & {
    response?: import('undici').Response;
};
export type NodeError = import('@anvilco/types').RuntimeError;
export type ResponseError = import('@anvilco/types').ResponseError;
export type ResponseErrorField = import('@anvilco/types').ResponseErrorField;
export type WithOptionalOutputFormat<T> = Omit<T, 'outputFormat'> & {
    outputFormat?: 'pdf' | 'url';
};
export type FillPdfPayload = WithOptionalOutputFormat<import('@anvilco/types').FillPdfPayload>;
export type GeneratePdfPayload = WithOptionalOutputFormat<import('@anvilco/types').components['schemas']['GenerateMarkdownPdfRequest']> | WithOptionalOutputFormat<import('@anvilco/types').components['schemas']['GenerateHtmlPdfRequest']>;
/**
 * Options for a request
 */
export type ClientOptions = {
    /**
     * What `data` to resolve with
     */
    dataType?: 'json' | 'buffer' | 'arrayBuffer' | 'stream';
    /**
     * Log problems parsing responses
     */
    debug?: boolean;
};
/**
 * A file to upload: a path, a Buffer, a stream, a Blob or File, the result of
 * prepareGraphQLFile, or one of the API's other forms of the Upload scalar
 */
export type FileInput = string | Buffer | Stream | Blob | File | UploadWithOptions | import('@anvilco/types').GraphQL.Scalars['Upload'];
/**
 * A file in an Etch packet: the API's EtchFile, with `file` accepting what prepareGraphQLFile does
 */
export type EtchFile = Omit<import('@anvilco/types').GraphQL.Type<'EtchFile'>, 'file'> & {
    file?: FileInput | null;
};
/**
 * A signer in createEtchPacket's `signers`
 */
export type EtchSigner = import('@anvilco/types').EtchSigner;
export type EtchSignaturePageOptions = import('@anvilco/types').EtchSignaturePageOptions;
export type EtchFinishPageOptions = import('@anvilco/types').EtchFinishPageOptions;
export type CreateEtchPacketVariables = Omit<import('@anvilco/types').CreateEtchPacketArgs, 'files'> & {
    files?: Array<EtchFile> | null;
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
     * @param {CreateEtchPacketVariables} data.variables
     * @param {string} [data.responseQuery]
     * @param {string} [data.mutation] Your own mutation. Its variables may differ from the
     *   API's createEtchPacket arguments, so cast them if TypeScript objects.
     * @returns {Promise<GraphQLResponse>}
     */
    createEtchPacket({ variables, responseQuery, mutation }: {
        variables: CreateEtchPacketVariables;
        responseQuery?: string;
        mutation?: string;
    }): Promise<GraphQLResponse>;
    /**
     * @param {string} documentGroupEid
     * @param {ClientOptions} [clientOptions]
     * @returns {Promise<RESTResponse>}
     */
    downloadDocuments(documentGroupEid: string, clientOptions?: ClientOptions): Promise<RESTResponse>;
    /**
     * @param {string} pdfTemplateID
     * @param {FillPdfPayload} payload
     * @param {ClientOptions & { versionNumber?: import('@anvilco/types').FillPdfVersionNumber }} [clientOptions]
     * @returns {Promise<RESTResponse>}
     */
    fillPDF(pdfTemplateID: string, payload: FillPdfPayload, clientOptions?: ClientOptions & {
        versionNumber?: import('@anvilco/types').FillPdfVersionNumber;
    }): Promise<RESTResponse>;
    /**
     * @param {Object} data
     * @param {import('@anvilco/types').GraphQL.MutationArgs<'forgeSubmit'>} data.variables
     * @param {string} [data.responseQuery]
     * @param {string} [data.mutation] Your own mutation; cast `variables` if they differ
     * @returns {Promise<GraphQLResponse>}
     */
    forgeSubmit({ variables, responseQuery, mutation }: {
        variables: import('@anvilco/types').GraphQL.MutationArgs<'forgeSubmit'>;
        responseQuery?: string;
        mutation?: string;
    }): Promise<GraphQLResponse>;
    /**
     * @param {GeneratePdfPayload} payload
     * @param {ClientOptions} [clientOptions]
     * @returns {Promise<RESTResponse>}
     */
    generatePDF(payload: GeneratePdfPayload, clientOptions?: ClientOptions): Promise<RESTResponse>;
    /**
     * @param {Object} data
     * @param {import('@anvilco/types').GraphQL.QueryArgs<'etchPacket'>} data.variables
     * @param {string} [data.responseQuery]
     * @returns {Promise<GraphQLResponse>}
     */
    getEtchPacket({ variables, responseQuery }: {
        variables: import('@anvilco/types').GraphQL.QueryArgs<'etchPacket'>;
        responseQuery?: string;
    }): Promise<GraphQLResponse>;
    /**
     * @param {Object} data
     * @param {import('@anvilco/types').GraphQL.MutationArgs<'generateEtchSignURL'>} data.variables
     * @returns {Promise<{url?: string, errors?: Array<ResponseError | NodeError>, statusCode: number}>}
     */
    generateEtchSignUrl({ variables }: {
        variables: import('@anvilco/types').GraphQL.MutationArgs<'generateEtchSignURL'>;
    }): Promise<{
        url?: string;
        errors?: Array<ResponseError | NodeError>;
        statusCode: number;
    }>;
    /**
     * @param {Object} data
     * @param {import('@anvilco/types').GraphQL.MutationArgs<'removeWeldData'>} data.variables
     * @param {string} [data.mutation] Your own mutation; cast `variables` if they differ
     * @returns {Promise<GraphQLResponse>}
     */
    removeWeldData({ variables, mutation }: {
        variables: import('@anvilco/types').GraphQL.MutationArgs<'removeWeldData'>;
        mutation?: string;
    }): Promise<GraphQLResponse>;
    /**
     * @param {Object} data
     * @param {string} data.query
     * @param {Record<string, any>} [data.variables] Files to upload can be anywhere in here
     * @param {ClientOptions} [clientOptions]
     * @returns {Promise<GraphQLResponse>}
     */
    requestGraphQL({ query, variables }: {
        query: string;
        variables?: Record<string, any>;
    }, clientOptions?: ClientOptions): Promise<GraphQLResponse>;
    /**
     * @param {string} url
     * @param {import('undici').RequestInit} fetchOptions
     * @param {ClientOptions} [clientOptions]
     * @returns {Promise<RESTResponse>}
     */
    requestREST(url: string, fetchOptions: import('undici').RequestInit, clientOptions?: ClientOptions): Promise<RESTResponse>;
    /**
     * The same as fillPDF.
     * @param {Parameters<Anvil['fillPDF']>} args
     * @returns {ReturnType<Anvil['fillPDF']>}
     */
    fillPdf(pdfTemplateID: string, payload: FillPdfPayload, clientOptions?: ClientOptions & {
        versionNumber?: import('@anvilco/types').FillPdfVersionNumber;
    }): ReturnType<Anvil['fillPDF']>;
    /**
     * The same as generatePDF.
     * @param {Parameters<Anvil['generatePDF']>} args
     * @returns {ReturnType<Anvil['generatePDF']>}
     */
    generatePdf(payload: GeneratePdfPayload, clientOptions?: ClientOptions): ReturnType<Anvil['generatePDF']>;
    /**
     * The same as generateEtchSignUrl, spelled like the API's generateEtchSignURL mutation.
     * @param {Parameters<Anvil['generateEtchSignUrl']>} args
     * @returns {ReturnType<Anvil['generateEtchSignUrl']>}
     */
    generateEtchSignURL(args_0: {
        variables: import('@anvilco/types').GraphQL.MutationArgs<'generateEtchSignURL'>;
    }): ReturnType<Anvil['generateEtchSignUrl']>;
    /**
     * The same as requestGraphQL.
     * @param {Parameters<Anvil['requestGraphQL']>} args
     * @returns {ReturnType<Anvil['requestGraphQL']>}
     */
    requestGraphql(args_0: {
        query: string;
        variables?: Record<string, any>;
    }, clientOptions?: ClientOptions): ReturnType<Anvil['requestGraphQL']>;
    /**
     * The same as requestGraphQL.
     * @param {Parameters<Anvil['requestGraphQL']>} args
     * @returns {ReturnType<Anvil['requestGraphQL']>}
     */
    requestGraphQl(args_0: {
        query: string;
        variables?: Record<string, any>;
    }, clientOptions?: ClientOptions): ReturnType<Anvil['requestGraphQL']>;
    /**
     * The same as requestREST.
     * @param {Parameters<Anvil['requestREST']>} args
     * @returns {ReturnType<Anvil['requestREST']>}
     */
    requestRest(url: string, fetchOptions: import("undici").RequestInit, clientOptions?: ClientOptions): ReturnType<Anvil['requestREST']>;
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
import { File } from 'buffer';
import UploadWithOptions from './UploadWithOptions';
declare namespace defaultOptions {
    let baseURL: string;
    let userAgent: string;
}
declare const VERSION_LATEST: -1;
declare const VERSION_LATEST_PUBLISHED: -2;
//# sourceMappingURL=index.d.ts.map