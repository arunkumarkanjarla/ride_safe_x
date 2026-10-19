import { apiFetch } from "./api";

export type Payment = {
  id: string;
  booking_id: string;
  amount_paise: number;
  currency: string;
  status: string;
  gateway: string;
  gateway_ref: string;
  sandbox: boolean;
  failure_category: string | null;
  created_at: string;
  succeeded_at: string | null;
  failed_at: string | null;
  cancelled_at: string | null;
};

export async function listPayments(
  access: string,
  bookingId: string,
): Promise<Payment[]> {
  const r = await apiFetch<{ items: Payment[] }>(
    `/payments?booking_id=${encodeURIComponent(bookingId)}`,
    {},
    access,
  );
  return r.items;
}

export async function initiatePayment(
  access: string,
  bookingId: string,
  idempotencyKey: string,
): Promise<Payment> {
  return apiFetch<Payment>(
    "/payments",
    {
      method: "POST",
      body: JSON.stringify({
        booking_id: bookingId,
        idempotency_key: idempotencyKey,
      }),
    },
    access,
  );
}

export async function sandboxSimulate(
  access: string,
  paymentId: string,
  outcome: "succeed" | "fail" | "cancel",
): Promise<Payment> {
  return apiFetch<Payment>(
    `/payments/${paymentId}/sandbox/simulate`,
    {
      method: "POST",
      body: JSON.stringify({ outcome }),
    },
    access,
  );
}

export function newPayIdemKey(): string {
  return `pay-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
