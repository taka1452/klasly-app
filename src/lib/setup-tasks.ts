import type { SupabaseClient } from "@supabase/supabase-js";
import type { SetupTask } from "@/components/ui/setup-task-list";

type StudioInfo = {
  stripe_subscription_id?: string | null;
  stripe_connect_onboarding_complete?: boolean | null;
  payout_model?: string | null;
} | null;

/**
 * Build the owner setup checklist. Shared by the dashboard layout (floating
 * checklist) and the dashboard home page (inline card) so both stay in sync.
 */
export async function getOwnerSetupTasks(
  supabase: SupabaseClient,
  studioId: string,
  studio: StudioInfo,
  onboardingCompleted: boolean,
): Promise<SetupTask[]> {
  const [
    { count: classesCount },
    { count: instructorsCount },
    { count: membersCount },
    { count: productsCount },
    { data: widgetSettings },
    { count: waiverCount },
  ] = await Promise.all([
    supabase.from("classes").select("id", { count: "exact", head: true }).eq("studio_id", studioId),
    supabase.from("instructors").select("id", { count: "exact", head: true }).eq("studio_id", studioId),
    supabase.from("members").select("id", { count: "exact", head: true }).eq("studio_id", studioId),
    supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("studio_id", studioId)
      .eq("is_active", true),
    supabase.from("widget_settings").select("enabled").eq("studio_id", studioId).maybeSingle(),
    supabase.from("waiver_templates").select("id", { count: "exact", head: true }).eq("studio_id", studioId),
  ]);

  const hasPricing = (productsCount ?? 0) > 0;
  const widgetEnabled = (widgetSettings as { enabled?: boolean } | null)?.enabled ?? false;

  const tasks: SetupTask[] = [
    {
      id: "tutorial",
      label: "Complete the tutorial",
      done: onboardingCompleted,
      hint: "Take a quick tour to learn the dashboard.",
      helpHref: "/help/getting-started/studio-setup-overview",
    },
    {
      id: "stripe-connect",
      label: "Connect Stripe",
      done: studio?.stripe_connect_onboarding_complete ?? false,
      href: "/settings/connect",
      hint: "Required so members can pay for classes online.",
      helpHref: "/help/getting-started/connect-stripe",
    },
    {
      id: "create-class",
      label: "Create at least one class",
      done: (classesCount ?? 0) >= 1,
      href: "/calendar/new",
      hint: "Add a recurring class so members can book.",
      helpHref: "/help/classes-scheduling/create-recurring-class",
    },
    {
      id: "add-instructor",
      label: "Add an instructor",
      done: (instructorsCount ?? 0) >= 1,
      href: "/instructors/new",
      hint: "Invite instructors to manage their classes.",
      helpHref: "/help/collective-mode/invite-instructor",
    },
    {
      id: "add-member",
      label: "Add a member",
      done: (membersCount ?? 0) >= 1,
      href: "/members/new",
      hint: "Add or import members so they can start booking.",
      helpHref: "/help/members/add-member",
    },
    {
      id: "pricing",
      label: "Set up pricing",
      done: hasPricing,
      href: "/settings/pricing",
      hint: "Create plans and packages for members to buy.",
      helpHref: "/help/payments/create-products",
    },
    {
      id: "waiver",
      label: "Set up waiver template",
      done: (waiverCount ?? 0) >= 1,
      href: "/settings/waiver",
      hint: "Create a liability waiver for members to sign.",
      helpHref: "/help/settings/waiver-template",
    },
    {
      id: "widget",
      label: "Set up website widget",
      done: widgetEnabled,
      href: "/settings/widget",
      hint: "Embed your class schedule on your website.",
      helpHref: "/help/settings/embed-wordpress-widget",
    },
    {
      id: "choose-plan",
      label: "Choose a plan",
      done: !!studio?.stripe_subscription_id,
      href: "/settings/billing",
      hint: "Your 30-day trial is active. Subscribe to keep your studio running.",
      helpHref: "/help/settings/manage-subscription",
    },
  ];

  if (studio?.payout_model === "instructor_direct") {
    const [{ count: roomsCount }, { count: tiersCount }] = await Promise.all([
      supabase.from("rooms").select("id", { count: "exact", head: true }).eq("studio_id", studioId),
      supabase
        .from("instructor_membership_tiers")
        .select("id", { count: "exact", head: true })
        .eq("studio_id", studioId),
    ]);

    const classTaskIndex = tasks.findIndex((t) => t.id === "create-class");
    const collectiveTasks: SetupTask[] = [
      {
        id: "setup-rooms",
        label: "Set up rooms",
        done: (roomsCount ?? 0) >= 1,
        href: "/settings/rooms",
        hint: "Define the rooms instructors can book.",
        helpHref: "/help/collective-mode/collective-room-management",
      },
      {
        id: "setup-tiers",
        label: "Define instructor contracts",
        done: (tiersCount ?? 0) >= 1,
        href: "/settings/contracts?tab=hourly",
        hint: "Create hourly plans for instructors.",
        helpHref: "/help/collective-mode/collective-tiers",
      },
    ];

    tasks.splice(classTaskIndex + 1, 0, ...collectiveTasks);
  }

  return tasks;
}
