import { CloudOff } from 'lucide-react';

interface FirebaseConfigurationErrorProps {
  compact?: boolean;
}

export default function FirebaseConfigurationError({
  compact = false
}: FirebaseConfigurationErrorProps) {
  return (
    <section
      role="alert"
      className={
        compact
          ? 'rounded-2xl border border-rose-200 bg-rose-50 p-5 text-rose-900'
          : 'mx-auto flex max-w-2xl flex-col items-center rounded-3xl border border-rose-200 bg-white px-6 py-12 text-center shadow-sm sm:px-10'
      }
    >
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-100 text-rose-700">
        <CloudOff size={28} aria-hidden="true" />
      </div>
      <h1 className="text-xl font-black text-slate-900">
        Live data is unavailable
      </h1>
      <p className="mt-2 max-w-lg text-sm leading-6 text-slate-600">
        KidsGuard could not connect to its secure data service. No sample or
        placeholder child data is being displayed. Please try again later or
        contact support if the problem continues.
      </p>
    </section>
  );
}
