function ReverseHTTP(wsurl) {
	if (typeof(WebSocket) === 'undefined') {
		throw "WebSockets not supported by your browser";
	}
	this._initSocket(wsurl);
	var self = this;
	this._keepAlive = '';
	window.setInterval(function() {
		self._ws.send(self._keepAlive);
	}, 30000);
	
	window.addEventListener('unload', function(event) {
		self._ws.close();
	}, false);
	this._methodHandlers = new MethodHandlers(this);
}

ReverseHTTP.prototype = {
	
	_apps: {},
	
	addEventListener: function(type, listener, useCapture) {
		type = type.toLowerCase();
		if (type.substring(0, 6) == 'socket') {
			this._ws.addEventListener(type.substring(6), listener,
					useCapture);
		} else {
			this._setListener(type, listener, useCapture);
		}
	},
	
	removeEventListener: function(type, listener, useCapture) {
		delete this._removeListener(type.toLowerCase(), listener, useCapture);
	},
	
	dispatchEvent: function(event) {
		if (this._eventListeners.hasOwnProperty(event.type)) {
			var listeners = this._eventListeners[event.type];
			for (var i in listeners) {
				for (var j in listeners[i]) {
					listeners[i][j](event);
				}
			}
		}
	},
	
	_eventListeners: {},
	
	_setListener: function(type, listener, useCapture) {
		var tmp;
		if(typeof(type) == 'undefined' ||
				typeof(listener) == 'undefined' ||
				typeof(useCapture) == 'undefined')
			return;
			
		if(!this._eventListeners.hasOwnProperty(type))
			this._eventListeners[type] = {};
		tmp = this._eventListeners[type];
		if(!tmp.hasOwnProperty(listener))
			tmp[listener] = {};
		tmp[listener][useCapture] = listener;
	},
	
	_removeListener: function(type, listener, useCapture) {
		if(typeof(type) != 'undefined' && typeof(listener) != 'undefined' &&
				typeof(useCapture) != 'undefined' &&
				this._eventListeners.hasOwnProperty(type) &&
				this._eventListeners[type].hasOwnProperty(listener) &&
				this._eventListeners[type][listener].hasOwnProperty(useCapture)) {
			delete this._eventListeners[type][listener][useCapture];
		}
	},
	
	_dispatchEvent: function(type, data) {
		var event = document.createEvent('Event');
		event.initEvent(type, false, false);
		if (typeof(data) != 'undefined')
			event.data = data;
		this.dispatchEvent(event);
	},
	
	_initSocket: function(wsurl) {
		var self = this;
		this._ws = new WebSocket(wsurl);

		this._ws.state = {};

		this._ws.addEventListener('message', function(data) {
				self.parseMsg(data.data);
			}, false);

		this._ws.addEventListener('close', function() {
				delete self._ws;
				self._ws = null;
			}, false);
	},
	
	sendObject: function(data) {
		if (this._ws == null) {
			this._dispatchEvent('error', 'WebSocket is closed!');
			return;
		}
		var json = Object.toJSON(data);
		try {
			this._ws.send(json);
		} catch(e) {
			var self = this;
			this._ws.addEventListener('open', function(e) {
				self.sendObject(data);
				self._ws.removeEventListener('open', this, false);
			}, false);
		}
		this._dispatchEvent('sent', json);
	},
	
	register: function(appName) {
		this.sendObject({
			revhttp: {
				method: 'REGISTER',
				appName: appName
			}
		});
	},
	
	request: function(app) {		
		if (!this._ws.hasOwnProperty('state') || typeof(app) === 'undefined'
				|| !(app instanceof Function))
			return;
		if (typeof(this._ws.state.listening) != 'undefined' && this._ws.state.listening)
			return;
		this._apps[this._ws.state.appName] = {
			handle: app,
			working: false
		};
		this.sendObject({
			revhttp: {
				method: 'REQUEST',
				appName: this._ws.state.appName,
				registrationKey: this._ws.state.registrationKey
			}
		});
	},
	
	requestResponse: function(reqId, appName, request) {
		var self = this;
		var response = { revhttp: {
				method: 'REQUEST-RESPONSE',
				appName: this._ws.state.appName,
				registrationKey: this._ws.state.registrationKey,
				requestId: reqId,
				response: {
					body: '',
					headers: {},
					statusCode: 200,
					send: function() {
						self.sendObject(response);
					}
				}
			}
		};
		this._apps[appName].handle(request, response.revhttp.response);
	},
	
	unrequest: function(application) {
		if (this._ws.hasOwnProperty('state') && this._ws.state.hasOwnProperty('appName'))
			delete this._apps[this._ws.state.appName];
		this.sendObject({
			revhttp: {
				method: 'UNREQUEST',
				appName: this._ws.state.appName,
				registrationKey: this._ws.state.registrationKey
			}
		});
	},
	
	unregister: function(appName) {
		if (this._ws.state.registrationKey != undefined)
			this.sendObject({
				revhttp: {
					method: 'UNREGISTER',
					appName: appName,
					registrationKey: this._ws.state.registrationKey
				}
			});
	},
	
	parseMsg: function(data) {
		var json = data.evalJSON();
		if (!json.hasOwnProperty('revhttp') || !json.revhttp.hasOwnProperty('method')) {
			this._dispatchEvent('error', 'ReverseHTTP server relayed JSON data malformed!');
			return;
		}
		var method = json.revhttp.method;
		if (method in this._methodHandlers &&
				this._methodHandlers[method] instanceof Function)
			this._methodHandlers[method](json);
		else
			this._dispatchEvent('error', 'No handler for method ' +
					method + ' defined.');
	}
};

function MethodHandlers(gateway) {
	this._gateway = gateway;
}

MethodHandlers.prototype = {
	'REGISTER-RESPONSE': function(json) {
		var revhttp = json.revhttp;
		if (revhttp.success === 'true') {
			this._gateway._ws.state = revhttp;
			this._gateway._dispatchEvent('register', {
						registrationKey: revhttp.registrationKey,
						appName: revhttp.appName
					});
			return true;
		}
		return false;
	},
	'REQUEST-RESPONSE': function(json) {
		this._gateway._ws.state.listening = json.revhttp.success === 'true';
		if (this._gateway._ws.state.listening) {
			this._gateway._apps[json.revhttp.appName].working = true;
			this._gateway._dispatchEvent('request', json.revhttp.realPrefix);
		} else {
			this._gateway._dispatchEvent('requesterror', 'Unable to enable the application to start listening to requests');
		}
		return this._gateway._ws.state.listening;

	},
	'REQUEST': function(json) {
		if (json.revhttp.requestId != undefined) {
			this._gateway.requestResponse(json.revhttp.requestId,
					json.revhttp.appName, json.revhttp.request);
			return true;
		} else
			return false;
	},
	'UNREQUEST-RESPONSE': function(json) {
		this._gateway._ws.state.listening = false;
		this._gateway._dispatchEvent('unrequest', revhttp.realPrefix);
		return json.revhttp.success === 'true';
	},
	'UNREGISTER-RESPONSE': function(json) {
		this._gateway._ws.state = {};
		this._gateway._dispatchEvent('unregister', revhttp.realPrefix);
		return json.revhttp.success === 'true';
	}
};
