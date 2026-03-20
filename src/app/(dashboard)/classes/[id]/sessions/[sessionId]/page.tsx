import { redirect } from "next/navigation";

/**
 * Session detail has moved to /schedule/[id]/sessions/[sessionId].
 * This redirect ensures old links still work.
 */
export default async function SessionDetailRedirect({
  params,
}: {
  params: Promise<{ id: string; sessionId: string }>;
}) {
  const { id, sessionId } = await params;
  redirect(`/schedule/${id}/sessions/${sessionId}`);
}
