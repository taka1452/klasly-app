import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function MyPaymentsPage() {
  const serverSupabase = await createServerClient();
  const {
    data: { user },
  } = await serverSupabase.auth.getUser();

  if (!user) redirect("/login");

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = serviceRoleKey
    ? createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        serviceRoleKey
      )
    : serverSupabase;

  const { data: memberList } = await supabase
    .from("members")
    .select("id")
    .eq("profile_id", user.id);

  const memberIds = (memberList ?? []).map((m) => m.id);
  if (memberIds.length === 0) {
    return (
      <div className="card">
        <p className="text-sm text-gray-500">No payment history.</p>
      </div>
    );
  }

  const { data: payments } = await supabase
    .from("payments")
    .select("id, amount, currency, type, payment_type, status, paid_at, created_at, products(name)")
    .in("member_id", memberIds)
    .order("created_at", { ascending: false });

  function formatDate(val: string | undefined | null): string {
    if (!val) return "—";
    return new Date(val).toLocaleDateString();
  }

  function formatAmount(cents: number, currency?: string | null): string {
    const cur = (currency ?? "usd").toUpperCase();
    // Zero-decimal currencies (e.g. JPY) don't divide by 100
    const zeroDecimal = ["JPY", "KRW", "VND", "CLP", "BIF", "DJF", "GNF", "KMF", "MGA", "PYG", "RWF", "UGX", "XAF", "XOF", "XPF"];
    if (zeroDecimal.includes(cur)) {
      return `${cur === "JPY" ? "¥" : cur + " "}${cents.toLocaleString()}`;
    }
    const symbol = cur === "USD" ? "$" : cur === "EUR" ? "€" : cur === "GBP" ? "£" : cur + " ";
    return `${symbol}${(cents / 100).toFixed(2)}`;
  }

  function typeLabel(
    pt: string | undefined,
    t: string,
    productRef?: { name: string } | { name: string }[] | null
  ): string {
    const productName = productRef == null ? null : Array.isArray(productRef) ? productRef[0] : productRef;
    if (productName?.name) return productName.name;
    const p = pt ?? t;
    if (p === "monthly") return "Monthly";
    if (p === "pack_5") return "5-Pack";
    if (p === "pack_10") return "10-Pack";
    if (p === "drop_in") return "Drop-in";
    if (t === "product_purchase") return pt ?? "Purchase";
    return p;
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 md:text-2xl">My Payments</h1>
      <p className="mt-1 text-sm text-gray-500">Your payment history</p>

      {(payments ?? []).length === 0 ? (
        <div className="mt-6 card">
          <p className="text-sm text-gray-500">No payments yet</p>
        </div>
      ) : (
        <>
          {/* Mobile: Card list */}
          <div className="mt-6 space-y-3 md:hidden">
            {(payments ?? []).map((p) => (
              <div key={p.id} className="card">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-base font-medium text-gray-900">
                      {typeLabel(
                        p.payment_type,
                        p.type,
                        (p as unknown as { products?: { name: string } | { name: string }[] | null }).products
                      )}
                    </p>
                    <p className="mt-0.5 text-sm text-gray-500">
                      {formatDate(p.paid_at ?? p.created_at)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-base font-semibold text-gray-900">
                      {formatAmount(p.amount, p.currency)}
                    </p>
                    <span
                      className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        p.status === "paid"
                          ? "bg-green-100 text-green-800"
                          : p.status === "failed"
                          ? "bg-red-100 text-red-800"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {p.status}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop: Table */}
          <div className="mt-8 card hidden overflow-hidden p-0 md:block">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      Amount
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      Type
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {(payments ?? []).map((p) => (
                    <tr key={p.id}>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">
                        {formatDate(p.paid_at ?? p.created_at)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">
                        {formatAmount(p.amount, p.currency)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">
                        {typeLabel(
                          p.payment_type,
                          p.type,
                          (p as unknown as { products?: { name: string } | { name: string }[] | null }).products
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            p.status === "paid"
                              ? "bg-green-100 text-green-800"
                              : p.status === "failed"
                              ? "bg-red-100 text-red-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {p.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
