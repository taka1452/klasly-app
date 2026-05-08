"use client";

import { useState } from "react";
import InstructorProfileCard from "./instructor-profile-card";

type Instructor = {
  id: string;
  profile_id?: string;
  profiles?: { full_name?: string; email?: string; phone?: string } | null;
  specialties: string[] | null;
};

type Props = {
  instructors: Instructor[];
  classCountByInstructor: Record<string, number>;
  memberProfileIds?: string[];
};

export default function InstructorsListClient({
  instructors,
  classCountByInstructor,
  memberProfileIds = [],
}: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const memberSet = new Set(memberProfileIds);

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {instructors.map((instructor) => {
          const profileData = instructor.profiles as {
            full_name?: string;
            email?: string;
            phone?: string;
          } | null;
          const raw = Array.isArray(profileData) ? profileData[0] : profileData;
          const specialties = instructor.specialties as string[] | null;
          const classCount = classCountByInstructor[instructor.id] ?? 0;

          return (
            <button
              key={instructor.id}
              type="button"
              onClick={() => setSelectedId(instructor.id)}
              className="card cursor-pointer text-left transition-[transform,background-color] duration-150 ease-out hover:bg-gray-50 active:scale-[0.98]"
            >
              <h3 className="font-medium text-gray-900">
                {raw?.full_name || "—"}
                {instructor.profile_id && memberSet.has(instructor.profile_id) && (
                  <span className="ml-1.5 inline-flex rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-700">
                    Member
                  </span>
                )}
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                {raw?.email || "—"}
              </p>
              {specialties && specialties.length > 0 && (
                <p className="mt-2 text-xs text-gray-600">
                  {specialties.join(", ")}
                </p>
              )}
              <p className="mt-2 text-xs text-gray-400">
                {classCount} class{classCount !== 1 ? "es" : ""} assigned
              </p>
              <span className="mt-4 inline-block text-sm font-medium text-brand-600">
                View
              </span>
            </button>
          );
        })}
      </div>

      <InstructorProfileCard
        instructorId={selectedId ?? ""}
        open={!!selectedId}
        onClose={() => setSelectedId(null)}
      />
    </>
  );
}
