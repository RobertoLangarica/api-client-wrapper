export default{
    state:{
        working:false, // When a request is executing
        request_count: 0, // Number of requests in the wrapper
        executing_count: 0, // Number of requests executing
        uploading: false, // Is there any request executing with a method different from GET
        downloading: false // Is there any request executing with a method equal to GET 
    },
    mutations:{
        setWorking(state, value){
            state.working = value;
        },
        setRequestsCount(state, value){
            state.request_count = value;
        },
        setRequestsExecutingCount(state, value){
            state.executing_count = value;
        },
        setUploading(state, value){
            state.uploading = value;
        },
        setDownloading(state, value){
            state.downloading = value;
        },

    }
}