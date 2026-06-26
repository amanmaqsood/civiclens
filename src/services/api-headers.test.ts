import { describe, expect, it } from "vitest";
import { buildApiHeaders } from "./api-headers";

describe("API header builder", () => {
  it("attaches Firebase auth and App Check tokens when available", async () => {
    const headers = await buildApiHeaders(
      undefined,
      JSON.stringify({ ok: true }),
      {},
      { isDev: false },
      () => "id-token",
      () => "app-check-token"
    );

    expect(headers.get("Authorization")).toBe("Bearer id-token");
    expect(headers.get("X-Firebase-AppCheck")).toBe("app-check-token");
    expect(headers.get("Content-Type")).toBe("application/json");
    expect(headers.has("X-CivicLens-Local-AppCheck-Bypass")).toBe(false);
  });

  it("adds only development and demo markers when requested", async () => {
    const headers = await buildApiHeaders(
      { "Content-Type": "text/plain" },
      "body",
      { demoOperator: true },
      { isDev: true },
      () => null,
      () => null
    );

    expect(headers.get("Content-Type")).toBe("text/plain");
    expect(headers.get("X-CivicLens-Local-AppCheck-Bypass")).toBe("true");
    expect(headers.get("X-CivicLens-Demo-Operator")).toBe("true");
    expect(headers.has("Authorization")).toBe(false);
    expect(headers.has("X-Firebase-AppCheck")).toBe(false);
  });
});
