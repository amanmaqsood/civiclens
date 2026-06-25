import { describe, it, expect } from "vitest";
import { 
  getDistance, 
  calculatePriorityScore, 
  isDuplicateCandidate, 
  isValidStatusTransition,
  getPriorityBreakdown
} from "./issues";
import { IssueReport } from "../types";

describe("CivicLens - Unit Tests", () => {
  describe("getDistance (Haversine formula)", () => {
    it("should return 0 meters for the same coordinate pair", () => {
      const distance = getDistance(12.9716, 77.5946, 12.9716, 77.5946);
      expect(distance).toBe(0);
    });

    it("should return the correct distance for points approx 111m apart vertically", () => {
      // 0.001 deg latitude is approximately 111 meters
      const distance = getDistance(12.9716, 77.5946, 12.9726, 77.5946);
      expect(distance).toBeGreaterThan(110);
      expect(distance).toBeLessThan(112);
    });

    it("should return correct distance for known cities (London and Paris)", () => {
      // London (51.5074, -0.1278) to Paris (48.8566, 2.3522)
      const distance = getDistance(51.5074, -0.1278, 48.8566, 2.3522);
      // Distance is ~343 km (343000 to 345000 meters)
      expect(distance).toBeGreaterThan(343000);
      expect(distance).toBeLessThan(345000);
    });
  });

  describe("calculatePriorityScore", () => {
    it("should calculate correct score for base/routine issue", () => {
      // severity=3, reportCount=1, urgency="routine" (0), time=0, confirm=0, dispute=0
      // score = severity * 12 + reportCount * 4 = 3 * 12 + 4 = 40.0
      const score = calculatePriorityScore({
        severity: 3,
        urgency: "routine",
        timestamp: new Date().toISOString(),
        confirmCount: 0,
        disputeCount: 0,
        reportCount: 1,
      });
      expect(score).toBe(40.0);
    });

    it("should respect the confirm count cap of 15 points (5 logs * 3)", () => {
      // severity=3, reportCount=1, confirm=20 logs -> cap = Math.min(...) = 15
      // score = 3 * 12 + 15 + 4 = 55.0
      const score = calculatePriorityScore({
        severity: 3,
        urgency: "routine",
        timestamp: new Date().toISOString(),
        confirmCount: 20, // 20 * 3 = 60, should cap at 15
        disputeCount: 0,
        reportCount: 1,
      });
      expect(score).toBe(55.0);
    });

    it("should factor in urgency bonus, time, and dispute deductions accurately", () => {
      const pastTime = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(); // 48 hours ago
      // severity=4 -> 48 points
      // urgency="urgent" -> 10 points
      // time = min(48 / 12, 10) = 4 points
      // confirm = 10 * 3 -> capped at 15 points
      // report = 3 * 4 = 12 points
      // dispute = 2 * 5 = 10 points deduction
      // Expected = 48 + 10 + 4 + 15 + 12 - 10 = 79.0
      const score = calculatePriorityScore({
        severity: 4,
        urgency: "urgent",
        timestamp: pastTime,
        confirmCount: 10,
        disputeCount: 2,
        reportCount: 3,
      });
      expect(score).toBe(79.0);
    });
  });

  describe("isDuplicateCandidate filter", () => {
    const baseNewReport: Partial<IssueReport> = {
      category: "Roads & Potholes",
      lat: 12.9716,
      lng: 77.5946,
    };

    it("should return true for identical category within 150m and within 14 days", () => {
      const existing: Partial<IssueReport> = {
        category: "Roads & Potholes",
        status: "Submitted",
        timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days ago
        lat: 12.9720, // very close, approx ~44m
        lng: 77.5946,
      };

      const result = isDuplicateCandidate(baseNewReport, existing);
      expect(result).toBe(true);
    });

    it("should return false if category is different", () => {
      const existing: Partial<IssueReport> = {
        category: "Garbage & Sewage",
        status: "Submitted",
        timestamp: new Date().toISOString(),
        lat: 12.9716,
        lng: 77.5946,
      };

      const result = isDuplicateCandidate(baseNewReport, existing);
      expect(result).toBe(false);
    });

    it("should return false if distance is greater than 150 meters", () => {
      // 0.002 deg latitude is approximately 222 meters
      const existing: Partial<IssueReport> = {
        category: "Roads & Potholes",
        status: "Submitted",
        timestamp: new Date().toISOString(),
        lat: 12.9736,
        lng: 77.5946,
      };

      const result = isDuplicateCandidate(baseNewReport, existing);
      expect(result).toBe(false);
    });

    it("should return false if existing complaint is already Resolved", () => {
      const existing: Partial<IssueReport> = {
        category: "Roads & Potholes",
        status: "Resolved",
        timestamp: new Date().toISOString(),
        lat: 12.9716,
        lng: 77.5946,
      };

      const result = isDuplicateCandidate(baseNewReport, existing);
      expect(result).toBe(false);
    });

    it("should return false if timestamp is older than 14 days", () => {
      const existing: Partial<IssueReport> = {
        category: "Roads & Potholes",
        status: "Submitted",
        timestamp: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(), // 15 days ago
        lat: 12.9716,
        lng: 77.5946,
      };

      const result = isDuplicateCandidate(baseNewReport, existing);
      expect(result).toBe(false);
    });
  });

  describe("operator status-transition validity", () => {
    it("should allow Submitted -> Verified", () => {
      const res = isValidStatusTransition("Submitted", "Verified", false, false);
      expect(res).toBe(true);
    });

    it("should reject Submitted -> In Progress", () => {
      const res = isValidStatusTransition("Submitted", "In Progress", false, false);
      expect(res).toBe(false);
    });

    it("should allow Verified -> In Progress", () => {
      const res = isValidStatusTransition("Verified", "In Progress", false, false);
      expect(res).toBe(true);
    });

    it("should only allow In Progress -> Resolved if AI verified or manual override is true", () => {
      // Neither true -> false
      expect(isValidStatusTransition("In Progress", "Resolved", false, false)).toBe(false);
      
      // Ai verified -> true
      expect(isValidStatusTransition("In Progress", "Resolved", true, false)).toBe(true);
      
      // Manual override -> true
      expect(isValidStatusTransition("In Progress", "Resolved", false, true)).toBe(true);
    });
  });

  describe("getPriorityBreakdown", () => {
    it("should correctly compile the components for urgent priority issues with disputes", () => {
      const timestamp = new Date().toISOString();
      const breakdown = getPriorityBreakdown({
        severity: 4,
        urgency: "urgent",
        timestamp,
        confirmCount: 5, // 5 * 3 = 15 (at cap)
        disputeCount: 1, // 1 * 5 = 5 deduction
        reportCount: 2, // 2 * 4 = 8
      });

      expect(breakdown.severityComponent).toBe(48);
      expect(breakdown.urgencyComponent).toBe(10);
      expect(breakdown.confirmComponent).toBe(15);
      expect(breakdown.disputeComponent).toBe(5);
      expect(breakdown.reportComponent).toBe(8);
      expect(breakdown.score).toBe(48 + 10 + 0 + 15 + 8 - 5); // age time is ~0
    });

    it("should map priority urgency bonus to 5 points", () => {
      const breakdown = getPriorityBreakdown({
        severity: 2,
        urgency: "priority",
        timestamp: new Date().toISOString(),
      });
      expect(breakdown.urgencyComponent).toBe(5);
    });

    it("should map routine urgency bonus to 0 points", () => {
      const breakdown = getPriorityBreakdown({
        severity: 2,
        urgency: "routine",
        timestamp: new Date().toISOString(),
      });
      expect(breakdown.urgencyComponent).toBe(0);
    });
  });
});
