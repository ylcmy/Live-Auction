interface LoadingSpinnerProps {
  text?: string;
}

export default function LoadingSpinner({ text }: LoadingSpinnerProps) {
  return (
    <div className="flex flex-col items-center justify-center h-80 gap-3">
      <div className="w-10 h-10 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      {text && <p className="text-text-tertiary text-sm">{text}</p>}
    </div>
  );
}
