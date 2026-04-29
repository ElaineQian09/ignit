import { cn } from "@/lib/utils";

interface FormNoticeProps {
  message?: string;
  tone?: "error" | "success";
}

export function FormNotice({ message, tone = "success" }: FormNoticeProps) {
  if (!message) {
    return null;
  }

  return (
    <div
      className={cn(
        "rounded-2xl border px-4 py-3 text-sm",
        tone === "error"
          ? "border-red-200 bg-red-50 text-red-700"
          : "border-emerald-200 bg-emerald-50 text-emerald-700"
      )}
    >
      {message}
    </div>
  );
}

