# api-client-wrapper
===

_An easy to use out of the box API wrapper that use [axios](https://github.com/axios/axios)  in its core_

This package was designed to wrap up the most common features of an api client implementation, in an effort to have a quick and stable tool for each project.

The present features in the package are:

1. **Homogeneous response:** Each request is a promise that resolve with an homogeneous response object: `{success:Boolean, attempts:int, data:Object, info:string, error:Error}`. For more details refer to the _Response Schema_ section on this readme.

1. **Concurrent requests:** All the requests could be made simultaneously. By default the limit is configured to 5 concurrent requests, but it could be changed at `api.simultaneousCalls`

1. **Timeout and retry:** In the case of a timeout response a request could be configured to try again with: `api.maxAttemptsPerCall` the default value is _1_. Each attempt will be executed transparently and it will be just one response so the code for a request with a single attempt will be the same as for a request with multiple attempts.

1. **Masive requests:** There is out of the box support for bulk calls that allows multiple requests in a single call. For more information refer to the _How To use it_ section on this readme.

1. **Vuex integration:** The package came with Vuex store integration for state monitoring (it will work with any Flux implementation but further testing is needed). The store instance should be provided using: `api.setStore(store_instance)` and this will result in the module `APIwrapper` being registered with the next properties:
   1. Working: Indicating that is at least one request executing `store.state.APIwrapper.working`
   1. Uploading: Indicating that is at least one request executing with a method different from `GET` `store.state.APIwrapper.uploading`
   1. Downloading: Indicating that is at least one request executing with a method equal to `GET` `store.state.APIwrapper.downloading`
   1. Request Count: Indicates the amount of requests being managed, _executing requests + waiting for execution requests_ `store.state.APIwrapper.request_count`
   1. Execute Count: Indicates the amount of requests being executed in a concurrent manner `store.state.APIwrapper.executing_count`
   

# Installing
```bash
npm install api-client-wrapper
```

# How to use it

### Performing a `GET` request

```javascript
import api from 'api-client-wrapper'

let result = await api.get('path');
//or
api.get('path').then(result=>{});
```

### Performing a `POST` request

```javascript
import api from 'api-client-wrapper'

let result = await api.post('path', {data});
//or
api.post('path', {data}).then(result=>{});
```

### The supported methods are:
```javascript
get(path='', conf = {})
post(path='', data = {}, conf = {})
patch(path='', data = {}, conf = {})
put(path='', data = {}, conf = {})
delete(path='', conf = {})

//Or the global method that receive a request Configuration
call({request configuration})
```
Note that each method has a final argument that is a custom configuration for the request, this configuration takes precedence over the global configuration. For the supported properties please refer to the _Request Configuration_ section.

### Bulk calls
Each method has a bulk counterpart that allows for bulk calls

```javascript
import api from 'api-client-wrapper'

let result = await api.bulkGet(['paths' or {configs}], continueWithFailure:Boolean, onProgress)
let result = await api.bulkPost(['paths' or {configs}], continueWithFailure:Boolean, onProgress)
let result = await api.bulkPatch(['paths' or {configs}], continueWithFailure:Boolean, onProgress)
let result = await api.bulkPut(['paths' or {configs}], continueWithFailure:Boolean, onProgress)
let result = await api.bulkDelete(['paths' or {configs}], continueWithFailure:Boolean, onProgress)

//or the global method that allows bulk calls with different methods
let result = await api.bulkCall([{configs}], continueWithFailure:Boolean, onProgress)
```
#### Params:
* **[paths or configs]:[]**-> An array containing the paths for each request or an array of request configuration objects (described next).
* **continueWithFailure:Boolean**-> Optional with the default to _false_.  **`false`** The request will be considered failed when any of it subrequests fail and it will stop any further execution (there could be some sub-requests that never get executed if some other request failed before). **`true`** All the requests are executed, it doesn´t matter if some of them failed.
* **onProgress:Function(progress:Number)**-> Is an optional callback that receives progress between [0-1], the progress is computed with the next formula: _(request-completed / total-amount-of-request-in-the-bulkCall)_

### Request Configuration
A configuration object for each request (with precedence over any global configuration) with the next scheme:
```javascript
{
// Relative or absolute path for the call. Always needed except for when a path was already passed as an argument
url:String,

// The HTTP verb to be used for the request
method:String,

// the URL parameters to be sent with the request
params:{},

// Data to be sent as the request body
data:{},

// An alias to be added to the response of this request for better indentification with bulk calls
alias:String,

// Number of attemps for the request in case of timeout failure
attempts:1,

// Number of milliseconds before the request times out.
timeout:10000

// Any other property supported by axios configuration
...
}
```

It is possible to add any property supported by [axios](https://github.com/axios/axios) (like headers or encoding).

### Response Scheme

For any individual request the response schema is:
```javascript
{
// Present only when an alias was passed in the config for the request
alias:String,

// true: when the status of the request is between [200-300) 
// flase: for any status not in the range of 200's
success:Boolean,

// Number of attemps made by this request before being considered completed
attempts:0,

// Any data returned in the response or an array of responses in the case of a bulk call
data:{}

// The error message present when an error is returned with the response
info:"",

// The error instance present in the response (if there is one)
error:null,

// All the other data present in the axios response
...
}
```
In the case of a bulk call the response _data_ is an Array containing the response for each request (in the same order that the requests where passed)

```javascript
let result = await anyBulkCall([{configs}]

//Result data will contain an array of responses
result.data.forEach(response=>{
   console.log (response)
})

// If an alias where provided for any request then that request could be accessed with that alias
let result = await anyBulkCall([{alias:'a',...},{alias:'b',...}]
console.log(result.data.a)
console.log(result.data.b)
```

### Global Configuration

Configuration of the overall behaviour for the package

```javascript
import api from 'api-client-wrapper'

// `baseURL` will be prepended to any path provided unless the provided path is absolute.
api.baseURL = '';

// The amount of attempts a request will make in the case of a timeout before failing completely
api.maxAttemptsPerCall = 1;

// The amount of concurrent requests that could be executed (when the requests number exceed this amount the requests are enqueue in a waiting mode)
api.simultaneousCalls = 5;

// Specifies the number of milliseconds before a request times out
api.timeout = 10000;

// Sets the default headers for 'Content-Type' for each request
api.setContentType(type = 'application/json')

// Sets the default authorization header: 'Authorization' for each request
api.setAuthorization(token, type = 'Bearer')

// Sets any default header that will be used on each request
api.setHeader(name: string, value:string)

// This will bring the module 'APIwrapper' available and the package will start updating its state
api.setStore(vuex_instance)
```

