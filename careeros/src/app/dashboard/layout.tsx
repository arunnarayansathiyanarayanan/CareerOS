export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="dark min-h-full bg-[#0A0A0A] text-zinc-100">
      <header className="border-b border-zinc-900/80 px-4 py-4 sm:px-6">
        <span className="text-sm font-semibold tracking-tight text-zinc-300">
          CareerOS
        </span>
      </header>
      {children}
    </div>
  );
}
