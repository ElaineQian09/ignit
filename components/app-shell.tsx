export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-6rem] top-[-6rem] h-56 w-56 rounded-full bg-[rgba(235,91,44,0.15)] blur-3xl" />
        <div className="absolute bottom-0 right-[-8rem] h-72 w-72 rounded-full bg-[rgba(15,118,110,0.12)] blur-3xl" />
      </div>
      <main className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 py-6 sm:px-8 lg:px-10">
        {children}
      </main>
    </div>
  );
}

