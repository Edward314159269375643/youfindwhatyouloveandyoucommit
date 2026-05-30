const CONFIG = {
    API_BASE_URL: window.location.origin + '/api',
    getApiUrl: function(path) {
        return this.API_BASE_URL + path;
    }
};

window.CONFIG = CONFIG;
