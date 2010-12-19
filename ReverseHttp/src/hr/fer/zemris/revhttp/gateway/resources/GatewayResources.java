package hr.fer.zemris.revhttp.gateway.resources;

import hr.fer.zemris.revhttp.gateway.websockets.ServerInterfaceServlet.ServerInterfaceSocket;

import java.util.HashMap;
import java.util.LinkedList;
import java.util.Map;

public class GatewayResources {
	private static final Map<String, String> resourceUUIDs = new HashMap<String, String>();
	private static final Map<String, ServerInterfaceSocket> resourceSockets = new HashMap<String, ServerInterfaceSocket>();
	private static final Map<ServerInterfaceSocket, LinkedList<String>> socketResources = new HashMap<ServerInterfaceSocket, LinkedList<String>>();

	/**
	 * @param appName
	 * @return uuid of the registered domain if it doesn't exist yet, null
	 *         otherwise
	 */
	public static String registerApplication(String appName) {
		appName = appName.toLowerCase();
		if (resourceUUIDs.containsKey(appName))
			return null;
		String uuid = generateUUID();
		resourceUUIDs.put(appName, uuid);
		return uuid;
	}

	public static void unregisterApplication(String appName) {
		if (resourceUUIDs.containsKey(appName))
			resourceUUIDs.remove(appName);
	}

	public static String getResourceUUID(String regex) {
		return resourceUUIDs.get(regex);
	}

	/**
	 * Checks if uuid coresponds to the given domain
	 * 
	 * @param domain
	 * @param uuid
	 * @return true if satisfied, false otherwise
	 */
	public static boolean isValidUUID(String domain, String uuid) {
		if (uuid == null || domain == null)
			return false;
		return uuid.equals(resourceUUIDs.get(domain));
	}

	public static void addResource(String regex, ServerInterfaceSocket socket) {
		resourceSockets.put(regex, socket);
		LinkedList<String> sr = socketResources.get(socket);
		if (sr == null) {
			sr = new LinkedList<String>();
			socketResources.put(socket, sr);
		}
		sr.add(regex);
	}

	public static void deleteSocket(ServerInterfaceSocket socket) {
		LinkedList<String> regList = socketResources.remove(socket);
		if (regList != null)
			for (String appName : regList) {
				resourceSockets.remove(appName);
				resourceUUIDs.remove(appName);
			}
	}

	public static boolean removeResource(String regex) {
		if (!resourceSockets.containsKey(regex))
			return false;
		resourceSockets.remove(regex);
		return true;
	}

	public static String generateUUID() {
		char[] uuid = new char[36];
		char[] nineteen = new String("89AB").toCharArray();
		char[] hex = new String("0123456789ABCDEF").toCharArray();
		for (int i = 0; i < 36; i++) {
			uuid[i] = hex[(int) (Math.floor(Math.random() * 16))];
		}
		uuid[14] = '4';
		uuid[19] = nineteen[(int) (Math.floor(Math.random() * 4))];
		uuid[8] = uuid[13] = uuid[18] = uuid[23] = '-';

		return new String(uuid);
	}

	public static boolean relay(String requestId, String appName) {
		ServerInterfaceSocket socket = resourceSockets.get(appName);
		if (socket != null) {
			socket.relayRequest(requestId, appName);
			return true;
		} else
			return false;
	}
}
