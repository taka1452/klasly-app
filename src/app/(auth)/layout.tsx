export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      {/* 左側: ブランドパネル */}
      <div className="hidden lg:flex lg:w-1/2 lg:flex-col lg:justify-between bg-brand-700 p-12 text-white">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Klasly</h1>
          <p className="mt-1 text-brand-200 text-sm">
            Studio Management Made Simple
          </p>
        </div>
        <div>
          <p className="text-xl font-medium leading-relaxed">
            Built for small studios.
            <br />
            Not enterprise gyms.
          </p>
          <p className="mt-4 text-sm text-brand-300">
            Manage members, classes, bookings, and payments — all in one place.
          </p>
        </div>
        <p className="text-xs text-brand-400">© 2025 Klasly. All rights reserved.</p>
      </div>

      {/* 右側: フォーム */}
      <div className="flex w-full items-center justify-center px-6 lg:w-1/2">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}
