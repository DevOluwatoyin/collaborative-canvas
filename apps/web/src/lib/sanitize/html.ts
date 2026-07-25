import DOMPurify from "isomorphic-dompurify";

type SanitizeConfig = Parameters<typeof DOMPurify.sanitize>[1];

const DEFAULT_CONFIG: SanitizeConfig = {
  USE_PROFILES: { html: true },
};

/** Sanitize untrusted HTML before rendering into the DOM. */
export function sanitizeHtml(
  dirty: string,
  config: SanitizeConfig = DEFAULT_CONFIG
): string {
  return DOMPurify.sanitize(dirty, config);
}
