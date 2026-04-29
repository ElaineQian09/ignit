"use client";

import { useFormStatus } from "react-dom";

export function useSubmitDisabled() {
  const { pending } = useFormStatus();

  return pending;
}

