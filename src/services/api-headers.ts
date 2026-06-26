export type TokenProvider = () => Promise<string | null> | string | null;

export interface ApiHeaderOptions {
  demoOperator?: boolean;
}

export interface ApiHeaderEnv {
  isDev: boolean;
}

export async function buildApiHeaders(
  initHeaders: HeadersInit | undefined,
  body: BodyInit | null | undefined,
  options: ApiHeaderOptions,
  env: ApiHeaderEnv,
  getIdToken: TokenProvider,
  getAppCheckToken: TokenProvider
): Promise<Headers> {
  const headers = new Headers(initHeaders || {});
  const token = await getIdToken();
  const appCheckToken = await getAppCheckToken();

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (appCheckToken) {
    headers.set("X-Firebase-AppCheck", appCheckToken);
  }

  if (body && !headers.has("Content-Type") && typeof body === "string") {
    headers.set("Content-Type", "application/json");
  }

  if (env.isDev) {
    headers.set("X-CivicLens-Local-AppCheck-Bypass", "true");
  }

  if (options.demoOperator) {
    headers.set("X-CivicLens-Demo-Operator", "true");
  }

  return headers;
}
