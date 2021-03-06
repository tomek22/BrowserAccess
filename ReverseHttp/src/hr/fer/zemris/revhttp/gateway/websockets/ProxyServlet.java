/**
 * 
 */
package hr.fer.zemris.revhttp.gateway.websockets;

import hr.fer.zemris.revhttp.gateway.GatewayRunner;
import hr.fer.zemris.revhttp.gateway.resources.GatewayResources;

import java.io.IOException;
import java.util.Hashtable;
import java.util.Map;

import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import org.eclipse.jetty.continuation.Continuation;
import org.eclipse.jetty.continuation.ContinuationListener;
import org.eclipse.jetty.continuation.ContinuationSupport;

/**
 * @author tomek
 */
public class ProxyServlet extends HttpServlet {
	private static final long serialVersionUID = 1L;

	public static Map<String, HttpServletRequest> requestMap = new Hashtable<String, HttpServletRequest>();
	public static Map<String, HttpServletResponse> responseMap = new Hashtable<String, HttpServletResponse>();

	@Override
	protected void service(final HttpServletRequest request,
			final HttpServletResponse response) throws ServletException,
			IOException {

		Continuation continuation = ContinuationSupport.getContinuation(request);
		continuation.suspend(response);

		String tmpId = null;
		do {
			tmpId = GatewayResources.generateUUID();
		} while (requestMap.containsKey(tmpId)
				|| responseMap.containsKey(tmpId));
		
		final String reqId = tmpId;

		requestMap.put(reqId, request);
		responseMap.put(reqId, response);

		continuation.addContinuationListener(new ContinuationListener() {

			@Override
			public void onTimeout(Continuation continuation) {
				requestMap.remove(reqId);
				responseMap.remove(reqId);
				((HttpServletResponse) continuation.getServletResponse())
						.setStatus(504);
				continuation.complete();
			}

			@Override
			public void onComplete(Continuation continuation) {
			}
		});

		String host = request.getHeader("Host");
		int endInd = host.lastIndexOf(':');
		if (endInd < 0) {
			endInd = host.length();
			if (endInd < 0)
				endInd = 0;
		}
		String domain = host.substring(0, endInd);

		if (!domain.endsWith(GatewayRunner.host)
				|| !GatewayResources.relay(
						reqId,
						domain.substring(0, domain.length()
								- GatewayRunner.host.length() - 1))) {
			requestMap.remove(reqId);
			responseMap.remove(reqId);
			response.setStatus(500);
			response.getWriter().write("No application found");
			continuation.complete();
		}
	}
}
