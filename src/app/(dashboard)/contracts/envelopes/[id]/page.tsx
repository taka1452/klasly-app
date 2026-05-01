import EnvelopeDetailClient from "@/components/contracts/envelope-detail-client";

export const metadata = {
  title: "Contract envelope - Klasly",
};

export default async function EnvelopeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <EnvelopeDetailClient envelopeId={id} />;
}
