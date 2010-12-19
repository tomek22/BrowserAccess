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
	protected WebSocket doWebSocketConnect(HttpServletRequest request,
			String protocol) {
		return new ServerInterfaceSocket(request);
	}

	public class ServerInterfaceSocket implements WebSocket {

		private Outbound outbound;
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
		public void onConnect(Outbound outbound) {
			this.outbound = outbound;
			connections.add(this);
		}

		@Override
		public void onDisconnect() {
			GatewayResources.deleteSocket(this);
			connections.remove(this);
		}

		@Override
		public void onMessage(byte frame, String data) {
			Object responseObj = RequestHandler.parseRequest(
					JSON.parse(data), this);
			if (responseObj != null)
				try {
					String response = JSON.toString(responseObj);
					outbound.sendMessage(frame, response);
				} catch (IOException e) {
					e.printStackTrace();
				}
		}

		@Override
		public void onMessage(byte frame, byte[] data, int offset,
				int length) {
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
				outbound.sendMessage((byte) 0, JSON.toString(result));
			} catch (IOException e) {
				e.printStackTrace();
			}
		}

		@Override
		public void onFragment(boolean arg0, byte arg1, byte[] arg2,
				int arg3, int arg4) {
		}
	}
}
