import { z } from "zod";

export const billingPreviewRequest = z.object({
  customerId: z.string().trim().min(1),
  period: z.string().regex(/^\d{4}-\d{2}$/),
  workOrders: z.array(z.object({
    workOrderId: z.string().trim().min(1),
    photoCount: z.number().int().nonnegative(),
    dispatchStatus: z.enum(["queued", "dispatched", "completed"]),
    technicianFollowUp: z.boolean()
  })).min(1)
});

export type BillingPreviewRequest = z.infer<typeof billingPreviewRequest>;

export type WorkOrderCharge = {
  workOrderId: string;
  decision: "bill" | "hold" | "duplicate";
  units: number;
};

export type BillingPreview = {
  customerId: string;
  period: string;
  billableUnits: number;
  charges: WorkOrderCharge[];
};

export function previewBilling(input: BillingPreviewRequest): BillingPreview {
  const seen = new Set<string>();
  const charges = input.workOrders.map((order): WorkOrderCharge => {
    if (seen.has(order.workOrderId)) {
      return { workOrderId: order.workOrderId, decision: "duplicate", units: 0 };
    }
    seen.add(order.workOrderId);

    if (order.dispatchStatus !== "completed") {
      return { workOrderId: order.workOrderId, decision: "hold", units: 0 };
    }

    return {
      workOrderId: order.workOrderId,
      decision: "bill",
      units: order.photoCount + (order.technicianFollowUp ? 1 : 0)
    };
  });

  return {
    customerId: input.customerId,
    period: input.period,
    billableUnits: charges.reduce((sum, charge) => sum + charge.units, 0),
    charges
  };
}
