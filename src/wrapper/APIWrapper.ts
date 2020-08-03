import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import RequestObject, { RequestOptions, RequestStatus } from './RequestObject';
import api_state from '../store/WrapperState'

export interface APIWrapperOptions extends AxiosRequestConfig {
    /**
     * Indicates how many times a request will be made before declaring it failed
     * 
     * Default: 1
     */
    maxAttemptsPerCall?: number

    /**
     * URL to be used as a prefix for all the requests.
     * Important: If an individual request indicates an url where http or https are part of the url
     * then this baseURL is ignored and the individual url is used as is.
     */
    baseURL?: string

    /**
     * Default: 'application/json'
     */
    contentType?: string

    /**
     * Waiting time in miliseconds before declaring a timeout ona request
     * Deault: 10,000
     */
    timeout?: number

    /**
     * If specified this value is send in the Authorization header
     */
    authorization?: string

    /**
     * Indicates how many simultaneous calls the APiWrapper can make at any given time
     * Default: 5
     */
    simultaneousCalls?: number
}

export interface APIWrapperResponse extends AxiosResponse {
    /**
     * Indicate if the request was succesfull
     */
    success?: boolean

    /**
     * Indicate the numbers of attemps this request made before completion
     */
    attempts?: number

    /**
     * Data retrieved by the request
     */
    data: any

    /**
     * Error returned in case something went wrong.
     * Note: Whenever an error exists, success will be false
     */
    error?: any

    /**
     * Present if there was an error
     */
    error_info?: string

    alias?: string
}

export class APIWrapper {

    maxAttemptsPerCall: number
    baseURL: string
    private _timeout: number = 0
    simultaneousCalls: number
    private axiosInstance: any
    private pendingRequests: RequestObject[];
    private bulkRequests: RequestObject[];
    private executingRequests: RequestObject[];
    // Vuex instance (used with quasar extension version)
    store: any = undefined;
    private _uploading: boolean
    public get uploading(): boolean { return this._uploading }

    private _downloading: boolean
    public get downloading(): boolean { return this._downloading }

    private _working: boolean
    public get working(): boolean { return this._working }

    constructor(options: APIWrapperOptions = {}) {

        this.maxAttemptsPerCall = options.maxAttemptsPerCall ? (options.maxAttemptsPerCall < 1 ? 1 : options.maxAttemptsPerCall) : 1;
        delete options.maxAttemptsPerCall

        this.baseURL = options.baseURL || '';
        delete options.baseURL // We avoid sending this to axios since it is computed before each call

        this.timeout = options.timeout ? (options.timeout < 0 ? 0 : options.timeout) : 0;

        this.simultaneousCalls = options.simultaneousCalls ? (options.simultaneousCalls <= 0 ? 1 : options.simultaneousCalls) : 1;
        delete options.simultaneousCalls

        this.axiosInstance = axios.create(options);

        /**
         * ContentType and Authorization are set after the axios instace creation
         * since both are configurations for the axios instance
         */
        this.setContentType(options.contentType || 'application/json');
        this.setAuthorization(options.authorization || '');

        this.pendingRequests = [];
        this.bulkRequests = [];
        this.executingRequests = [];
        this._uploading = false;
        this._downloading = false;
        this._working = false;
    }

    set timeout(value: number) {
        this._timeout = value;

        if (this.axiosInstance) {
            this.axiosInstance.defaults.timeout = value;
        }
    }

    get timeout() {
        return this._timeout;
    }


    private createResponse(options: APIWrapperResponse = {} as any): APIWrapperResponse {
        let response: APIWrapperResponse = {
            success: options.success !== undefined ? options.success : false,
            attempts: options.attempts || 0,
            data: options.data || {},
            error_info: options.error_info || '',
            error: options.error || null
        } as any

        // The values for: status, statusText, headers, config. Are added after the remote request
        return response
    }

    private commit(commitCmd: string, value: any) {
        if (this.store) {
            this.store.commit(commitCmd, value);
        }
    }

    /**
     * 
     * @param {*} path 
     * @param {*} conf
     */
    public get(path: string = '', conf?: RequestOptions) {
        conf = conf || {}
        return this.call(Object.assign(conf, { method: 'get', url: path }));
    }

    /**
     * 
     * @param {*} requests =[path:string] || [conf:{}]
     * @param {*} continueWithFailure:Boolean 
     *          false:The bulk call fails with the first request that fail. 
     *          true: The bulk call continue until each sub request is completed or failed.
     */
    public bulkGet(requests: string[] | RequestOptions[] = [], continueWithFailure = false, onProgress: { (progress: number): void } | null = null) {
        return this.bulkDecorator(requests, continueWithFailure, onProgress, 'get');
    }


    /**
     * 
     * @param {*} path 
     * @param {*} data 
     * @param {*} conf 
     */
    public post(path: string = '', data?: any, conf?: RequestOptions) {
        conf = conf || {}
        return this.call(Object.assign(conf, { method: 'post', url: path, data: data }));
    }

    /**
     * 
     * @param {*} requests =[path:string] || [conf:{}]
     * @param {*} continueWithFailure:Boolean 
     *          false:The bulk call fails with the first request that fail. 
     *          true: The bulk call continue until each sub request is completed or failed.
     */
    public bulkPost(requests: string[] | RequestOptions[] = [], continueWithFailure = false, onProgress: { (progress: number): void } | null = null) {
        return this.bulkDecorator(requests, continueWithFailure, onProgress, 'post');
    }

    /**
     * 
     * @param {*} path 
     * @param {*} data 
     * @param {*} conf 
     */
    public patch(path: string = '', data?: any, conf?: RequestOptions) {
        conf = conf || {}
        return this.call(Object.assign(conf, { method: 'patch', url: path, data: data }));
    }
    /**
     * 
     * @param {*} requests =[path:string] || [conf:{}]
     * @param {*} continueWithFailure:Boolean 
     *          false:The bulk call fails with the first request that fail. 
     *          true: The bulk call continue until each sub request is completed or failed.
     */
    public bulkPatch(requests: string[] | RequestOptions[] = [], continueWithFailure = false, onProgress: { (progress: number): void } | null = null) {
        return this.bulkDecorator(requests, continueWithFailure, onProgress, 'patch');
    }

    /**
     * 
     * @param {*} path 
     * @param {*} data 
     * @param {*} conf 
     */
    public put(path: string = '', data?: any, conf?: RequestOptions) {
        conf = conf || {}
        return this.call(Object.assign(conf, { method: 'put', url: path, data: data }));
    }
    /**
     * 
     * @param {*} requests =[path:string] || [conf:{}]
     * @param {*} continueWithFailure:Boolean 
     *          false:The bulk call fails with the first request that fail. 
     *          true: The bulk call continue until each sub request is completed or failed.
     */
    public bulkPut(requests: string[] | RequestOptions[] = [], continueWithFailure = false, onProgress: { (progress: number): void } | null = null) {
        return this.bulkDecorator(requests, continueWithFailure, onProgress, 'put');
    }

    /**
     * 
     * @param {*} path 
     * @param {*} conf
     */
    public delete(path = '', conf?: RequestOptions) {
        conf = conf || {}
        return this.call(Object.assign(conf, { method: 'delete', url: path }));
    }

    /**
     * 
     * @param {*} requests =[path:string] || [conf:{}]
     * @param {*} continueWithFailure:Boolean 
     *          false:The bulk call fails with the first request that fail. 
     *          true: The bulk call continue until each sub request is completed or failed.
     */
    public bulkDelete(requests: string[] | RequestOptions[] = [], continueWithFailure = false, onProgress: { (progress: number): void } | null = null) {
        return this.bulkDecorator(requests, continueWithFailure, onProgress, 'delete');
    }

    /**
     * 
     * @param {*} requests =[path:string] || [conf:{}]
     * @param {*} continueWithFailure:Boolean 
     *          false:The bulk call fails with the first request that fail. 
     *          true: The bulk call continue until each sub request is completed or failed.
     */
    private bulkDecorator(requests: string[] | RequestOptions[] = [], continueWithFailure = false, onProgress: { (progress: number): void } | null = null, method: string) {
        let result: RequestOptions[] = [];
        requests.forEach((request: string | RequestOptions) => {
            if (typeof request === 'string') {
                // Only path
                result.push({ method: method as any, url: request });
            } else if (typeof request === 'object') {
                // Config
                request.url = request.url || ''
                request.method = method as any
                result.push(request);
            }
        })
        return this.bulkCall(result, continueWithFailure, onProgress);
    }

    private call(options: RequestOptions = {}) {
        options.method = options.method || 'get'
        options.url = options.url || ''

        let method: keyof typeof axios = (options.method.toLowerCase() as any)
        if (!axios[method]) {
            console.log(`The specified method: ${method} is not allowed.`)
            // Error if the specified method is invalid
            let error = new Error(`The specified method: ${method} is not allowed.`)
            return Promise.resolve(this.createResponse({ success: false, error_info: error.message, error: error } as any));
        }

        options.attempts = this.maxAttemptsPerCall;
        let request = this.getRequestObject(options);

        this.pendingRequests.push(request);
        this.commit('setRequestsCount', this.pendingRequests.length + this.executingRequests.length);

        this.executeNextRequest();

        return request.mainPromise;
    }

    /**
     * 
     * @param {*} configs:[] Array of config for each call
     * @param {*} continueWithFailure:Boolean 
     *          false:The bulk call fails with the first request that fail. 
     *          true: The bulk call continue until each sub request is completed or failed.
     */
    public bulkCall(configs: RequestOptions[], continueWithFailure: boolean, onProgress: { (progress: number): void } | null) {
        let invalidMethod: boolean = false;
        let invalidMethodInfo: string = '';
        let children: RequestObject[] = [];
        let parent = this.getRequestObject({ continueWithFailure: continueWithFailure, onProgress: onProgress });

        configs.forEach(c => {
            let request = this.getRequestObject(c);

            if (!axios[request.method as keyof typeof axios]) {
                // Error if the specified method is invalid
                invalidMethod = true;
                invalidMethodInfo = request.method;
            }
            children.push(request);
        });

        if (invalidMethod) {
            let error = new Error(`The specified method: ${invalidMethodInfo} is not allowed.`)
            return Promise.resolve(this.createResponse({ success: false, error_info: error.message, error: error } as any));
        } else {
            children.forEach(request => {
                //Added to its parent
                parent.addSubRequest(request);

                //Empty result
                request.result = this.createResponse();

                //Added to the pending list
                this.pendingRequests.push(request);
                this.commit('setRequestsCount', this.pendingRequests.length + this.executingRequests.length);
            })

            //Parent added to the bulk list
            this.bulkRequests.push(parent);

            this.executeNextRequest();

            return parent.mainPromise;
        }
    }

    private getBulkRequestById(id: string): RequestObject | undefined {
        return this.bulkRequests.find(r => r.id == id);
    }

    private getRequestObject(config: RequestOptions): RequestObject {
        return new RequestObject(config);
    }

    private executeNextRequest(): void {
        if (this.pendingRequests.length == 0) {
            // Nothing to call
            return;
        }

        if (this.executingRequests.length >= this.simultaneousCalls) {
            // No more concurrent calls allowed
            return;
        }

        let next: RequestObject | undefined = this.pendingRequests.shift();
        next!.status = RequestStatus.EXECUTING;
        next!.attempts++;
        this.executingRequests.push(next!);
        this.commit('setRequestsExecutingCount', this.executingRequests.length);
        this.updateWorkingStatus();

        let config: RequestOptions = Object.assign({ url: this.getComputedPath(next!.url) }, next!.config);

        //Remote call
        this.axiosInstance(config)
            .then((result: any) => {
                this.evaluateRemoteResponse(next!.id, result);
            })
            .catch((error: any) => {
                this.evaluateRemoteError(next!.id, error);
            })

        //Recursive call until no more concurrent calls could be made
        this.executeNextRequest();
    }

    private evaluateRemoteResponse(requestId: string, remoteResult: any) {
        let request: RequestObject | undefined = this.executingRequests.find(r => r.id == requestId);

        // There is not executing request matching this one (could be a bulk call remanent)
        if (!request) {
            this.executeNextRequest();
            return;
        }

        //Evaluate response
        let successfull = false;
        if (remoteResult.status >= 200 && remoteResult.status < 300) {
            successfull = true;
        }

        request.status = RequestStatus.COMPLETED;
        let result = this.createResponse(Object.assign({ success: successfull }, remoteResult));
        this.requestCompletion(request, result)

        this.executeNextRequest();
    }

    private evaluateRemoteError(requestId: string, error: any) {
        let request = this.executingRequests.find(r => r.id == requestId);

        // There is not executing request matching this one (could be a bulk call remanent)
        if (!request) {
            this.executeNextRequest();
            return;
        }

        let timedOut = false;
        if (error.code == 'ETIMEDOUT' || error.code == 'ECONNABORTED') {
            if (error.code == 'ECONNABORTED') {
                // Could be aborted for other reasons
                if (error.message?.includes('timeout')) {
                    timedOut = true;
                }
            } else {
                timedOut = true;
            }
        }

        // Can be repeated
        if (timedOut && request.attempts < request.maxAttempts) {
            this.removeRequestFromLists(request.id);
            request.status = RequestStatus.WAITING;
            this.pendingRequests.push(request);
        } else {
            //Permanent failure
            request.status = RequestStatus.FAILED;
            let result = this.createResponse(Object.assign(error.response || {}, { success: false, error_info: error.message, error: error }));
            this.requestCompletion(request, result)
        }

        this.executeNextRequest();
    }

    private requestCompletion(request: RequestObject, result: APIWrapperResponse) {
        // Remove the request from any list
        this.removeRequestFromLists(request.id);

        request.resolve(result);

        // Was a subrequest?
        if (request.isSubRequest) {
            this.evaluateBulkCompletion(request.parentId!);
        }

        this.updateWorkingStatus();
    }

    private evaluateBulkCompletion(requestId: string) {
        let request = this.getBulkRequestById(requestId);

        if (!request) {
            //No bulk request found
            return;
        }

        request.updateStatusBySubRequests();
        request.updateSubrequestsProgress();

        if (request.status == RequestStatus.FAILED || request.status == RequestStatus.COMPLETED) {
            //Failed or completed
            let index = this.bulkRequests.findIndex(r => r.id == request!.id);
            this.bulkRequests.splice(index, 1);
            let success = request.status == RequestStatus.FAILED ? false : true;
            request.resolve(this.createResponse({ success: success, data: request.getSubrequestsPayload() } as any));

            //Remove any subrequest
            for (let i = 0; i < request.subRequests.length; i++) {
                this.removeRequestFromLists(request.subRequests[i].id);
            }
        }
    }

    private updateWorkingStatus() {
        let uploading = false;
        let downloading = false;
        let working;

        for (let i = 0; i < this.executingRequests.length; i++) {
            if (this.executingRequests[i].method == 'get') {
                downloading = true;
            } else {
                uploading = true;
            }

            if (uploading && downloading) { break; }
        }

        working = uploading || downloading;

        // Commit only if the state change
        if (this._working != working) {
            this._working = working;
            this.commit('setWorking', this._working);
        }

        if (this._uploading != uploading) {
            this._uploading = uploading;
            this.commit('setUploading', this._uploading);
        }

        if (this._downloading != downloading) {
            this._downloading = downloading;
            this.commit('setDownloading', this._downloading);
        }
    }

    private removeRequestFromLists(id: string) {
        let index = this.pendingRequests.findIndex(r => r.id == id);
        if (index >= 0) { this.pendingRequests.splice(index, 1); }

        index = this.executingRequests.findIndex(r => r.id == id);
        if (index >= 0) { this.executingRequests.splice(index, 1); }

        this.commit('setRequestsCount', this.pendingRequests.length + this.executingRequests.length);
        this.commit('setRequestsExecutingCount', this.executingRequests.length);
    }

    public setContentType(type: string) {
        this.axiosInstance.defaults.headers.post['Content-Type'] = type;
        this.axiosInstance.defaults.headers.patch['Content-Type'] = type;
        this.axiosInstance.defaults.headers.put['Content-Type'] = type;
    }

    /**
     * 
     * @param {*} token 
     * @param {*} type
     */
    public setAuthorization(token: string, type = 'Bearer') {
        token = token.trim()
        type = type.trim()
        this.axiosInstance.defaults.headers.common['Authorization'] = `${type} ${token}`;
    }

    private getComputedPath(path: string) {
        let result = path;

        //Do the provided path is relative and need the base URL?
        if (result.indexOf('http') != 0) {
            result = this.baseURL + result;
        }

        return result;
    }

    /**
     * Register the APIWrapper module so it can be use in applications that implement Vuex
     */
    public setStore(store: any) {
        this.store = (store !== undefined && store !== null) ? store : undefined;

        if (this.store) {
            this.store.registerModule('APIwrapper', api_state);
        }
    }
}

export default new APIWrapper();