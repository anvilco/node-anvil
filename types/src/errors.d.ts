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
//# sourceMappingURL=errors.d.ts.map