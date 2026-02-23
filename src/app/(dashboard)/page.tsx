import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, studios(name)")
    .eq("id", user!.id)
    .single();

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">
          Welcome back, {profile?.full_name || "there"}!
        </p>
      </div>

      {/* プレースホルダーカード */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card">
          <p className="text-sm font-medium text-gray-500">Active Members</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">0</p>
        </div>
        <div className="card">
          <p className="text-sm font-medium text-gray-500">
            Today&apos;s Classes
          </p>
          <p className="mt-2 text-3xl font-bold text-gray-900">0</p>
        </div>
        <div className="card">
          <p className="text-sm font-medium text-gray-500">
            Today&apos;s Bookings
          </p>
          <p className="mt-2 text-3xl font-bold text-gray-900">0</p>
        </div>
        <div className="card">
          <p className="text-sm font-medium text-gray-500">
            This Month&apos;s Revenue
          </p>
          <p className="mt-2 text-3xl font-bold text-gray-900">$0</p>
        </div>
      </div>

      <div className="card mt-8">
        <h2 className="text-lg font-semibold text-gray-900">Getting Started</h2>
        <div className="mt-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-green-600">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <span className="text-sm text-gray-600">
              Create your account ✓
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-green-600">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <span className="text-sm text-gray-600">
              Set up your studio ✓
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-400">
              <span className="text-xs font-bold">3</span>
            </div>
            <span className="text-sm text-gray-600">
              Add your first member (coming in Step 3)
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-400">
              <span className="text-xs font-bold">4</span>
            </div>
            <span className="text-sm text-gray-600">
              Create your first class (coming in Step 4)
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
