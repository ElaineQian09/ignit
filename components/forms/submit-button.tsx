"use client";

import { useSubmitDisabled } from "@/hooks/use-submit-disabled";
import { cn } from "@/lib/utils";

interface SubmitButtonProps {
  label: string;
  pendingLabel: string;
  className?: string;
}

export function SubmitButton({
  label,
  pendingLabel,
  className
}: SubmitButtonProps) {
  const pending = useSubmitDisabled();

  return (
    <button
      type="submit"
      disabled={pending}
      className={cn(
        "inline-flex items-center justify-center rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(163,51,18,0.22)] hover:-translate-y-0.5 hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0",
        className
      )}
    >
      {pending ? pendingLabel : label}
    </button>
  );
}

