var AccessType = {
	NONE : 'No Remote Access Enabled',
	SERVER_EXTENSION : 'Remote Access Enabled Using Firefox Extension',
	REVERSE_HTTP : 'Remote Access Enabled Using ReverseHTTP service'
};

function ReverseHttpServiceAdapter(init, registerApplication,
		unregisterApplication) {
	this.init = init;
	this.registerApplication = registerApplication;
	this.unregisterApplication = unregisterApplication;
}

ReverseHttpServiceAdapter.prototype = {
	checkAdapter: function() {
		var functions = [this.init, this.registerApplication,
				this.unregisterApplication];
		for (var i in functions) {
			if (!(functions[i] instanceof Function))
				return false;
		}
		return true;
	}
};

var ReverseHttpServiceAdapters = {
	addAdapter: function(adapter) {
		if (adapter instanceof ReverseHttpServiceAdapter &&
				adapter.checkAdapter()) {
			if (typeof(this._adapters) == 'undefined')
				this._adapters = [];
			this._adapters.push(adapter);
			return true;
		}
		return false;
	},
	
	getAdapter: function() {
		if (typeof(this._adapters) == 'undefined' ||
				this._adapters.length == 0)
			return null;
		return this._adapters.shift();
	}
};

var BrowserAccess = new function() {
	this.type = AccessType.NONE;
	this.init = function() {
		if (typeof(HttpServer) != 'undefined' && HttpServer instanceof
				Components.interfaces.nsIHttpServerWrapper &&
				HttpServer.requestUsage(window)) {
			this.type = AccessType.SERVER_EXTENSION;
			
			this.registerApplication = function(appName, app) {
				var ret = HttpServer.registerApplication(window,
						appName, wrapHandler(app));
				if (ret != null && app instanceof Application)
					app._url = ret;
				return ret;
			};
			
			this.unregisterApplication = function(appName) {
				return HttpServer.unregisterApplication(window,
						appName);
			};
		} else {
			var adapter = ReverseHttpServiceAdapters.getAdapter();
			while (adapter) {
				if (adapter.init()) {
					this.type = AccessType.REVERSE_HTTP;
					break;
				} else
					adapter = ReverseHttpServiceAdapters.getAdapter();
			}
		}
	};
};

function PathTreeNode(pathNodes, handler) {
	this._children = {};
	if (typeof(pathNodes) == 'undefined' || typeof(handler) ==
			'undefined' || !(pathNodes instanceof Array))
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
		if (typeof(pathNodes) == 'undefined' || typeof(resource) ==
				'undefined' || !(pathNodes instanceof Array))
			return false;
		if (pathNodes.length == 0) {
			this._handler = this._getHandlerAsFunction(resource);
			return true;
		}
		var pathNode = pathNodes.shift();
		var child = this._children[pathNode];
		if (!(child instanceof PathTreeNode)) {
			this._children[pathNode] = new PathTreeNode(pathNodes,
					this._getHandlerAsFunction(resource));
			return true;
		} else {
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
			var deep = this._children[pathNode].getResource(pathNodes,
					false);
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
	if (typeof(rootHandler) == 'undefined' || !(rootHandler instanceof
			Function))
		rootHandler = this._defaultHandler;
	this._pathTree = new PathTreeNode([], rootHandler);
}

Application.prototype = {
	
	handle: function(request, response) {
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
		if (this._pathTree.addResource(pathTokens, wrapHandler(handler))) {
			return ((typeof(this._url) != 'undefined') ? this._url : '')
					+ '/' + fixedPath;
					
		} else
			return undefined;
	},
	
	_splitPath: function(path) {
		var pathNodes = path.split('/');
		if (pathNodes.length > 0 && pathNodes[0].length == 0)
			pathNodes.shift();
		if (pathNodes.length > 0 && pathNodes[pathNodes.length - 1].
				length == 0)
			pathNodes.pop();
		return pathNodes;
	},
	
	_defaultHandler: function(request, response) {
		response.bodyText = 'Generic Application response';
		response.setHeader('Content-Length', response.bodyText.length,
				false);
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
						<span style='font-family: monospace;'>"
							+ request.path +
						"</span> was not found.\
					</p>\
				</body>\
			</html>";
			response.setHeader('Content-Length', response.bodyText.
					length, false);
			response.send();
		}
    }
};

function wrapHandler(handler) {
	if (typeof(handler) != 'undefined' && handler instanceof Application)
		return function(request, response) {
			handler.handle(request, response);
		};
	else
		return function(request, response) {
			request.initWrappedJSObject();
			response.initWrappedJSObject();
			handler(request.wrappedJSObject,
					response.wrappedJSObject);
		};
}
