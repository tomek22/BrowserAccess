var AccessType = {
    NONE: 'No Remote Access Enabled',
    SERVER_EXTENSION: 'Remote Access Enabled Using Firefox Extension',
    REVERSE_HTTP: 'Remote Access Enabled Using ReverseHTTP service'
};

function ReverseHttpServiceAdapter(prototype) {
    this.prototype = prototype;
    if (!this.checkAdapter()) 
        throw "Malformed ReverseHttpServiceAdapter member data";
}

ReverseHttpServiceAdapter.prototype = {
    checkAdapter: function() {
        var functions = [this.prototype.init, this.prototype.registerApplication, this.prototype.unregisterApplication];
        for (var i = 0; i < functions.length; i++) {
            if (!(functions[i] instanceof Function)) 
                return false;
        }
        return true;
    }
};

var ReverseHttpServiceAdapters = {
    _adapters: [],
    
    addAdapter: function(adapter) {
        if (typeof(adapter) == 'undefined') 
            return false;
        if (!(adapter instanceof ReverseHttpServiceAdapter)) 
            adapter = new ReverseHttpServiceAdapter(adapter);
        if (adapter.checkAdapter()) {
            var Adapter = function() {
            }
            Adapter.prototype = adapter.prototype;
            this._adapters.push(Adapter);
            return true;
        }
        return false;
    },
    
    getAdapterCount: function() {
        return this._adapters.length;
    },
    
    getAdapter: function(i) {
        return new this._adapters[i]();
    }
};

function BrowserAccess(ignoreExtension) {

    this.type = AccessType.NONE;
    
    ignoreExtension = typeof(ignoreExtension) != 'undefined' ? ignoreExtension : false;
    if (!ignoreExtension && typeof(HttpServer) != 'undefined' &&
    HttpServer instanceof
    Components.interfaces.nsIHttpServerWrapper &&
    HttpServer.requestUsage(window)) {
        this.type = AccessType.SERVER_EXTENSION;
        
        this.registerApplication = function(appName, app, eventListeners) {
			var handler = {
				app: app,
				
				handle: function(request, response) {
					request.initWrappedJSObject();
					response.initWrappedJSObject();
					this.app.handle(request.wrappedJSObject, response.wrappedJSObject);
				}
			}
            uri = HttpServer.registerApplication(window, appName, handler);
            if (uri == null) 
                throw "Application not registered!";
            if (app instanceof Application) 
                app.setUrl(uri);
            
            if (typeof(eventListeners) != 'undefined') {
                for (var i in eventListeners) {
                    var tmp = eventListeners[i];
                    if ('on' === i.substring(0, 2).toLowerCase()) {
                        delete eventListeners[i];
                        eventListeners[i.substring(2).toLowerCase()] = tmp;
                    }
                }
                if (uri == null) {
                    if (eventListeners.hasOwnProperty('error')) 
                        eventListeners['error']({
                            data: 'Application failed to register'
                        });
                }
                else if (eventListeners.hasOwnProperty('register')) {
                    eventListeners['register']({
                        data: uri
                    });
                }
            }
        };
        
        this.unregisterApplication = function(appName) {
            return HttpServer.unregisterApplication(window, appName);
        };
    }
    else {
        for (var i = 0; i < ReverseHttpServiceAdapters.getAdapterCount(); i++) {
            this._adapter = ReverseHttpServiceAdapters.getAdapter(i);
            this.init = function() {
                return this._adapter.init();
            };
            if (this.init()) {
                this.type = AccessType.REVERSE_HTTP;
                this.registerApplication = function(appName, app, eventListener) {
                    this._adapter.registerApplication(appName, app, eventListener);
                };
                this.unregisterApplication = function(appName) {
                    this._adapter.unregisterApplication(appName);
                };
                if ('addEventListener' in this._adapter) {
                    this.addEventListener = function(type, listener, useCapture) {
                        this._adapter.addEventListener(type, listener, useCapture);
                    };
                }
                if ('removeEventListener' in this._adapter) {
                    this.removeEventListener = function(type, listener, useCapture) {
                        this._adapter.removeEventListener(type, listener, useCapture);
                    };
                }
                break;
            }
        }
    }
}

BrowserAccess.wrapHandler = function(handler) {
    if (typeof(handler) === 'undefined') 
        return null;
    if (handler instanceof Application) 
        return function(request, response) {
            handler.handle(request, response);
        };
    else if (this.type === AccessType.SERVER_EXTENSION) 
        return function(request, response) {
            request.initWrappedJSObject();
            response.initWrappedJSObject();
            handler(request.wrappedJSObject, response.wrappedJSObject);
        };
    else 
        return handler;
};

function PathTreeNode(pathNodes, handler) {
    this._children = {};
    if (typeof(pathNodes) == 'undefined' ||
    typeof(handler) ==
    'undefined' ||
    !(pathNodes instanceof Array)) 
        return false;
    
    if (pathNodes.length == 0) {
        this._handler = handler;
        return true;
    }
    var pathNode = pathNodes.shift();
    this._children[pathNode] = new PathTreeNode(pathNodes, handler);
}

PathTreeNode.prototype = {
    addResource: function(pathNodes, resource) {
        if (typeof(pathNodes) === 'undefined' ||
        typeof(resource) ===
        'undefined' ||
        !(pathNodes instanceof Array)) 
            return false;
        if (pathNodes.length == 0) {
            this._handler = this._getHandlerAsFunction(resource);
            return true;
        }
        var pathNode = pathNodes.shift();
        var child = this._children[pathNode];
        if (!(child instanceof PathTreeNode)) {
            this._children[pathNode] = new PathTreeNode(pathNodes, this._getHandlerAsFunction(resource));
            return true;
        }
        else {
            return child.addResource(pathNodes, resource);
        }
    },
    
    getResource: function(pathNodes, root) {
        if (typeof(root) == 'undefined') 
            root = true;
        
        if (pathNodes.length == 0) {
            if (typeof(this._handler) != 'undefined') 
                return this._handler;
            else if (typeof(this._children['*']) != 'undefined') 
                return this._children['*']._handler;
            else 
                return undefined;
        }
        
        var pathNode = pathNodes.shift();
        
        if (this._children[pathNode] instanceof PathTreeNode) {
            var deep = this._children[pathNode].getResource(pathNodes, false);
            if (typeof(deep) != 'undefined') 
                return deep;
        }
        if (typeof(this._children['*']) != 'undefined') 
            return this._children['*']._handler;
        return this._handler;
    },
    
    _getHandlerAsFunction: function(resource) {
        if (resource instanceof Application) 
            return function(request, response) {
                resource.handle(request, response);
            }
        else 
            return resource;
    }
};

function Application(rootHandler) {
    if (typeof(rootHandler) == 'undefined' ||
    !(rootHandler instanceof
    Function)) 
        rootHandler = this._defaultHandler;
    this._pathTree = new PathTreeNode([], rootHandler);
}

Application.prototype = {

    handle: function(request, response) {
        if (!this.hasOwnProperty('_url')) {
            this._defaultErrors[500](request, response, 'Application url not set!');
            return;
        }
        var path = request.url.substr(this._url.length);
        var handler = this._pathTree.getResource(this._splitPath(path));
        if (typeof(handler) != 'undefined') 
            handler(request, response);
        else 
            this._defaultErrors[404](request, response);
    },
    
    addResource: function(path, handler) {
        var pathTokens = this._splitPath(path);
        var fixedPath = pathTokens.join('/');
        var h = handler instanceof Application ? function(request, response) {
            handler.handle(request, response);
        }
 : handler;
        if (this._pathTree.addResource(pathTokens, h)) {
            return ((typeof(this._url) != 'undefined') ? this._url : '') +
            '/' +
            fixedPath;
        }
        else 
            return undefined;
    },
    
    setUrl: function(url) {
        this._url = url;
    },
    
    _splitPath: function(path) {
        var pathNodes = path.split('/');
        if (pathNodes.length > 0 && pathNodes[0].length == 0) 
            pathNodes.shift();
        if (pathNodes.length > 0 &&
        pathNodes[pathNodes.length - 1].length ==
        0) 
            pathNodes.pop();
        return pathNodes;
    },
    
    _defaultHandler: function(request, response) {
        response.bodyText = 'Generic Application response';
        response.setHeader('Content-Length', response.bodyText.length, false);
        response.send();
    },
    
    _defaultErrors: {
        404: function(request, response) {
            response.status = 404;
            response.setHeader("Content-Type", "text/html", false);
            
            response.bodyText = "<html>\
				<head><title>404 Not Found</title></head>\
				<body>\
					<h1>404 Not Found</h1>\
					<p>\
						<span style='font-family: monospace;'>" +
            request.path +
            "</span> was not found.\
					</p>\
				</body>\
			</html>";
            response.setHeader('Content-Length', response.bodyText.length, false);
            response.send();
        },
        
        500: function(request, response, error) {
            response.status = 500;
            response.setHeader("Content-Type", "text/html", false);
            
            response.bodyText = "<html>\
				<head><title>Internal Server Error" +
            ((typeof(error) != 'undefined') ? (': ' + error) : '') +
            "</title></head>\
				<body>\
					<h1>404 Not Found</h1>\
					<p>\
						<span style='font-family: monospace;'>" +
            request.path +
            "</span> was not found.\
					</p>\
				</body>\
			</html>";
            response.setHeader('Content-Length', response.bodyText.length, false);
            response.send();
        }
    }
};
