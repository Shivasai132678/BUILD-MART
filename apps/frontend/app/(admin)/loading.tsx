import { SkeletonCard, SkeletonRow } from '@/components/ui/Skeleton';

export default function AdminLoading() {
  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-8 space-y-6">
      <SkeletonCard />
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonRow key={i} />
        ))}
      </div>
    </div>
  );
}
