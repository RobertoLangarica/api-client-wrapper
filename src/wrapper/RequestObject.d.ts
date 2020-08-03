import { AxiosRequestConfig } from 'axios';
import { APIWrapperResponse } from './APIWrapper';
export interface RequestOptions extends AxiosRequestConfig {
    method?: "get" | "GET" | "delete" | "DELETE" | "head" | "HEAD" | "options" | "OPTIONS" | "post" | "POST" | "put" | "PUT" | "patch" | "PATCH" | "link" | "LINK" | "unlink" | "UNLINK" | undefined;
    url?: string;
    attempts?: number;
    params?: any;
    data?: any;
    alias?: string;
    continueWithFailure?: boolean;
    onProgress?: {
        (progress: number): void;
    } | null;
}
export declare enum RequestStatus {
    WAITING = 0,
    EXECUTING = 1,
    COMPLETED = 2,
    FAILED = 3
}
declare class RequestObject {
    maxAttempts: number;
    attempts: number;
    result: APIWrapperResponse;
    alias?: string;
    continueWithFailure: boolean;
    onProgress: {
        (progress: number): void;
    } | undefined | null;
    progress: number;
    url: string;
    method: string;
    data: any;
    params: object;
    config: RequestOptions;
    id: string;
    mainPromise: Promise<{
        (resolve: (result: any) => void, reject: (arg: any) => void): void;
    }>;
    resolvePromise?: (result: any) => void;
    rejectPromise?: (result: any) => void;
    isSubRequest: boolean;
    status: RequestStatus;
    subRequests: RequestObject[];
    parentId?: string;
    constructor(options?: RequestOptions);
    addSubRequest(request: RequestObject): void;
    getSubrequestsPayload(): Map<string, {}>;
    updateStatusBySubRequests(): void;
    updateSubrequestsProgress(): void;
    promiseResolver(resolve: {
        (value: any): void;
    }, reject: {
        (reason: any): void;
    }): void;
    resolve(remoteResult: APIWrapperResponse): void;
}
export default RequestObject;
