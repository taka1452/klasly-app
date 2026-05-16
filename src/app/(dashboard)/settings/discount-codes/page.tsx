import DiscountCodesClient from "@/components/settings/discount-codes-client";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Discount Codes - Klasly",
};

export default function DiscountCodesPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
          Discount Codes
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Create codes attendees can enter at checkout. Optionally tie a code
          to a member tag (like &quot;veteran&quot;) so it auto-applies for
          tagged members without anyone typing anything.
        </p>
      </div>
      <DiscountCodesClient />
    </div>
  );
}
