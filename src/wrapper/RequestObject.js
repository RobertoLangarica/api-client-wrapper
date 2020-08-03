"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RequestStatus = void 0;
const uuid_1 = require("uuid");
var RequestStatus;
(function (RequestStatus) {
    RequestStatus[RequestStatus["WAITING"] = 0] = "WAITING";
    RequestStatus[RequestStatus["EXECUTING"] = 1] = "EXECUTING";
    RequestStatus[RequestStatus["COMPLETED"] = 2] = "COMPLETED";
    RequestStatus[RequestStatus["FAILED"] = 3] = "FAILED";
})(RequestStatus = exports.RequestStatus || (exports.RequestStatus = {}));
class RequestObject {
    constructor(options = {}) {
        var _a;
        this.progress = 0;
        this.maxAttempts = options.attempts ? (options.attempts < 1 ? 1 : options.attempts) : 1;
        delete options.attempts;
        this.attempts = 0;
        this.result = {};
        this.alias = options.alias;
        delete options.alias;
        this.continueWithFailure = options.continueWithFailure || false;
        delete options.continueWithFailure;
        this.onProgress = options.onProgress;
        delete options.onProgress;
        this.progress = 0;
        this.url = options.url || '';
        delete options.url;
        this.method = ((_a = options.method) === null || _a === void 0 ? void 0 : _a.toLowerCase()) || 'get';
        this.data = options.data;
        this.params = options.params || {};
        this.config = options;
        this.id = uuid_1.v4();
        this.mainPromise = new Promise(this.promiseResolver.bind(this));
        this.isSubRequest = false;
        this.status = RequestStatus.WAITING;
        this.subRequests = [];
    }
    addSubRequest(request) {
        request.parentId = this.id;
        request.isSubRequest = true;
        this.subRequests.push(request);
    }
    getSubrequestsPayload() {
        let result = new Map();
        for (let i = 0; i < this.subRequests.length; i++) {
            let alias = this.subRequests[i].alias || String(i);
            let subRequestResult = Object.assign({}, this.subRequests[i].result);
            subRequestResult.alias = alias;
            result.set(alias, subRequestResult);
        }
        return result;
    }
    updateStatusBySubRequests() {
        let completedCount = 0;
        let failed = false;
        if (!this.continueWithFailure) {
            for (let i = 0; i < this.subRequests.length; i++) {
                if (this.subRequests[i].status == RequestStatus.FAILED) {
                    this.status = RequestStatus.FAILED;
                    break;
                }
                else if (this.subRequests[i].status == RequestStatus.COMPLETED) {
                    completedCount++;
                }
                else {
                    this.status = RequestStatus.WAITING;
                    break;
                }
            }
            if (completedCount == this.subRequests.length) {
                this.status = RequestStatus.COMPLETED;
            }
        }
        else {
            for (let i = 0; i < this.subRequests.length; i++) {
                if (this.subRequests[i].status == RequestStatus.FAILED) {
                    failed = true;
                    completedCount++;
                }
                else if (this.subRequests[i].status == RequestStatus.COMPLETED) {
                    completedCount++;
                }
                else {
                    this.status = RequestStatus.WAITING;
                    break;
                }
            }
            if (completedCount == this.subRequests.length) {
                this.status = failed ? RequestStatus.FAILED : RequestStatus.COMPLETED;
            }
        }
    }
    updateSubrequestsProgress() {
        let completedCount = 0.0;
        for (let i = 0; i < this.subRequests.length; i++) {
            if (this.subRequests[i].status == RequestStatus.FAILED || this.subRequests[i].status == RequestStatus.COMPLETED) {
                completedCount++;
            }
        }
        this.progress = completedCount / this.subRequests.length;
        if (this.onProgress) {
            this.onProgress(this.progress);
        }
    }
    promiseResolver(resolve, reject) {
        this.resolvePromise = resolve;
        this.rejectPromise = reject;
    }
    resolve(remoteResult) {
        Object.assign(this.result, remoteResult);
        this.result.alias = this.alias;
        this.result.attempts = this.attempts;
        this.resolvePromise(this.result);
    }
}
exports.default = RequestObject;
//# sourceMappingURL=RequestObject.js.map