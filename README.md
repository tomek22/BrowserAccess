#BrowserAccess
Welcome to the BrowserAccess wiki!
BrowserAccess is a collection of tools for enabling remote access to users processes in a Web browser. It currently contains a HTTP server Mozilla Firefox extension, [[ReverseHTTP|http://reversehttp.net/]] implementation server in Jetty and a JavaScript library which allows transparent usage of the server extension or ReverseHTTP services. The library can be configured to use a different ReverseHTTP implementation, but then an adapter for that service must be implemented

##Motivation
TODO:

##HTTP server Firefox extension
The extension contains a slightly modified [[HTTP server for unit tests|https://developer.mozilla.org/En/Httpd.js/HTTP_server_for_unit_tests]]. A limited API to the server is created and exposed to the DOM. This provides Web applications an option to register them selfs to the built-in HTTP server thus enabling asynchronous message exchange between Web servers and clients-browsers effectively making them peers. It also enables message exchange between clients without the need for a specialized intermediate Web server.

**NOTE**: The extension only works with Firefox 4.0 beta because the HTTP server for unit tests uses some of the new features available only in Gecko 2.0

###HTTP server extension installation
In order to install this extension you must have Mozilla Firefox 4.0 beta installed on your system. You can find the installation for your system in [[Firefox nightly build trunk directory|http://ftp.mozilla.org/pub/mozilla.org/firefox/nightly/latest-trunk/]]. After you successfully installed Firefox 4.0 nightly build, you can install the extension following these simple steps:

1. Download the project source from this repository and place it somewhere on your file system. The extension is placed in the folder named *browseraccess@fer.hr*.

2. It is recommended you create a new Firefox profile to avoid mixing your exsisting extensions for current Firefox release with the Firefox beta since it probably won't support any of the current extensions and will cause reinstallation of all extensions every time you switch from beta to stable release and vice versa. To learn how to manage profiles in Firefox, follow this [[link|http://support.mozilla.com/en-US/kb/Managing%20profiles]]

3. Go to the extensions directory of the Firefox profile you want to install the extension to (example: *~/.mozilla/firefox/dev/extensions*, here, a profile called *dev* is being used)

4. Create a new text file and title it *browseraccess@fer.hr*. Inside it, paste the path to where you saved the extension folder (example *~/workspace/BrowserAccess/browseraccess@fer.hr*)

5. Start Firefox beta with the selected profile using flags *-P "[PROFILE_NAME]"* and *-no-remote* (example: */path/to/firefox-beta/installation/firefox %u -P "dev" -no-remote*)

###HTTP server API
The limited server API is available in the DOM via JavaScript object *HttpServer*.
Here's the definition of the limited server API exposed to the DOM:

```js
interface nsIHttpServerWrapper : nsISupports {
	readonly attribute boolean running;

	boolean requestUsage(in nsIDOMWindow window);
	boolean unrequestUsage(in nsIDOMWindow window);

	string registerPathHandler(in nsIDOMWindow window, in string path, in nsIHttpRequestHandlerWrapper handler);
	boolean unregisterPathHandler(in nsIDOMWindow window, in string path);

	string registerApplication(in nsIDOMWindow window, in string appName, in nsIHttpRequestHandlerWrapper app);
	boolean unregisterApplication(in nsIDOMWindow window, in string appName);
};
```

Each window that wants to use the server must call *requestUsage* function. That function registers the window to the inner extension structures so that the window can register path handlers and applications. After the window is closed, function *unrequestUsage* is automatically called which deletes all the resources registered by the window.

The API gives users 2 methods of registering resources to the server:

1. registerPathHandler: A path handler is a resource that is mapped to a single path on the server. Say your servers URL is *http://host.com*. If you register a resource to that server like so: `HttpServer.registerPathHandler(window, 'path', function(req, resp) {...})`, your resource will be available only on *http://host.com/path*, but e.g. *http://host.com/path/bla* will not be mapped to your resource. Function *registerPathHandler* returns the URL the resource is mapped to. If the path is already mapped to a resource registered by another window, the function returns null.

2. registerApplication: An application is a resource that maps to a domain. A subdomain of the original servers domain is created and mapped to the registered resource. Subdomain is created using the provided *appName* argument. e.g. given the same servers URL as in previous example, calling `HttpServer.registerApplication(window, 'app', function(req, resp) {...})` will try to map the provided resource function to the domain *app.host.com* If that domain is already mapped to an application not registered by our window, an alternate domain will be created (app1.host.com or app2.host.com and so on). All the requests sent to that domain will be processed by the registered resource function which can afterwards delegate processing for different paths to other functions. The function *registerApplication* returns the URL on which the application can be accessed. In this case, it is most likely to return *http:/app.host.com*. Applications provide better security then path handlers since each application is given its own domain enabling SOP checks.

**NOTE**: Since this is an experimental project, some limitations must be considered. It is currently not possible to easily register an application which will be globally addressable on the Web. There are 2 problems preventing this:

1. Most Internet users are using a shared Internet connection which means they don't have globally unique IP addresses. These users must bypass their routers [[NAT|http://en.wikipedia.org/wiki/Network_address_translation]] process. There are several ways to do this. The easiest would be to manually forward a port on the router to users local port on which the server is running. Another way to bypass NAT is to use [[NAT traversal|http://en.wikipedia.org/wiki/NAT_traversal]] techniques. These can be implemented programmatically.

2. Even if the server can be globally addressed on the Internet, we still need to assign a domain to it. This is not easy, because we need that process to be automatic, and the domain to be a [[wildcard|http://en.wikipedia.org/wiki/Wildcard_DNS_record]] record.

NAT traversal and domain fetching is currently not implemented, so for now, everything works only on localhost. All the domains for the registered applications must be manually added to the operating systems hosts file. For example, if you want to register an application called app, you must add this line to your systems hosts file (*/etc/hosts* on linux):
127.0.0.1	app.localhost

Both the application and path handler implement the same interface - *nsIHttpRequestHandlerWrapper*:

```js
interface nsIHttpRequestHandlerWrapper : nsISupports {
	void handle(in nsIHttpRequestWrapper request, in nsIHttpResponseWrapper response);
};
```

Here's an example of a simple request handler defined in JavaScript implementing the above interface:

```js
function handler(request, response) {
	response.bodyText = 'Some response text';
	response.send();
}
```

Parameter request implements the *nsIHttpRequestWrapper* interface:

```js
interface nsIHttpRequestWrapper : nsISupports {
	readonly attribute string bodyText;
	readonly attribute string url;
	readonly attribute string version;
	readonly attribute string method;
	readonly attribute string queryString;

	string getHeader(in string key);

	void initWrappedJSObject();
};
```

This interface is pretty much self-explanatory, so I won't analyze it in great detail. Only thing worth explaining is the *initWrappedJSObject* function. This function initializes a JavaScript object called wrappedJSObject and places it in the request object. Object wrappedJSObject contains all the attributes of the original object, but also contains the *headers* attribute. This can be useful in handler function wrappers if one wants to more simply read/write headers  in handler functions.

The *initWrappedJSObject* function is a by-product of [[XPCOM|https://developer.mozilla.org/en/XPCOM]] implementation. Server wrapper is implemented as a XPCOM component. Eeven though the component is implemented in JavaScript, it must fully comply with the provided [[XPIDL|https://developer.mozilla.org/en/XPIDL]] interface definition. Since XPCOM objects can be implemented in several programming languages, the interface is inevitably somewhat limited. In this particular situation, I needed the request object in JavaScript to contain a header map implemented as a plain JavaScript Object. Unfortunately, XPCOM limits interface attributes to raw types such as int, long, short, string, and other previously defined XPIDL interfaces. Since JavaScript is a loosely typed language, Objects can represent virtually anything. This doesn't play well with XPCOM. Therefore, function *initWrappedJSObject* creates a plain JavaScript object containing all the attributes defined in the request interface, as well as a new attribute called headers. The headers attribute is filled with all the request header elements. This wrapped request object is stored in the *wrappedJSObject* member of the original request.

Response implements *nsIHttpResponseWrapper*:

```js
interface nsIHttpResponseWrapper : nsISupports {
	attribute string bodyText;
	attribute unsigned short status;

	void setHeader(in string key, in string value, in boolean merge);
	void send();

	void initWrappedJSObject();
};
```

Similarly as with request, the response interface also contains the *initWrappedJSObject* function. The only difference here is that an empty headers object is created. The handler function can put header values into the empty headers object. After the response has been sent, all the header values will be forwarded to the underlying header map in the XPCOM response component.

##ReverseHTTP

##JavaScript library

The JavaScript library provides a simple to use set of tools for enabling access to user processes in a Web browser. The library detects if the HTTP server extension is installed. If it is, it uses it as a primary method for enabling remote access to the browser. If it's not, it checks if any ReverseHTTP service adapters are registered. If there are, it tries to connect to them one at a time. After the first connection has been established, the process ends.
The library also adds a new level of abstraction to the *HttpServer* object if it is even being used. It makes it easier to use the server without worrying about the window registration and permissions. It also automatically wraps the registered JavaScript handler functions, so that headers members in request and response objects can be used in the handler functions.

###JavaScript library API

The library produces a JavaScript object named *BrowserAccess*. Initially, *BrowserAccess* only contains a type member variable and an init member function. Variable type is a string describing *BrowserAccess* object state. It enables users to see whether remote access is enabled or not, and if it is, is it using the extension, or ReverseHTTP service. Function *init* initializes the *BrowserAccess* object. It finds the best available remote access method, and creates 2 additional member functions: *registerApplication* and *unregisterApplication*.

Library also defines a helper class for application definition. The class is named *Appication*. Public API for this class consists of only one member function named *addResource*. This function can be used to register path handlers to the application. The difference between these path handlers, and the ones that can be registered directly to the server is in path mapping. In the server, handlers are mapped to paths one to one. This means that one handler can handle only the requests sent to a specific path. In the application class, path can represent a subspace of the servers uri addressing space. For example, handler registered to path */path/\** handles not only the requests sent to */path/\**, but also requests sent to */path/a*, */path/b*, */path/c/aaa*, and so on. This concept is borrowed from javax.servlet containers. More details can be found on the [[Jetty project Web site|http://account.pacip.com/jetty/doc/PathMapping.html]].

##Example application
A simple demo application can be found [[here|https://github.com/tomek22/BrowserAccess/blob/master/html/demo.html]]
Even though this demo is pretty simple, here's an example of an even simpler application:
```html
<!doctype html>
<html>
<head>
	<meta http-equiv="content-type" content="text/html; charset=UTF-8" />
	<meta http-equiv="content-style-type" content="text/css" />
	<title>Less complicated demo</title>
	<script type="text/javascript" src="scripts/browser_access_library.js"></script>
	<script type="text/javascript">
		BrowserAccess.init();
		var app = new Application();
		BrowserAccess.registerApplication('app', app);		//returns 'http://app.localhost:8081'
		app.addResource('/bla/*',
			function(request, response) {
				response.bodyText = 'This is resource /bla. You have\
						requested a page on the path ' + request.url +
						'. Your request processing has been delegated\
						to this handler function since the path in url you\
						requested starts with "/bla/" or is exactly "/bla".';
				response.headers['Content-Length'] = response.bodyText.length;
				response.send(); 
			});
	</script>
</head>
<body>
</body>
</html>
```
This demo application will register only one handler function. All the requests sent to URIs that start with *http://app.localhost:8081/bla/* will be processed by the registered handler. All other requests sent to this domain will be processed by a default handler defined in the JavaScript library. That default handler can be overriden by a user defined function. This function must be sent as a parameter to the Application constructor
