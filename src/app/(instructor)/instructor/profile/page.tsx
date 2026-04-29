import InstructorProfileForm from "@/components/instructor/instructor-profile-form";
import CalendarFeedCard from "@/components/settings/calendar-feed-card";

export default function InstructorProfilePage() {
  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight text-gray-900">
        My Profile
      </h1>
      <InstructorProfileForm />

      <div className="mt-8">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
          Schedule
        </h2>
        <CalendarFeedCard />
      </div>
    </div>
  );
}
