import assert from "node:assert/strict";
import test from "node:test";
import { billingPreviewRequest, previewBilling } from "../src/billing_policy.ts";

test("bills completed work once and holds dispatched work", () => {
  const input = billingPreviewRequest.parse({
    customerId: "northwind-hvac",
    period: "2026-09",
    workOrders: [
      { workOrderId: "WO-1842", photoCount: 4, dispatchStatus: "completed", technicianFollowUp: true },
      { workOrderId: "WO-1843", photoCount: 2, dispatchStatus: "dispatched", technicianFollowUp: false },
      { workOrderId: "WO-1842", photoCount: 4, dispatchStatus: "completed", technicianFollowUp: true }
    ]
  });

  assert.deepEqual(previewBilling(input), {
    customerId: "northwind-hvac",
    period: "2026-09",
    billableUnits: 5,
    charges: [
      { workOrderId: "WO-1842", decision: "bill", units: 5 },
      { workOrderId: "WO-1843", decision: "hold", units: 0 },
      { workOrderId: "WO-1842", decision: "duplicate", units: 0 }
    ]
  });
});
