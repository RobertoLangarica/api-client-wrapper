import { AxiosRequestConfig, AxiosResponse } from 'axios';
import RequestObject, { RequestOptions } from './RequestObject';
export interface APIWrapperOptions extends AxiosRequestConfig {
    maxAttemptsPerCall?: number;
    baseURL?: string;
    contentType?: string;
    timeout?: number;
    authorization?: string;
    simultaneousCalls?: number;
}
export interface APIWrapperResponse extends AxiosResponse {
    success?: boolean;
    attempts?: number;
    data: any;
    error?: any;
    error_info?: string;
    alias?: string;
}
export declare class APIWrapper {
    maxAttemptsPerCall: number;
    baseURL: string;
    private _timeout;
    simultaneousCalls: number;
    axiosInstance: any;
    pendingRequests: RequestObject[];
    bulkRequests: RequestObject[];
    executingRequests: RequestObject[];
    store: any;
    uploading: boolean;
    downloading: boolean;
    working: boolean;
    constructor(options?: APIWrapperOptions);
    set timeout(value: number);
    get timeout(): number;
    createResponse(options?: APIWrapperResponse): APIWrapperResponse;
    commit(commitCmd: string, value: any): void;
    get(path?: string, conf?: RequestOptions): Promise<(resolve: (result: any) => void, reject: (arg: any) => void) => void> | Promise<APIWrapperResponse>;
    bulkGet(requests?: string[] | RequestOptions[], continueWithFailure?: boolean, onProgress?: {
        (progress: number): void;
    } | null): Promise<(resolve: (result: any) => void, reject: (arg: any) => void) => void> | Promise<APIWrapperResponse>;
    post(path?: string, data?: any, conf?: RequestOptions): Promise<(resolve: (result: any) => void, reject: (arg: any) => void) => void> | Promise<APIWrapperResponse>;
    bulkPost(requests?: string[] | Object[], continueWithFailure?: boolean, onProgress?: {
        (progress: number): void;
    } | null): Promise<(resolve: (result: any) => void, reject: (arg: any) => void) => void> | Promise<APIWrapperResponse>;
    patch(path?: string, data?: any, conf?: RequestOptions): Promise<(resolve: (result: any) => void, reject: (arg: any) => void) => void> | Promise<APIWrapperResponse>;
    bulkPatch(requests?: string[] | Object[], continueWithFailure?: boolean, onProgress?: {
        (progress: number): void;
    } | null): Promise<(resolve: (result: any) => void, reject: (arg: any) => void) => void> | Promise<APIWrapperResponse>;
    put(path?: string, data?: any, conf?: RequestOptions): Promise<(resolve: (result: any) => void, reject: (arg: any) => void) => void> | Promise<APIWrapperResponse>;
    bulkPut(requests?: string[] | Object[], continueWithFailure?: boolean, onProgress?: {
        (progress: number): void;
    } | null): Promise<(resolve: (result: any) => void, reject: (arg: any) => void) => void> | Promise<APIWrapperResponse>;
    delete(path?: string, conf?: RequestOptions): Promise<(resolve: (result: any) => void, reject: (arg: any) => void) => void> | Promise<APIWrapperResponse>;
    bulkDelete(requests?: string[] | Object[], continueWithFailure?: boolean, onProgress?: {
        (progress: number): void;
    } | null): Promise<(resolve: (result: any) => void, reject: (arg: any) => void) => void> | Promise<APIWrapperResponse>;
    bulkDecorator(requests: string[] | RequestOptions[] | undefined, continueWithFailure: boolean | undefined, onProgress: ((progress: number) => void) | null | undefined, method: string): Promise<(resolve: (result: any) => void, reject: (arg: any) => void) => void> | Promise<APIWrapperResponse>;
    private call;
    private bulkCall;
    getBulkRequestById(id: string): RequestObject | undefined;
    getRequestObject(config: RequestOptions): RequestObject;
    executeNextRequest(): void;
    evaluateRemoteResponse(requestId: string, remoteResult: any): void;
    evaluateRemoteError(requestId: string, error: any): void;
    requestCompletion(request: RequestObject, result: APIWrapperResponse): void;
    evaluateBulkCompletion(requestId: string): void;
    updateWorkingStatus(): void;
    removeRequestFromLists(id: string): void;
    setContentType(type: string): void;
    setAuthorization(token: string, type?: string): void;
    getComputedPath(path: string): string;
    setStore(store: any): void;
}
declare const _default: APIWrapper;
export default _default;
