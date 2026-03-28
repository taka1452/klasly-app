type Props = {
  locationName?: string | null;
  locationAddress?: string | null;
  lat?: number | null;
  lng?: number | null;
};

export default function EventMap({ locationName, locationAddress, lat, lng }: Props) {
  // Need either coordinates or an address to show the map
  const query = lat && lng
    ? `${lat},${lng}`
    : locationAddress || locationName;

  if (!query) return null;

  const embedUrl = `https://www.google.com/maps/embed/v1/place?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY || ""}&q=${encodeURIComponent(query)}`;

  // If no API key configured, show a link instead
  if (!process.env.NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY) {
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
    return (
      <a
        href={mapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-blue-600 hover:bg-gray-100"
      >
        <svg className="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <span>View on Google Maps →</span>
      </a>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200">
      <iframe
        src={embedUrl}
        width="100%"
        height="300"
        style={{ border: 0 }}
        allowFullScreen
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        title={`Map: ${locationName || locationAddress}`}
      />
    </div>
  );
}
