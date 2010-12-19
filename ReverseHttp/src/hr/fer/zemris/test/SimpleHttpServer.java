package hr.fer.zemris.test;

import org.eclipse.jetty.server.Handler;
import org.eclipse.jetty.server.Server;
import org.eclipse.jetty.server.handler.ContextHandler;
import org.eclipse.jetty.server.handler.DefaultHandler;
import org.eclipse.jetty.server.handler.HandlerList;
import org.eclipse.jetty.server.handler.ResourceHandler;

public class SimpleHttpServer {
	private static final int defaultPort = 8000;
	private static final String defaultMainPath = "./html_content";
	private static final String defaultLibPath = "../lib";

	public static void main(String[] args) {
		int port = defaultPort;
		String mainPath = defaultMainPath;
		String libPath = defaultLibPath;
		try {
			if (args.length > 0) {
				try {
					port = Integer.parseInt(args[0]);
					if (args.length > 1) {
						mainPath = args[1];
						if (args.length > 2)
							libPath = args[2];
					}
				} catch (NumberFormatException ignorable) {
					mainPath = args[0];
				}
			}
			Server server = null;
			try {
				server = new Server(port);
				//JettyControlGUI.initGUI(server, "Simple HTTP Server");
			} catch (Exception e) {
				System.err.println("Server could not be started! Stack trace: ");
				e.printStackTrace();
				System.exit(2);
			}

			ContextHandler libResourceContext = new ContextHandler();
			libResourceContext.setContextPath("/lib");

			ResourceHandler mainResource = new ResourceHandler();
			ResourceHandler libResource = new ResourceHandler();

			mainResource.setResourceBase(mainPath);
			mainResource.setDirectoriesListed(true);
			libResource.setResourceBase(libPath);
			libResource.setDirectoriesListed(true);

			HandlerList handlers = new HandlerList();
			handlers.setHandlers(new Handler[] { libResourceContext, mainResource, new DefaultHandler() });
			server.setHandler(handlers);
			libResourceContext.setHandler(libResource);

			server.start();
			server.join();
		} catch (Exception e) {
			e.printStackTrace();
			System.exit(1);
		}
	}
}
