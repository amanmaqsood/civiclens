import { describe, expect, it } from "vitest";
import {
  classifyProtectedRoute,
  consumeQuota,
  findOversizedStringField,
  isLocalAppCheckBypassAllowed,
  parsePositiveInt,
  parseCsvEnv,
  quotaWindowStart,
  resolveActorFromDecoded,
} from "./perimeter";

describe("server perimeter helpers", () => {
  it("resolves real operators from verified allowlist emails", () => {
    const actor = resolveActorFromDecoded(
      {
        uid: "operator-1",
        email: "Ops@Example.com",
        email_verified: true,
        firebase: { sign_in_provider: "google.com" },
      },
      parseCsvEnv("ops@example.com"),
      false,
      true
    );

    expect(actor.role).toBe("operator");
    expect(actor.isRealOperator).toBe(true);
  });

  it("does not grant allowlist operator role to unverified email identities", () => {
    const actor = resolveActorFromDecoded(
      {
        uid: "operator-2",
        email: "ops@example.com",
        email_verified: false,
        firebase: { sign_in_provider: "google.com" },
      },
      ["ops@example.com"],
      false,
      true
    );

    expect(actor.role).toBe("citizen");
  });

  it("grants demo operator only when explicitly requested and enabled", () => {
    const actor = resolveActorFromDecoded(
      {
        uid: "anon-1",
        firebase: { sign_in_provider: "anonymous" },
      },
      [],
      true,
      true
    );

    expect(actor.role).toBe("demo_operator");
    expect(actor.isDemoOperator).toBe(true);
  });

  it("allows local App Check bypass only for local non-production requests", () => {
    const localRequest = {
      ip: "127.0.0.1",
      hostname: "localhost",
      headers: {
        host: "localhost:3000",
        "x-civiclens-local-appcheck-bypass": "true",
      },
    } as any;

    expect(isLocalAppCheckBypassAllowed(localRequest, { nodeEnv: "development", bypassEnabled: true })).toBe(true);
    expect(isLocalAppCheckBypassAllowed(localRequest, { nodeEnv: "production", bypassEnabled: true })).toBe(false);
    expect(isLocalAppCheckBypassAllowed(localRequest, { nodeEnv: "development", bypassEnabled: false })).toBe(false);
  });

  it("enforces fixed-window quotas by key and reset window", () => {
    const buckets = new Map();
    const config = { limit: 2, windowMs: 1000 };

    expect(consumeQuota(buckets, "gemini:user-1", config, 100).allowed).toBe(true);
    expect(consumeQuota(buckets, "gemini:user-1", config, 200).allowed).toBe(true);
    expect(consumeQuota(buckets, "gemini:user-1", config, 300).allowed).toBe(false);
    expect(consumeQuota(buckets, "gemini:user-1", config, 1200).allowed).toBe(true);
  });

  it("normalizes quota environment numbers and fixed window starts", () => {
    expect(parsePositiveInt("3", 10)).toBe(3);
    expect(parsePositiveInt("-1", 10)).toBe(10);
    expect(parsePositiveInt("not-a-number", 10)).toBe(10);
    expect(quotaWindowStart(12_345, 1_000)).toBe(12_000);
  });

  it("finds oversized nested body fields", () => {
    const body = {
      title: "small",
      evidence: [{ note: "x".repeat(11) }],
    };

    expect(findOversizedStringField(body, { maxTextLength: 10, maxImageLength: 100 })).toBe("body.evidence.0.note");
  });

  it("classifies Gemini and mutation routes", () => {
    expect(classifyProtectedRoute("GET", "/api/health")).toBe("health");
    expect(classifyProtectedRoute("GET", "/api/session")).toBe("session");
    expect(classifyProtectedRoute("POST", "/api/agent/run")).toBe("gemini");
    expect(classifyProtectedRoute("POST", "/api/issues/update-status")).toBe("mutation");
  });
});
