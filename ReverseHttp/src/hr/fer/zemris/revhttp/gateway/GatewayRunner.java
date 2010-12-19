package hr.fer.zemris.revhttp.gateway;

import hr.fer.zemris.revhttp.gateway.websockets.ProxyServlet;
import hr.fer.zemris.revhttp.gateway.websockets.ServerInterfaceServlet;

import java.io.IOException;

import javax.servlet.ServletException;
import javax.servlet.http.HttpServletResponse;

import org.eclipse.jetty.server.Handler;
import org.eclipse.jetty.server.Request;
import org.eclipse.jetty.server.Server;
import org.eclipse.jetty.server.handler.ContextHandler;
import org.eclipse.jetty.server.handler.HandlerList;
import org.eclipse.jetty.server.handler.ResourceHandler;
import org.eclipse.jetty.servlet.ServletContextHandler;

public class GatewayRunner {
	private static final String defaultHost = "localhost";
	private static final int defaultPort = 8080;
	
	public static String host = defaultHost;
	public static int port = defaultPort;

	public static void main(String[] args) {
		try {
			String virtualHost = defaultHost;
			int port = defaultPort;
			if (args.length > 0) {
				try {
					port = Integer.parseInt(args[0]);
				} catch (NumberFormatException ignorable) {
				}

				if (args.length > 1) {
					virtualHost = args[1];
				}
			}
			Server server = null;
			try {
				server = new Server(port);
				GatewayRunner.port = port;
				// JettyControlGUI.initGUI(server,
				// "ReverseHTTP Server");
			} catch (Exception e) {
				System.err.println("Server could not be started! Stack trace: ");
				e.printStackTrace();
				return;
			}

			GatewayRunner.host = virtualHost;
			String cpHost = virtualHost;
			String rpHost = "*." + virtualHost;

			WebSocketServletContextHandler cpContext = new WebSocketServletContextHandler(
					ServletContextHandler.SESSIONS);
			cpContext.setVirtualHosts(new String[] { cpHost });
			cpContext.setContextPath("/");
			cpContext.addServlet(ServerInterfaceServlet.class, "/*");

			ServletContextHandler rpContext = new ServletContextHandler(
					ServletContextHandler.SESSIONS);
			rpContext.setVirtualHosts(new String[] { rpHost });
			rpContext.setContextPath("/");
			rpContext.addServlet(ProxyServlet.class, "/*");

			ResourceHandler resourceHandler = new ResourceHandler();
			resourceHandler.setResourceBase("./static_pages");
			resourceHandler.setDirectoriesListed(true);
			ContextHandler resourceContext = new ContextHandler();
			resourceContext.setHandler(resourceHandler);
			resourceContext.setVirtualHosts(new String[] { virtualHost });

			HandlerList handlers = new HandlerList();
			handlers.setHandlers(new Handler[] { cpContext,
					resourceContext, rpContext, });
			server.setHandler(handlers);

			server.start();
			server.join();
		} catch (Exception e) {
			e.printStackTrace();
			System.exit(1);
		}
	}

	/**
	 * Context specifically designed for WebSocket servlets.
	 * 
	 * @author tomek
	 */
	public static class WebSocketServletContextHandler extends
			ServletContextHandler {
		public WebSocketServletContextHandler(int a) {
			super(a);
		}

		@Override
		public boolean checkContext(final String target,
				final Request baseRequest,
				final HttpServletResponse response) throws IOException,
				ServletException {
			if (!"WebSocket".equals(baseRequest.getHeader("Upgrade")))
				return false;
			return super.checkContext(target, baseRequest, response);
		}
	}

}
