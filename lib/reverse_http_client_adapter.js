if (typeof(ReverseHttpServiceAdapters) != 'undefined' &&
typeof(ReverseHTTP) != 'undefined') {
	
	var _reqAdapterMap = {};
	var _reqAppMap = {};

    ReverseHttpServiceAdapters.addAdapter({
        //returns true if init successful, false othervise
        init: function() {
            try {
                this._gateway = new ReverseHTTP('ws://localhost:8080');
                return true;
            } 
            catch (e) {
                return false;
            }
        },
        //fires eventListener when the application is ready
        registerApplication: function(appName, app, eventListeners) {
            if (typeof(appName) === 'undefined' || typeof(app) === 'undefined') 
                return;
            
            if (typeof(eventListeners) != 'undefined') {
                for (var i in eventListeners) {
                    var tmp = eventListeners[i];
                    if ('on' === i.substring(0, 2).toLowerCase()) {
                        delete eventListeners[i];
                        eventListeners[i.substring(2).toLowerCase()] = tmp;
                    }
                }
                
                if (eventListeners.hasOwnProperty('error')) {
                    this._gateway.addEventListener('requesterror', function(event) {
                        eventListeners['error'](event);
                    }, false);
                }
            }
            
            this._gateway.addEventListener('request', function(event) {
                if (app instanceof Application) {
                    app.setUrl(event.data.realPrefix);
                }
                if (eventListeners.hasOwnProperty('register')) {
					event.data = event.data.realPrefix;
					eventListeners['register'](event);
				}
            }, false);
            
            this._gateway.addEventListener('register', function(event) {
                _reqAdapterMap[event.data.requestKey]._gateway.request(function(request, response) {
                    request.getHeader = function(key) {
                        return request.headers[key];
                    };
                    request.url = 'http://' + request.headers['host'] + request.resourcePath;
                    
                    request.bodyText = request.body;
                    delete request.body;
                    
                    request.version = 'HTTP/1.1'; //TODO: no hardcoding should be necessary
                    response.setHeader = function(key, value, merge) {
                        if (merge && response.headers.hasOwnProperty(key)) 
                            response.headers[key] += ', ' + value;
                        else 
                            response.headers[key] = value;
                    };
                    
                    response.bodyText = response.body;
                    ;
                    delete response.body;
                    response.status = response.statusCode;
                    delete response.statusCode;
                    
                    var tmpResponse = response;
                    tmpResponse.sendOld = response.send;
                    response.send = function() {
                        delete tmpResponse.setHeader;
                        tmpResponse.body = tmpResponse.bodyText;
                        delete tmpResponse.bodyText;
                        tmpResponse.statusCode = tmpResponse.status;
                        delete tmpResponse.status;
                        tmpResponse.sendOld();
                    };
                    app.handle(request, response);
                });
            }, false);
            
            var requestKey = this._gateway.register(appName, 0);
			_reqAdapterMap[requestKey] = this;
			_reqAppMap[requestKey] = app;
        },
        //returns true if unregistered, false othervise
        unregisterApplication: function(appName) {
            this._gateway.unregister(appName);
            return true;
        },
        
        addEventListener: function(type, listener, useCapture) {
            this._gateway.addEventListener(type, listener, useCapture);
        },
        
        removeEventListener: function(type, listener, useCapture) {
            this._gateway.addEventListener(type, listener, useCapture);
        }
    });
}
