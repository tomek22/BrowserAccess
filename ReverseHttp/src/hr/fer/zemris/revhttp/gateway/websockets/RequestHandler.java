package hr.fer.zemris.revhttp.gateway.websockets;

import hr.fer.zemris.revhttp.gateway.resources.GatewayResources;
import hr.fer.zemris.revhttp.gateway.websockets.ServerInterfaceServlet.ServerInterfaceSocket;
import hr.fer.zemris.revhttp.gateway.websockets.utils.RevHttpJSON;

import java.io.IOException;
import java.util.HashMap;
import java.util.Map;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import org.eclipse.jetty.continuation.Continuation;
import org.eclipse.jetty.continuation.ContinuationSupport;
import org.eclipse.jetty.server.Server;

/**
 * @author tomek
 */
public class RequestHandler {

	private static final Map<String, Command> requestCommands;

	static {
		requestCommands = new HashMap<String, Command>();
		requestCommands.put("REGISTER", new Command() {

			@Override
			public Object processJSON(Object json) {
				String appName = (String) RevHttpJSON.getElement(json,
						"appName");
				Long variation = (Long) RevHttpJSON.getElement(json,
						"variation");

				String requestKey = (String) RevHttpJSON.getElement(json,
						"requestKey");

				String uuid = GatewayResources.registerApplication(appName,
						variation);

				RevHttpJSON result = new RevHttpJSON("REGISTER-RESPONSE");

				if (uuid != null) {
					appName = GatewayResources.getUUIDResource(uuid);
					GatewayResources.addResource(appName,
							getResponsibleSocket());
					result.setSuccess(true);
					result.setAppName(appName);
					result.setRegistrationKey(uuid);
					result.setRequestKey(requestKey);
				} else {
					result.setSuccess(false);
				}

				return result;
			}

		});
		requestCommands.put("REQUEST", new Command() {

			@Override
			public Object processJSON(Object json) {
				String appName = (String) RevHttpJSON.getElement(json,
						"appName");
				String uuid = (String) RevHttpJSON.getElement(json,
						"registrationKey");

				RevHttpJSON result = new RevHttpJSON("REQUEST-RESPONSE");
				boolean isValid = GatewayResources.isValidUUID(appName, uuid);

				result.setSuccess(isValid);
				result.setAppName(appName);
				result.setRealPrefix(appName, who.getServerProtocol(),
						who.getServerName(), who.getServerPort());
				result.setRegistrationKey(uuid);
				return result;
			}

		});
		requestCommands.put("REQUEST-RESPONSE", new Command() {

			@SuppressWarnings("unchecked")
			@Override
			public Object processJSON(Object json) {
				String reqId = (String) RevHttpJSON.getElement(json,
						"requestId");
				Map<Object, Object> responseObject = (Map<Object, Object>) ((Map<Object, Object>) ((Map<Object, Object>) json)
						.get("revhttp")).get("response");

				HttpServletRequest request = ProxyServlet.requestMap.remove(reqId);
				HttpServletResponse response = ProxyServlet.responseMap.remove(reqId);

				if (request == null) {
					System.err
							.println("OoOoops! no request saved! Embarrassing :(");
					return null;
				} else if (response == null) {
					System.err
							.println("OoOoops! no response saved! Embarrassing :(");
					ContinuationSupport.getContinuation(request).complete();
					return null;
				}

				Continuation continuation = null;

				try {
					Map<Object, Object> headers = (Map<Object, Object>) responseObject
							.get("headers");

					continuation = ContinuationSupport.getContinuation(request);
					for (Object header : headers.keySet()) {
						response.setHeader((String) header, headers.get(header)
								.toString());
					}
					String server = (String) headers.get("Server");
					if (server == null) {
						server = "Unknown browser server";
					}
					response.setHeader("Server",
							server + " via Jetty" + Server.getVersion());
					String body = (String) responseObject.get("body");
					if (body != null)
						response.getWriter().write(body);
					response.setStatus(((Long) responseObject.get("statusCode"))
							.intValue());

				} catch (IOException e) {
					((HttpServletResponse) continuation.getServletResponse())
							.setStatus(500);
				} catch (Exception e) {
					e.printStackTrace();
				} finally {
					if (!continuation.isExpired())
						continuation.complete();
				}
				return null;
			}

		});
		requestCommands.put("UNREQUEST", new Command() {

			@Override
			public Object processJSON(Object json) {
				String appName = (String) RevHttpJSON.getElement(json,
						"appName");
				String uuid = (String) RevHttpJSON.getElement(json,
						"registrationKey");

				RevHttpJSON result = new RevHttpJSON("UNREQUEST-RESPONSE");
				result.setSuccess(GatewayResources.removeResource(appName));
				result.setAppName(appName);
				result.setRegistrationKey(uuid);

				return result;
			}

		});
		requestCommands.put("UNREGISTER", new Command() {

			@Override
			public Object processJSON(Object json) {
				String appName = (String) RevHttpJSON.getElement(json,
						"appName");
				String uuid = (String) RevHttpJSON.getElement(json,
						"registrationKey");
				boolean isValid = GatewayResources.isValidUUID(appName, uuid);
				if (isValid)
					GatewayResources.unregisterApplication(appName);

				RevHttpJSON result = new RevHttpJSON("UNREGISTER-RESPONSE");
				result.setAppName(appName);
				result.setRegistrationKey(uuid);
				result.setSuccess(isValid);
				return result;
			}

		});
	}

	public static Object parseRequest(Object request, ServerInterfaceSocket who) {
		Command cmd = requestCommands.get(RevHttpJSON.getElement(request,
				"method"));
		if (cmd == null)
			return null;
		return cmd.processJSON(request, who);
	}

	/**
	 * Protocol message handler. Each message method has it's Command object
	 * responsible for it's
	 * 
	 * @author tomek
	 */
	public static abstract class Command {
		protected ServerInterfaceSocket who;

		public abstract Object processJSON(Object json);

		public Object processJSON(Object json, ServerInterfaceSocket who) {
			this.who = who;
			return processJSON(json);
		}

		public ServerInterfaceSocket getResponsibleSocket() {
			return who;
		}
	}
}
