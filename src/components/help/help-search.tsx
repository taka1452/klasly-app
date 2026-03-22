'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { helpArticles } from '@/data/help-articles';
import Link from 'next/link';

export default function HelpSearch() {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const results = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (q.length < 2) return [];
    return helpArticles
      .filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          a.summary.toLowerCase().includes(q) ||
          a.keywords.some((k) => k.includes(q))
      )
      .slice(0, 8);
  }, [query]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={ref} className="relative w-full max-w-xl mx-auto">
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
          />
        </svg>
        <input
          type="text"
          placeholder="Search help articles..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none text-sm bg-white"
        />
      </div>
      {isOpen && results.length > 0 && (
        <div className="absolute top-full mt-2 w-full bg-white rounded-xl border border-gray-200 shadow-lg z-50 overflow-hidden">
          {results.map((article) => (
            <Link
              key={article.id}
              href={`/help/${article.category}/${article.id}`}
              onClick={() => {
                setIsOpen(false);
                setQuery('');
              }}
              className="block px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
            >
              <div className="font-medium text-sm text-gray-900">
                {article.title}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">
                {article.summary}
              </div>
            </Link>
          ))}
        </div>
      )}
      {isOpen && query.length >= 2 && results.length === 0 && (
        <div className="absolute top-full mt-2 w-full bg-white rounded-xl border border-gray-200 shadow-lg z-50 p-4 text-center text-sm text-gray-500">
          No articles found for &quot;{query}&quot;
        </div>
      )}
    </div>
  );
}
