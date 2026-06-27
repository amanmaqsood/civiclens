import { describe, expect, it } from "vitest";
import { isInternalSmokeTestIssue } from "./utils/issueVisibility";

describe("issue visibility helpers", () => {
  it("hides clearly labelled internal smoke-test records", () => {
    expect(isInternalSmokeTestIssue({
      title: "Synthetic Cloud Run smoke test pothole",
      description: "Internal-test record from a deployment smoke test.",
    })).toBe(true);

    expect(isInternalSmokeTestIssue({
      ticketId: "CVL-SMOKE-001",
      summary: "cloud run smoke verification",
    })).toBe(true);
  });

  it("keeps ordinary synthetic demo stories visible", () => {
    expect(isInternalSmokeTestIssue({
      title: "Synthetic demo pothole near school",
      description: "A visible demo story for judging the workflow.",
      locationName: "Bengaluru demo area",
    })).toBe(false);
  });
});
