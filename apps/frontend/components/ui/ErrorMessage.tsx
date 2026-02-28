import { cn } from '@/lib/utils';

type ErrorMessageProps = {
  message?: string | null;
  className?: string;
};

export function ErrorMessage({ message, className = '' }: ErrorMessageProps) {
  if (!message) {
    return null;
  }

  return (
    <div
      role="alert"
      className={cn(
        'rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700',
        className,
      )}
    >
      {message}
    </div>
  );
}
