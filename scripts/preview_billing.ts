async function main(): Promise<void> {
  const port = Number(process.env.PORT ?? 3000);
  const response = await fetch(`http://localhost:${port}/billing-preview`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      customerId: "northwind-hvac",
      period: "2026-09",
      workOrders: [
        {
          workOrderId: "WO-1842",
          photoCount: 4,
          dispatchStatus: "completed",
          technicianFollowUp: true
        },
        {
          workOrderId: "WO-1843",
          photoCount: 2,
          dispatchStatus: "dispatched",
          technicianFollowUp: false
        }
      ]
    })
  });

  const result: unknown = await response.json();
  console.log(JSON.stringify(result, null, 2));
  if (!response.ok) process.exitCode = 1;
}

void main();
