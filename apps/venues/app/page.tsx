// Portal Venues — B2B dashboard shell (Phase 2 fills this in: auth, event
// CRUD, live sales). Kept thin on purpose per spec §8.
export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3">
      <h1 className="font-display text-4xl font-black tracking-[0.3em] text-bone">
        PORTAL <span className="text-copper">VENUES</span>
      </h1>
      <p className="text-dim">
        Πούλα online. Διαχειρίσου το guestlist. Σκάναρε στην πόρτα.
      </p>
    </main>
  );
}
