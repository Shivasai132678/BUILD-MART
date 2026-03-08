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
        'rounded-xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger',
        className,
      )}
    >
      {message}
    </div>
  );
}
