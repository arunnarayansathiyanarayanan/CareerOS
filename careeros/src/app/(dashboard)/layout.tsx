import { AppHeader } from "@/components/dashboard/AppHeader";

export default function DashboardGroupLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="dark min-h-full bg-[#0A0A0A] text-zinc-100">
      <AppHeader />
      {children}
    </div>
  );
}
