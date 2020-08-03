import { AxiosRequestConfig } from 'axios'
import { v4 as uuidv4 } from 'uuid'
import { APIWrapperResponse } from './APIWrapper'

/**
 * Supports also any other property of axios config
 */
export interface RequestOptions extends AxiosRequestConfig {
    /**
     * Attemps that the request should made before failing permanently
     * 
     * Default: 1
     */
    attempts?: number

    /**
     * The data to be sent in the request body
     */
    data?: any

    /**
     * A custom alias that will be part of the response for better identification
     */
    alias?: string

    /**
     * When this request is a bulk call, meaning it is composed by more tahn one request.
     * If true: Indicates that all the requests should be tried before declaring a failure
     * If false: Declare a failure after one request fail
     * 
     * Default: false
     */
    continueWithFailure?: boolean

    /**
     * Callback for indicating the percentage of complete requests in a bulk call.
     * Note: It is only used with bulk calls
     */
    onProgress?: { (progress: number): void } | null

}

export enum RequestStatus {
    WAITING,
    EXECUTING,
    COMPLETED,
    FAILED
}

class RequestObject {
    maxAttempts: number
    attempts: number
    result: APIWrapperResponse
    alias?: string

    //Used in bulk calls. false: The bulkCall fails with the first subrequest that fails, true: Continue until all the calls complete
    continueWithFailure: boolean

    //Used in bulk calls to report progress
    onProgress: { (progress: number): void } | undefined | null
    progress: number = 0;

    /**Axios related */
    url: string
    method: string
    data: any
    params: object
    /*****************/

    // configuraton for axios call
    config: RequestOptions
    id: string
    mainPromise: Promise<APIWrapperResponse>
    resolvePromise?: (result: APIWrapperResponse) => void;
    rejectPromise?: (result: any) => void;

    isSubRequest: boolean
    status: RequestStatus
    subRequests: RequestObject[]
    parentId?: string

    constructor(options: RequestOptions = {}) {
        this.maxAttempts = options.attempts ? (options.attempts < 1 ? 1 : options.attempts) : 1;
        delete options.attempts

        this.attempts = 0;

        this.result = {} as any;

        this.alias = options.alias;
        delete options.alias

        this.continueWithFailure = options.continueWithFailure || false;
        delete options.continueWithFailure

        this.onProgress = options.onProgress; //Used in bulk calls to report progress
        delete options.onProgress

        this.progress = 0;

        /**Axios related */
        this.url = options.url || '';
        delete options.url // Removing the url since it is computed before calling the request

        this.method = options.method?.toLowerCase() || 'get'
        this.data = options.data;
        this.params = options.params || {};
        /*****************/

        // Config has all the extra parameters for axios
        this.config = options

        this.id = uuidv4();
        this.mainPromise = new Promise(this.promiseResolver.bind(this));
        this.isSubRequest = false;
        this.status = RequestStatus.WAITING
        this.subRequests = [];
    }

    addSubRequest(request: RequestObject) {
        request.parentId = this.id;
        request.isSubRequest = true;
        this.subRequests.push(request);
    }

    getSubrequestsPayload() {
        let result: Map<string | number, APIWrapperResponse> = new Map();
        for (let i = 0; i < this.subRequests.length; i++) {
            let alias: string | number = this.subRequests[i].alias || i;
            let subRequestResult = Object.assign({}, this.subRequests[i].result)
            subRequestResult.alias = alias.toString() // using the one in here since the subrequest could have undefined alias
            result.set(alias, subRequestResult)
        }

        return result;
    }

    updateStatusBySubRequests() {
        /**
         * When continueWithFailure == false
         * -If any children is failed then the complete request is failed
         * -If any child is executing or waiting then the request is waiting
         * -If all the children are completed then the request is completed
         * 
         * When continueWithFailure == true
         * -If any child is executing or waiting then the request is waiting
         * -When no children is executing or waiting then:
         *      -If all the children are completed then the request is completed
         *      -If any children is failed then the complete request is failed
         * 
        **/
        let completedCount = 0;
        let failed = false;

        if (!this.continueWithFailure) {
            for (let i = 0; i < this.subRequests.length; i++) {
                if (this.subRequests[i].status == RequestStatus.FAILED) {
                    // Failed
                    this.status = RequestStatus.FAILED;
                    break;
                } else if (this.subRequests[i].status == RequestStatus.COMPLETED) {
                    completedCount++;
                } else {
                    // Waiting
                    this.status = RequestStatus.WAITING;
                    break;
                }
            }

            if (completedCount == this.subRequests.length) {
                // Completed
                this.status = RequestStatus.COMPLETED
            }
        } else {

            for (let i = 0; i < this.subRequests.length; i++) {
                if (this.subRequests[i].status == RequestStatus.FAILED) {
                    // Failed
                    failed = true;
                    completedCount++;
                } else if (this.subRequests[i].status == RequestStatus.COMPLETED) {
                    completedCount++;
                } else {
                    // Waiting
                    this.status = RequestStatus.WAITING;
                    break;
                }
            }

            if (completedCount == this.subRequests.length) {
                this.status = failed ? RequestStatus.FAILED : RequestStatus.COMPLETED;
            }
        }
    }

    /**
     * Report progress in the range [0-1]
     */
    updateSubrequestsProgress() {
        let completedCount = 0.0;
        for (let i = 0; i < this.subRequests.length; i++) {
            if (this.subRequests[i].status == RequestStatus.FAILED || this.subRequests[i].status == RequestStatus.COMPLETED) {
                // Failed or completed
                completedCount++;
            }
        }

        this.progress = completedCount / this.subRequests.length;

        if (this.onProgress) {
            this.onProgress(this.progress);
        }
    }

    promiseResolver(resolve: { (value: APIWrapperResponse): void }, reject: { (reason: any): void }) {
        this.resolvePromise = resolve;
        this.rejectPromise = reject;
    }

    resolve(remoteResult: APIWrapperResponse) {
        Object.assign(this.result, remoteResult)
        this.result.alias = this.alias
        this.result.attempts = this.attempts

        this.resolvePromise!(this.result);
    }
}

export default RequestObject