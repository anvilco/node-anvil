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
    constructor(options: any);
    options: any;
    authHeader: string;
    hasSetLimiterFromResponse: boolean;
    limiterSettingInProgress: boolean;
    rateLimiterSetupPromise: Promise<any>;
    rateLimiterPromiseResolver: (value: any) => void;
    _setRateLimiter({ tokens, intervalMs }: {
        tokens: any;
        intervalMs: any;
    }): void;
    limitTokens: any;
    limitIntervalMs: any;
    limiter: RateLimiter;
    createEtchPacket({ variables, responseQuery, mutation }: {
        variables: any;
        responseQuery: any;
        mutation: any;
    }): Promise<{
        statusCode: any;
        data: any;
        errors: any;
    }>;
    downloadDocuments(documentGroupEid: any, clientOptions?: {}): Promise<{
        response: any;
        statusCode: any;
        data: any;
        errors: any;
    }>;
    fillPDF(pdfTemplateID: any, payload: any, clientOptions?: {}): Promise<{
        response: any;
        statusCode: any;
        data: any;
        errors: any;
    }>;
    forgeSubmit({ variables, responseQuery, mutation }: {
        variables: any;
        responseQuery: any;
        mutation: any;
    }): Promise<{
        statusCode: any;
        data: any;
        errors: any;
    }>;
    generatePDF(payload: any, clientOptions?: {}): Promise<{
        response: any;
        statusCode: any;
        data: any;
        errors: any;
    }>;
    getEtchPacket({ variables, responseQuery }: {
        variables: any;
        responseQuery: any;
    }): Promise<{
        statusCode: any;
        data: any;
        errors: any;
    }>;
    generateEtchSignUrl({ variables }: {
        variables: any;
    }): Promise<{
        statusCode: any;
        url: any;
        errors: any;
    }>;
    removeWeldData({ variables, mutation }: {
        variables: any;
        mutation: any;
    }): Promise<{
        statusCode: any;
        data: any;
        errors: any;
    }>;
    requestGraphQL({ query, variables }: {
        query: any;
        variables?: {};
    }, clientOptions: any): Promise<{
        statusCode: any;
        data: any;
        errors: any;
    }>;
    requestREST(url: any, fetchOptions: any, clientOptions: any): Promise<{
        response: any;
        statusCode: any;
        data: any;
        errors: any;
    }>;
    _request(url: any, options: any): any;
    _wrapRequest(retryableRequestFn: any, clientOptions?: {}): Promise<any>;
    _url(path: any): any;
    _addHeaders({ options: existingOptions, headers: newHeaders }: {
        options: any;
        headers: any;
    }, internalOptions?: {}): any;
    _addDefaultHeaders(options: any): any;
    _throttle(fn: any): Promise<any>;
}
import { RateLimiter } from "limiter/dist/cjs/RateLimiter";
import UploadWithOptions = require("./UploadWithOptions");
//# sourceMappingURL=index.d.ts.map