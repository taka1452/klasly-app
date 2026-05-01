import EnvelopePrintClient from "@/components/contracts/envelope-print-client";

export const metadata = {
  title: "Signed contract - Klasly",
};

/**
 * /contracts/envelopes/[id]/print
 *
 * Print-friendly view of a fully signed envelope. Outside the (dashboard)
 * layout — no sidebar, no header. Server-side just hands the id to the
 * client, which fetches via the authenticated API.
 *
 * Browser's native Cmd-P / Ctrl-P → Save as PDF produces a clean export
 * pending the future server-side PDF generator.
 */
export default async function EnvelopePrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <EnvelopePrintClient envelopeId={id} />;
}
