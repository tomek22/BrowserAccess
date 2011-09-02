package hr.fer.zemris.revhttp.gateway.websockets;

import hr.fer.zemris.revhttp.gateway.resources.GatewayResources;
import hr.fer.zemris.revhttp.gateway.websockets.utils.RevHttpJSON;

import java.io.IOException;
import java.util.HashSet;
import java.util.Set;

import javax.servlet.http.HttpServletRequest;

import org.eclipse.jetty.util.ajax.JSON;
import org.eclipse.jetty.websocket.WebSocket;
import org.eclipse.jetty.websocket.WebSocketServlet;

/**
 * @author tomek
 */
public class ServerInterfaceServlet extends WebSocketServlet {

	private static final long serialVersionUID = 1L;

	private Set<WebSocket> connections = new HashSet<WebSocket>();

	@Override
	public WebSocket doWebSocketConnect(HttpServletRequest request,
			String protocol) {
		return new ServerInterfaceSocket(request);
	}
	
	@Override
	public String getInitParameter(String name) {
		if (name.equals("bufferSize"))
			return "263000";
		return super.getInitParameter(name);
	}

	public class ServerInterfaceSocket implements WebSocket.OnTextMessage {

		private Connection outbound;
		private String serverProtocol = null;
		private String serverName = null;
		private int serverPort;

		public ServerInterfaceSocket(HttpServletRequest request) {
			this.serverProtocol = request.getProtocol();
			this.serverProtocol = this.serverProtocol.substring(0,
					this.serverProtocol.indexOf('/')).toLowerCase();
			this.serverName = request.getServerName();
			this.serverPort = request.getServerPort();
		}

		public String getServerProtocol() {
			return serverProtocol;
		}

		public String getServerName() {
			return serverName;
		}

		public int getServerPort() {
			return serverPort;
		}

		@Override
		public void onOpen(Connection outbound) {
			this.outbound = outbound;
			connections.add(this);
		}

		@Override
		public void onClose(int closeCode, String message) {
//			System.out.println("disconnect");
			GatewayResources.deleteSocket(this);
			connections.remove(this);
		}

		@Override
		public void onMessage(String data) {
//			System.out.println(outbound.hashCode());
//			System.out.println("rec: " + data);
			Object responseObj = RequestHandler.parseRequest(
					JSON.parse(data), this);
			if (responseObj != null)
				try {
					String response = JSON.toString(responseObj);
//					System.out.println("sent: " + response);
					outbound.sendMessage(response);
				} catch (IOException e) {
					e.printStackTrace();
				}
		}

		public void relayRequest(String requestId, String appName) {
			try {
				RevHttpJSON result = new RevHttpJSON("REQUEST");
				result.setRegistrationKey(GatewayResources
						.getResourceUUID(appName));
				result.setAppName(appName);
				result.setRequestId(requestId);
				result.setRealPrefix(appName, serverProtocol, serverName,
						serverPort);
				result.setRequest(requestId);
				outbound.sendMessage(JSON.toString(result));
			} catch (IOException e) {
				e.printStackTrace();
			}
		}
	}
}
