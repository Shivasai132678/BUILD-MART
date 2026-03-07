import { SkeletonCard, SkeletonStatCard, SkeletonRow } from '@/components/ui/Skeleton';

export default function BuyerLoading() {
  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-8 space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonStatCard key={i} />
        ))}
      </div>
      <SkeletonCard />
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <SkeletonRow key={i} />
        ))}
      </div>
    </div>
  );
}
