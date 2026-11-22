const API_PREFIX = "/api/";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith(API_PREFIX)) {
      const backendOrigin = env.BACKEND_ORIGIN;
      if (!backendOrigin) {
        return new Response("BACKEND_ORIGIN is not configured", { status: 500 });
      }

      let backendUrl;
      try {
        backendUrl = new URL(url.pathname + url.search, backendOrigin);
      } catch {
        return new Response("Invalid BACKEND_ORIGIN", { status: 500 });
      }

      const proxyRequest = new Request(backendUrl, request);
      proxyRequest.headers.set("X-Forwarded-Host", url.host);
      proxyRequest.headers.set("X-Forwarded-Proto", url.protocol.slice(0, -1));

      return fetch(proxyRequest);
    }

    return env.ASSETS.fetch(request);
  },
};
