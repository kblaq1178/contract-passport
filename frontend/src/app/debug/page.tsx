import DebugContracts from '@/components/debug/DebugContracts';

/**
 * The Scaffold Stacks debug console, kept reachable at /debug.
 * The home route renders the original Contract Passport UI instead.
 */
export default function DebugPage() {
  return (
    <main className="min-h-screen bg-[#131416] text-white">
      <div className="max-w-4xl mx-auto px-4">
        <DebugContracts />
      </div>
    </main>
  );
}
