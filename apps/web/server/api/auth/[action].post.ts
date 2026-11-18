const actions = new Set(["login", "refresh-token", "logout"]);

export default defineEventHandler(async (event) => {
  setResponseHeader(event, "Cache-Control", "no-store");

  const action = getRouterParam(event, "action");
  if (!action || !actions.has(action)) {
    throw createError({ statusCode: 404, statusMessage: "Not found" });
  }

  // The browser calls this endpoint on the same origin as the login page.
  const fetchSite = getRequestHeader(event, "sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") {
    throw createError({ statusCode: 403, statusMessage: "Invalid origin" });
  }

  const config = useRuntimeConfig(event);
  const apiBase = config.authApiBase || config.public.apiBase;
  const url = new URL(`/api/auth/${action}`, apiBase);
  const headers = new Headers({ Accept: "application/json" });
  const refreshToken = getCookie(event, "refreshToken");
  const authorization = getRequestHeader(event, "authorization");
  if (refreshToken)
    headers.set("Cookie", `refreshToken=${encodeURIComponent(refreshToken)}`);
  if (authorization && action === "logout")
    headers.set("Authorization", authorization);
  if (action === "login") {
    const contentType = getRequestHeader(event, "content-type");
    if (
      contentType?.split(";")[0]?.trim().toLowerCase() !== "application/json"
    ) {
      throw createError({
        statusCode: 415,
        statusMessage: "Expected application/json",
      });
    }
    headers.set("Content-Type", "application/json");
  }

  const body =
    action === "login" ? JSON.stringify(await readBody(event)) : undefined;
  let upstream: Response;
  try {
    upstream = await fetch(url, {
      method: "POST",
      headers,
      body,
      redirect: "error",
    });
  } catch {
    throw createError({
      statusCode: 502,
      statusMessage: "Authentication service unavailable",
    });
  }

  setResponseStatus(event, upstream.status);
  for (const cookie of upstream.headers.getSetCookie()) {
    appendResponseHeader(event, "Set-Cookie", cookie);
  }
  return await upstream.json();
});
