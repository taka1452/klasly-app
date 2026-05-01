import ContractSignClient from "@/components/contracts/contract-sign-client";

/**
 * /contracts/sign/[token] — public landing page for a contract signer.
 *
 * No auth required: the token in the URL is the credential. We render
 * the client component which fetches envelope + form details from the
 * API on mount.
 */
export default async function ContractSignPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <ContractSignClient token={token} />;
}

export const dynamic = "force-dynamic";
