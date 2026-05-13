const URL_PATTERN = /https?:\/\/\S+/gi;
const CODE_BLOCK_PATTERN = /```[\s\S]*?```/g;
const INLINE_CODE_PATTERN = /`[^`]+`/g;

const PROMPT_INJECTION_PATTERNS = [
  /ignore\s+(all|any|the)\s+(previous|prior)\s+instructions/gi,
  /system\s+prompt/gi,
  /developer\s+message/gi,
  /\bassistant\s*:/gi,
  /\buser\s*:/gi,
  /\btool\s*:/gi,
  /act\s+as\s+/gi,
  /roleplay\s+as\s+/gi,
  /do\s+not\s+follow\s+the\s+rules/gi
] as const;

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function sanitizePromptInput(value: string, maxLength = 500) {
  const stripped = value
    .replace(CODE_BLOCK_PATTERN, " ")
    .replace(INLINE_CODE_PATTERN, " ")
    .replace(URL_PATTERN, "[link]")
    .replace(/[#>*_~[\](){|}]/g, " ");

  const withoutInjection = PROMPT_INJECTION_PATTERNS.reduce(
    (current, pattern) => current.replace(pattern, " "),
    stripped
  );

  return normalizeWhitespace(withoutInjection).slice(0, maxLength);
}
