type PackingItem = {
  item: string;
  category?: string;
};

type Props = {
  items: PackingItem[];
};

export default function EventPackingList({ items }: Props) {
  if (!items || items.length === 0) return null;

  // Group by category
  const grouped = items.reduce(
    (acc, item) => {
      const cat = item.category || "General";
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(item.item);
      return acc;
    },
    {} as Record<string, string[]>,
  );

  const categories = Object.keys(grouped).sort();

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-5">
      {categories.length === 1 && categories[0] === "General" ? (
        <ul className="grid gap-1.5 sm:grid-cols-2">
          {grouped["General"].map((item, i) => (
            <li key={i} className="flex items-center gap-2 text-sm text-gray-700">
              <svg className="h-4 w-4 flex-shrink-0 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <div className="space-y-4">
          {categories.map((cat) => (
            <div key={cat}>
              <h4 className="text-sm font-semibold text-gray-700">{cat}</h4>
              <ul className="mt-1.5 grid gap-1 sm:grid-cols-2">
                {grouped[cat].map((item, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-gray-600">
                    <svg className="h-4 w-4 flex-shrink-0 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
