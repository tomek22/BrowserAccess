Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

var Ci = Components.interfaces;
var Cc = Components.classes;

function HttpServer() {
}

HttpServer.prototype = {
	classDescription: "DOM Accessible Http Server",
	
	classID: Components.ID("{71ecfba5-15cf-457f-9642-4b33f6e9baf5}"),
	
	//nsISupports
	QueryInterface: XPCOMUtils.generateQI([Ci.nsIHttpServerWrapper,
			Ci.nsIClassInfo, Ci.nsISupports]),
			
	//nsIClassInfo
	implementationLanguage: Ci.nsIProgrammingLanguage.JAVASCRIPT,
	
	flags: Ci.nsIClassInfo.DOM_OBJECT | Ci.nsIClassInfo.SINGLETON,
	
	getInterfaces: function getInterfaces(aCount) {
		var array = [Ci.nsIHttpServerWrapper];
		aCount.value = array.length;
		return array;
	},
	
	getHelperForLanguage: function getHelperForLanguage(aLanguage) {
		return null;
	},
	
	//nsIHttpServerWrapper
	get running() {
		return _running;
	},
	
	requestUsage: function(win) {
		//TODO: some sort of security check? black-lists? iframes?
		if (!win || !(win instanceof Ci.nsIDOMWindow))
			return false;
		
		_winReg.add(win.wrappedJSObject);

		var self = this;
		win.addEventListener('unload', function(event) {
			self.unrequestUsage(win);
		}, false);

		if (!_running)
			this._start();
		if (!_running)
			return false;

		return true;
	},
	
	unrequestUsage: function(win) {
		if (!_winReg.remove(win.wrappedJSObject))
			return false;
		if (_winReg.isEmpty())
			this._stop();
		return true;
	},
	
	registerApplication: function(win, appName, app) {
		if(!_winReg.checkReg(win.wrappedJSObject))
			return null;
		var scheme = _server.identity.primaryScheme;
		var host = _server.identity.primaryHost;
		var port = _server.identity.primaryPort;
		var realAppName;
		for (var i = 0; i < 10; i++) {
			realAppName = appName + ((i > 0) ? i : "");
			if (!_server.identity.has(scheme, realAppName, port) &&
					_winReg.putIdentity(win.wrappedJSObject, realAppName))
				break;
		}
		if (i == 10)
			return null;
		
		host = realAppName + "." + host;
		_server.registerIdentityHandler(scheme, host, port,
				unwrapHandlerFunc(app));
		return scheme + "://" + host + ":" + port;
	},
	
	unregisterAppication: function(win, appName) {
		if (!_winReg.removeIdentity(win.wrappedJSObject, identity)) {
			_server.registerPathHandler(path, null);
			return true;
		}
		return false;
	},
	
	registerPathHandler: function(win, path, handler) {
		if (!_winReg.putPath(win.wrappedJSObject, path)) {
			_server.registerPathHandler(path, unwrapHandlerFunc(
					handler));
			return _server.identity.primaryScheme + "://" + 
					_server.identity.primaryHost + ":" +
					_server.identity.primaryPort + path;
		}
		return null;
	},
	
	unregisterPathHandler: function(win, path) {
		if (!_winReg.removePath(win.wrappedJSObject, path)) {
			_server.registerPathHandler(path, null);
			return true;
		}
		return false;
	},
	
	//private API
	_start: function() {
		if (_running)
			return;
		var port = 8081;
		var i = 100;
		while(i-- > 0) {
			try {
				_server.start(port);
				_running = true;
				_port = port;
				break;
			} catch(e) {
				this._win.alert(e);
				port++;
			}
		}
	},
	
	_stop: function() {
		_server.stop(function() {});
		_running = false;
		_port = undefined;
	},
	
	_registerErrorHandler: function(code, handler) {
		_server.registerErrorHandler(code,
				unwrapHandlerFunc(handler));
	},
	
	_registerContentType: function(extension, type) {
		_server.registerContentType(extension, type);
	},
	
	_setIndexHandler: function(handler) {
		_server.setIndexHandler(unwrapHandlerFunc(handler));
	}
};

function HttpRequest(wrappedRequest) {
	this._wrappedRequest = wrappedRequest;
	this._bodyText = null;
}

HttpRequest.prototype = {
	classDescription: "Http Request Wrapper",
	classID: Components.ID("{8d1a112c-adde-4fd7-89a8-e09082a0f81c}"),
	//nsISupports
	QueryInterface: XPCOMUtils.generateQI([Ci.nsIHttpRequestWrapper,
			Ci.nsIClassInfo, Ci.nsISupports]),
	//nsIClassInfo
	implementationLanguage: Ci.nsIProgrammingLanguage.JAVASCRIPT,
	flags: Ci.nsIClassInfo.DOM_OBJECT,
	getInterfaces: function getInterfaces(aCount) {
		var array = [Ci.nsIHttpRequestWrapper];
		aCount.value = array.length;
		return array;
	},
	getHelperForLanguage: function getHelperForLanguage(aLanguage) {
		return null;
	},
	
	//nsIHttpRequestWrapper
	get bodyText() {
		if (!this._wrappedRequest)
			return null;
		if (this._bodyText)
			return this._bodyText;
		var sis = Components.classes
				["@mozilla.org/scriptableinputstream;1"].createInstance(
				Components.interfaces.nsIScriptableInputStream);
		sis.init (this._wrappedRequest.bodyInputStream);
		var av;
		this._bodyText = "";
		while ((av = sis.available()) > 0) {
			this._bodyText += sis.read(av);
		}
		sis.close();
		return this._bodyText;
	},
	
	get url() {
		return this._wrappedRequest.scheme + "://" +
			this._wrappedRequest.host +
			(this._wrappedRequest.port == 80 ? "" :
			(":" + this._wrappedRequest.port)) +
			this._wrappedRequest.path;
	},
	
	get version() {
		return this._wrappedRequest.httpVersion;
	},
	
	get method() {
		return this._wrappedRequest.method;
	},
	
	get queryString() {
		return this._wrappedRequest.queryString;
	},
	
	initWrappedJSObject: function() {
		this.wrappedJSObject = {
			bodyText: this.bodyText,
			url: this.url,
			version: this.version,
			method: this.method,
			queryString: this.queryString,
			headers: {}
		};
		var hEnum = this._wrappedRequest.headers;
		while (hEnum.hasMoreElements()) {
			var key = hEnum.getNext().
					QueryInterface(Ci.nsISupportsString).data;
			this.wrappedJSObject.headers[key] = this._wrappedRequest.
					getHeader(key);
		}
	}
};

function HttpResponse(wrappedResponse) {
	this._wrappedResponse = wrappedResponse;
	this._wrappedResponse.processAsync();
	this._bodyText = "";
}

HttpResponse.prototype = {
	classDescription: "Http Response Wrapper",
	classID: Components.ID("{a5ffe4bd-410b-4131-8f7c-ba0a01ce8aa8}"),
	//nsISupports
	QueryInterface: XPCOMUtils.generateQI([Ci.nsIHttpResponseWrapper,
			Ci.nsIClassInfo, Ci.nsISupports]),
	//nsIClassInfo
	implementationLanguage: Ci.nsIProgrammingLanguage.JAVASCRIPT,
	flags: Ci.nsIClassInfo.DOM_OBJECT,
	getInterfaces: function getInterfaces(aCount) {
		var array = [Ci.nsIHttpResponseWrapper];
		aCount.value = array.length;
		return array;
	},
	getHelperForLanguage: function getHelperForLanguage(aLanguage) {
		return null;
	},
	
	//nsIHttpResponseWrapper
	set status(s) {
		this._wrappedResponse.setStatusLine(null, s, null);
	},
	
	get bodyText() {
		return this._bodyText;
	},
	
	set bodyText(bodyText) {
		this._bodyText = bodyText;
	},
	
	setHeader: function(key, value, merge) {
		this._wrappedResponse.setHeader(key, value, merge);
	},
	
	send: function() {
		if (this.wrappedJSObject) {
			this._bodyText = this.wrappedJSObject.bodyText;
			if (this.wrappedJSObject.status != undefined)
				this.status = this.wrappedJSObject.status;
			if (!this.wrappedJSObject.headers["Content-Length"])
				this.wrappedJSObject.headers["Content-Length"] =
						this._bodyText.length;
			for (var key in this.wrappedJSObject.headers)
				this._wrappedResponse.setHeader(key,
						this.wrappedJSObject.headers[key], true);
		}
		this._wrappedResponse.write(this._bodyText);
		this._wrappedResponse.finish();
	},
	
	initWrappedJSObject: function() {
		this.wrappedJSObject = {
			bodyText: "",
			status: undefined,
			headers: {}
		};
		var unwrapped = this;
		this.wrappedJSObject.send = function() {
			unwrapped.send();
		}
	}
};

function WindowRegistry() {
	this._windowIdObjects = {};
	
	this._windowIdentities = {};
	this._windowPaths = {};
	
	this._identityOwners = {};
	this._pathOwners = {};
	
	this._indCounter = 0;
}

WindowRegistry.prototype = {
	
	add: function(win) {
		if (win._bahsrIdObj && win._bahsrIdObj.ID &&
				this._windowIdObjects[win._bahsrIdObj.ID])
			return false;
		win._bahsrIdObj = {
			ID: ++this._indCounter,
			idObj: {}
		};
		
		this._windowIdentities[win._bahsrIdObj.ID] = {};
		this._windowPaths[win._bahsrIdObj.ID] = {};
		
		this._windowIdObjects[win._bahsrIdObj.ID] = win._bahsrIdObj;

		return true;
	},
	
	remove: function(win) {
		if (!this.checkReg(win))
			return false;
		var identities = this._windowIdentities[win._bahsrIdObj.ID];
		var paths = this._windowPaths[win._bahsrIdObj.ID];
		
		for (var identity in identities)
			delete this._identityOwners[identity];
		for (var path in paths)
			delete this._pathOwners[path];
			
		delete this._windowIdObjects[win._bahsrIdObj.ID];
		delete this._windowIdentities[win._bahsrIdObj.ID];
		delete this._windowPaths[win._bahsrIdObj.ID];
		delete win._bahsrIdObj;
		return true;
	},
	
	isEmpty: function() {
		for (var prop in this._windowIdObjects)
			if (this._windowIdObjects.hasOwnProperty(prop))
				return false;
		return true;
	},
	
	putIdentity: function(win, identity) {
		if (!identity || !this.checkReg(win, this._identityOwners,
				identity))
			return false;
		this._windowIdentities[win._bahsrIdObj.ID][identity] = true;
		this._identityOwners[identity] = win._bahsrIdObj;
		return true;
	},
	
	putPath: function(win, path) {
		if (!path || !this.checkReg(win, this._pathOwners, path))
			return false;
		this._windowPaths[win._bahsrIdObj.ID][path] = true;
		this._pathOwners[path] = win._bahsrIdObj;
		return true;
	},
	
	removeIdentity: function(win, identity) {
		var owner = this._identityOwners[identity];
		if (!owner || owner != win._bahsrIdObj)
			return false;
		delete this._identityOwners[identity];
		delete this._windowIdentities[win._bahsrIdObj.ID][identity];
		return true;
	},
	
	removePath: function(win, path) {
		var owner = this._pathOwners[path];
		if (!owner || owner != win._bahsrIdObj)
			return false;
		delete this._pathOwners[path];
		delete this._windowPaths[win._bahsrIdObj.ID][path];
		return true;
	},
	
	checkReg: function(win, dict, key) {
		if (!win || !win._bahsrIdObj || !win._bahsrIdObj.ID || !this.
				_windowIdObjects[win._bahsrIdObj.ID] || win._bahsrIdObj.idObj
				!= this._windowIdObjects[win._bahsrIdObj.ID].idObj)
			return false;
		return (dict && key && dict[key]) ? dict[key].idObj ===
				win._bahsrIdObj.idObj : true;
	}
};

function unwrapHandlerFunc(handler) {
	return function(wrappedRequest, wrappedResponse) {
		handler.handle(new HttpRequest(wrappedRequest),
				new HttpResponse(wrappedResponse));
	};
}

var _server = Cc["@mozilla.org/server/jshttp;1"].
			getService(Ci.nsIHttpServer);
var _port = undefined;
var _running = false;
var _winReg = new WindowRegistry();

var NSGetFactory = XPCOMUtils.generateNSGetFactory([HttpServer, 
		HttpRequest, HttpResponse]);
