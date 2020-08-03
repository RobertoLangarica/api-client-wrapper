"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.APIWrapper = void 0;
const axios_1 = require("axios");
const RequestObject_1 = require("./RequestObject");
const WrapperState_1 = require("../store/WrapperState");
class APIWrapper {
    constructor(options = {}) {
        this._timeout = 0;
        this.store = undefined;
        this.maxAttemptsPerCall = options.maxAttemptsPerCall ? (options.maxAttemptsPerCall < 1 ? 1 : options.maxAttemptsPerCall) : 1;
        delete options.maxAttemptsPerCall;
        this.baseURL = options.baseURL || '';
        delete options.baseURL;
        this.timeout = options.timeout ? (options.timeout < 0 ? 0 : options.timeout) : 0;
        this.simultaneousCalls = options.simultaneousCalls ? (options.simultaneousCalls <= 0 ? 1 : options.simultaneousCalls) : 1;
        delete options.simultaneousCalls;
        this.axiosInstance = axios_1.default.create(options);
        this.setContentType(options.contentType || 'application/json');
        this.setAuthorization(options.authorization || '');
        this.pendingRequests = [];
        this.bulkRequests = [];
        this.executingRequests = [];
        this.uploading = false;
        this.downloading = false;
        this.working = false;
    }
    set timeout(value) {
        this._timeout = value;
        if (this.axiosInstance) {
            this.axiosInstance.defaults.timeout = value;
        }
    }
    get timeout() {
        return this._timeout;
    }
    createResponse(options = {}) {
        let response = {
            success: options.success !== undefined ? options.success : false,
            attempts: options.attempts || 0,
            data: options.data || {},
            error_info: options.error_info || '',
            error: options.error || null
        };
        return response;
    }
    commit(commitCmd, value) {
        if (this.store) {
            this.store.commit(commitCmd, value);
        }
    }
    get(path = '', conf) {
        conf = conf || {};
        return this.call(Object.assign(conf, { method: 'get', url: path }));
    }
    bulkGet(requests = [], continueWithFailure = false, onProgress = null) {
        return this.bulkDecorator(requests, continueWithFailure, onProgress, 'get');
    }
    post(path = '', data, conf) {
        conf = conf || {};
        return this.call(Object.assign(conf, { method: 'post', url: path, data: data }));
    }
    bulkPost(requests = [], continueWithFailure = false, onProgress = null) {
        return this.bulkDecorator(requests, continueWithFailure, onProgress, 'post');
    }
    patch(path = '', data, conf) {
        conf = conf || {};
        return this.call(Object.assign(conf, { method: 'patch', url: path, data: data }));
    }
    bulkPatch(requests = [], continueWithFailure = false, onProgress = null) {
        return this.bulkDecorator(requests, continueWithFailure, onProgress, 'patch');
    }
    put(path = '', data, conf) {
        conf = conf || {};
        return this.call(Object.assign(conf, { method: 'put', url: path, data: data }));
    }
    bulkPut(requests = [], continueWithFailure = false, onProgress = null) {
        return this.bulkDecorator(requests, continueWithFailure, onProgress, 'put');
    }
    delete(path = '', conf) {
        conf = conf || {};
        return this.call(Object.assign(conf, { method: 'delete', url: path }));
    }
    bulkDelete(requests = [], continueWithFailure = false, onProgress = null) {
        return this.bulkDecorator(requests, continueWithFailure, onProgress, 'delete');
    }
    bulkDecorator(requests = [], continueWithFailure = false, onProgress = null, method) {
        let result = [];
        requests.forEach((request) => {
            if (typeof request === 'string') {
                result.push({ method: method, url: request });
            }
            else if (typeof request === 'object') {
                request.url = request.url || '';
                request.method = method;
                result.push(request);
            }
        });
        return this.bulkCall(result, continueWithFailure, onProgress);
    }
    call(options = {}) {
        options.method = options.method || 'get';
        options.url = options.url || '';
        let method = options.method.toLowerCase();
        if (!axios_1.default[method]) {
            console.log(`The specified method: ${method} is not allowed.`);
            let error = new Error(`The specified method: ${method} is not allowed.`);
            return Promise.resolve(this.createResponse({ success: false, error_info: error.message, error: error }));
        }
        options.attempts = this.maxAttemptsPerCall;
        let request = this.getRequestObject(options);
        this.pendingRequests.push(request);
        this.commit('setRequestsCount', this.pendingRequests.length + this.executingRequests.length);
        this.executeNextRequest();
        return request.mainPromise;
    }
    bulkCall(configs, continueWithFailure, onProgress) {
        let invalidMethod = false;
        let invalidMethodInfo = '';
        let children = [];
        let parent = this.getRequestObject({ continueWithFailure: continueWithFailure, onProgress: onProgress });
        configs.forEach(c => {
            let request = this.getRequestObject(c);
            if (!axios_1.default[request.method]) {
                invalidMethod = true;
                invalidMethodInfo = request.method;
            }
            children.push(request);
        });
        if (invalidMethod) {
            let error = new Error(`The specified method: ${invalidMethodInfo} is not allowed.`);
            return Promise.resolve(this.createResponse({ success: false, error_info: error.message, error: error }));
        }
        else {
            children.forEach(request => {
                parent.addSubRequest(request);
                request.result = this.createResponse();
                this.pendingRequests.push(request);
                this.commit('setRequestsCount', this.pendingRequests.length + this.executingRequests.length);
            });
            this.bulkRequests.push(parent);
            this.executeNextRequest();
            return parent.mainPromise;
        }
    }
    getBulkRequestById(id) {
        return this.bulkRequests.find(r => r.id == id);
    }
    getRequestObject(config) {
        return new RequestObject_1.default(config);
    }
    executeNextRequest() {
        if (this.pendingRequests.length == 0) {
            return;
        }
        if (this.executingRequests.length >= this.simultaneousCalls) {
            return;
        }
        let next = this.pendingRequests.shift();
        next.status = RequestObject_1.RequestStatus.EXECUTING;
        next.attempts++;
        this.executingRequests.push(next);
        this.commit('setRequestsExecutingCount', this.executingRequests.length);
        this.updateWorkingStatus();
        let config = Object.assign({ url: this.getComputedPath(next.url) }, next.config);
        this.axiosInstance(config)
            .then((result) => {
            this.evaluateRemoteResponse(next.id, result);
        })
            .catch((error) => {
            this.evaluateRemoteError(next.id, error);
        });
        this.executeNextRequest();
    }
    evaluateRemoteResponse(requestId, remoteResult) {
        let request = this.executingRequests.find(r => r.id == requestId);
        if (!request) {
            this.executeNextRequest();
            return;
        }
        let successfull = false;
        if (remoteResult.status >= 200 && remoteResult.status < 300) {
            successfull = true;
        }
        request.status = RequestObject_1.RequestStatus.COMPLETED;
        let result = this.createResponse(Object.assign({ success: successfull }, remoteResult));
        this.requestCompletion(request, result);
        this.executeNextRequest();
    }
    evaluateRemoteError(requestId, error) {
        var _a;
        let request = this.executingRequests.find(r => r.id == requestId);
        if (!request) {
            this.executeNextRequest();
            return;
        }
        let timedOut = false;
        if (error.code == 'ETIMEDOUT' || error.code == 'ECONNABORTED') {
            if (error.code == 'ECONNABORTED') {
                if ((_a = error.message) === null || _a === void 0 ? void 0 : _a.includes('timeout')) {
                    timedOut = true;
                }
            }
            else {
                timedOut = true;
            }
        }
        if (timedOut && request.attempts < request.maxAttempts) {
            this.removeRequestFromLists(request.id);
            request.status = RequestObject_1.RequestStatus.WAITING;
            this.pendingRequests.push(request);
        }
        else {
            request.status = RequestObject_1.RequestStatus.FAILED;
            let result = this.createResponse(Object.assign(error.response || {}, { success: false, error_info: error.message, error: error }));
            this.requestCompletion(request, result);
        }
        this.executeNextRequest();
    }
    requestCompletion(request, result) {
        this.removeRequestFromLists(request.id);
        request.resolve(result);
        if (request.isSubRequest) {
            this.evaluateBulkCompletion(request.parentId);
        }
        this.updateWorkingStatus();
    }
    evaluateBulkCompletion(requestId) {
        let request = this.getBulkRequestById(requestId);
        if (!request) {
            return;
        }
        request.updateStatusBySubRequests();
        request.updateSubrequestsProgress();
        if (request.status == RequestObject_1.RequestStatus.FAILED || request.status == RequestObject_1.RequestStatus.COMPLETED) {
            let index = this.bulkRequests.findIndex(r => r.id == request.id);
            this.bulkRequests.splice(index, 1);
            let success = request.status == RequestObject_1.RequestStatus.FAILED ? false : true;
            request.resolve(this.createResponse({ success: success, data: request.getSubrequestsPayload() }));
            for (let i = 0; i < request.subRequests.length; i++) {
                this.removeRequestFromLists(request.subRequests[i].id);
            }
        }
    }
    updateWorkingStatus() {
        let uploading = false;
        let downloading = false;
        let working;
        for (let i = 0; i < this.executingRequests.length; i++) {
            if (this.executingRequests[i].method == 'get') {
                downloading = true;
            }
            else {
                uploading = true;
            }
            if (uploading && downloading) {
                break;
            }
        }
        working = uploading || downloading;
        if (this.working != working) {
            this.working = working;
            this.commit('setWorking', this.working);
        }
        if (this.uploading != uploading) {
            this.uploading = uploading;
            this.commit('setUploading', this.uploading);
        }
        if (this.downloading != downloading) {
            this.downloading = downloading;
            this.commit('setDownloading', this.downloading);
        }
    }
    removeRequestFromLists(id) {
        let index = this.pendingRequests.findIndex(r => r.id == id);
        if (index >= 0) {
            this.pendingRequests.splice(index, 1);
        }
        index = this.executingRequests.findIndex(r => r.id == id);
        if (index >= 0) {
            this.executingRequests.splice(index, 1);
        }
        this.commit('setRequestsCount', this.pendingRequests.length + this.executingRequests.length);
        this.commit('setRequestsExecutingCount', this.executingRequests.length);
    }
    setContentType(type) {
        this.axiosInstance.defaults.headers.post['Content-Type'] = type;
        this.axiosInstance.defaults.headers.patch['Content-Type'] = type;
        this.axiosInstance.defaults.headers.put['Content-Type'] = type;
    }
    setAuthorization(token, type = 'Bearer') {
        token = token.trim();
        type = type.trim();
        this.axiosInstance.defaults.headers.common['Authorization'] = `${type} ${token}`;
    }
    getComputedPath(path) {
        let result = path;
        if (result.indexOf('http') != 0) {
            result = this.baseURL + result;
        }
        return result;
    }
    setStore(store) {
        this.store = (store !== undefined && store !== null) ? store : undefined;
        if (this.store) {
            this.store.registerModule('APIwrapper', WrapperState_1.default);
        }
    }
}
exports.APIWrapper = APIWrapper;
exports.default = new APIWrapper();
//# sourceMappingURL=APIWrapper.js.map