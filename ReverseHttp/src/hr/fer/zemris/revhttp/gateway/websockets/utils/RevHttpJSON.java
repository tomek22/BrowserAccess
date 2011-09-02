package hr.fer.zemris.revhttp.gateway.websockets.utils;

import hr.fer.zemris.revhttp.gateway.websockets.ProxyServlet;

import java.io.BufferedReader;
import java.io.IOException;
import java.util.Enumeration;
import java.util.HashMap;
import java.util.Map;

import javax.servlet.http.HttpServletRequest;

public class RevHttpJSON extends HashMap<String, HashMap<String, Object>> {

	private static final int maxStreamBufferSize = 1024;

	private static final long serialVersionUID = 1L;

	private HashMap<String, Object> revhttp = new HashMap<String, Object>();

	public RevHttpJSON() {
		super();
		this.put("revhttp", revhttp);
	}

	public RevHttpJSON(String method) {
		this();
		setMethod(method);
	}

	public void setMethod(String method) {
		setElement("method", method);
	}

	public void setSuccess(boolean success) {
		revhttp.put("success", success ? "true" : "false");
	}

	public void setRegistrationKey(String key) {
		revhttp.put("registrationKey", key);
	}

	public void setRequestKey(String key) {
		revhttp.put("requestKey", key);
	}

	public void setRealPrefix(String appName, String protocol, String hostName,
			int port) {
		revhttp.put("realPrefix", protocol + "://" + appName + '.' + hostName
				+ ':' + port);
	}

	public void setAppName(String appName) {
		revhttp.put("appName", appName);
	}

	public void setRequestId(String requestId) {
		revhttp.put("requestId", requestId);
	}

	public void setElement(String key, Object value) {
		revhttp.put(key, value);
	}

	public void setRequest(String requestId) throws IOException {
		HttpServletRequest request = ProxyServlet.requestMap.get(requestId);
		StringBuilder body = new StringBuilder();

		HashMap<String, Object> requestObject = new HashMap<String, Object>();

		int contentLength = request.getContentLength();

		if (contentLength > 0) {
			BufferedReader bbr = request.getReader();
	
			int bufferSize = (contentLength < this.maxStreamBufferSize) ? contentLength : this.maxStreamBufferSize;
	
			char[] buffer = new char[bufferSize];
	
			int rc;
			do {
				rc = bbr.read(buffer);
				if (rc > 0)
					body.append(buffer, 0, rc);
			} while (rc == bufferSize);
	
			requestObject.put("body", body.toString());
		} else {
			requestObject.put("body", "");
		}

		HashMap<String, String> headers = new HashMap<String, String>();
		Enumeration<?> headerNames = request.getHeaderNames();
		while (headerNames.hasMoreElements()) {
			String name = (String) headerNames.nextElement();
			headers.put(name.toLowerCase(), request.getHeader(name));
		}
		requestObject.put("headers", headers);
		String queryString = request.getQueryString();
		if (queryString == null)
			queryString = "";
		requestObject.put("queryString", queryString);
		requestObject.put("method", request.getMethod());
		requestObject.put("resourcePath", request.getPathInfo());
		revhttp.put("request", requestObject);

		try {
			String line = null;
			BufferedReader reader = request.getReader();
			while ((line = reader.readLine()) != null)
				body.append(line);
		} catch (Exception e) {
			System.err.println("Request body read failed!");
		}

	}

	@SuppressWarnings("rawtypes")
	public static Object getElement(Object json, String key) {
		if (json != null)
			return ((Map) ((Map) json).get("revhttp")).get(key);
		return null;
	}
}
