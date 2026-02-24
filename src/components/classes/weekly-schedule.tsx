"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { getDayName, formatTime } from "@/lib/utils";
import type { Class } from "@/types/database";

type Props = {
  classes: Class[];
};

// 曜日表示順: Mon(1), Tue(2), Wed(3), Thu(4), Fri(5), Sat(6), Sun(0)
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

export default function WeeklySchedule({ classes }: Props) {
  const router = useRouter();

  const classesByDay = DAY_ORDER.reduce((acc, dayOfWeek) => {
    acc[dayOfWeek] = classes.filter((c) => c.day_of_week === dayOfWeek);
    return acc;
  }, {} as Record<number, Class[]>);

  return (
    <div className="overflow-x-auto">
      {/* デスクトップ: 7列グリッド */}
      <div className="hidden min-w-[600px] grid-cols-7 gap-4 md:grid">
        {DAY_ORDER.map((dayOfWeek) => (
          <div
            key={dayOfWeek}
            className="flex flex-col rounded-lg border border-gray-200 bg-gray-50/50 p-3"
          >
            <h3 className="mb-3 text-center text-sm font-semibold text-gray-700">
              {getDayName(dayOfWeek).slice(0, 3)}
            </h3>
            <div className="flex flex-1 flex-col gap-2">
              {classesByDay[dayOfWeek]?.length ? (
                classesByDay[dayOfWeek].map((cls) => (
                  <Link
                    key={cls.id}
                    href={`/classes/${cls.id}`}
                    className="card block cursor-pointer p-3 transition-colors hover:border-brand-300 hover:bg-brand-50/50"
                  >
                    <p className="font-medium text-gray-900">{cls.name}</p>
                    <p className="mt-1 text-xs text-gray-600">
                      {formatTime(cls.start_time)}
                    </p>
                    <p className="text-xs text-gray-500">
                      {cls.duration_minutes} min · {cls.capacity} spots
                    </p>
                  </Link>
                ))
              ) : (
                <p className="py-4 text-center text-sm text-gray-400">
                  No classes
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* モバイル: 縦並びリスト */}
      <div className="space-y-4 md:hidden">
        {DAY_ORDER.map((dayOfWeek) => (
          <div key={dayOfWeek} className="rounded-lg border border-gray-200 p-4">
            <h3 className="mb-3 text-sm font-semibold text-gray-700">
              {getDayName(dayOfWeek)}
            </h3>
            {classesByDay[dayOfWeek]?.length ? (
              <div className="space-y-2">
                {classesByDay[dayOfWeek].map((cls) => (
                  <button
                    key={cls.id}
                    type="button"
                    onClick={() => router.push(`/classes/${cls.id}`)}
                    className="card w-full p-3 text-left transition-colors hover:border-brand-300 hover:bg-brand-50/50"
                  >
                    <p className="font-medium text-gray-900">{cls.name}</p>
                    <p className="mt-1 text-xs text-gray-600">
                      {formatTime(cls.start_time)}
                    </p>
                    <p className="text-xs text-gray-500">
                      {cls.duration_minutes} min · {cls.capacity} spots
                    </p>
                  </button>
                ))}
              </div>
            ) : (
              <p className="py-2 text-sm text-gray-400">No classes</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
