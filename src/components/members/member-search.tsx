"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

type Props = {
  currentQuery: string;
  currentStatus: string;
};

export default function MemberSearch({ currentQuery, currentStatus }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(currentQuery);

  function updateParams(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== "all") {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`/members?${params.toString()}`);
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    updateParams("q", query);
  }

  return (
    <div className="mt-4 flex flex-col gap-3 sm:flex-row">
      <form onSubmit={handleSearch} className="flex flex-1 gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or email..."
          className="input-field flex-1"
        />
        <button type="submit" className="btn-secondary">
          Search
        </button>
      </form>
      <select
        value={currentStatus}
        onChange={(e) => updateParams("status", e.target.value)}
        className="input-field w-full sm:w-40"
      >
        <option value="all">All status</option>
        <option value="active">Active</option>
        <option value="paused">Paused</option>
        <option value="cancelled">Cancelled</option>
      </select>
    </div>
  );
}
