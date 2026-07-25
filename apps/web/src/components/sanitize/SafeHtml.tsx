import type { ElementType } from "react";
import { sanitizeHtml } from "@/lib/sanitize/html";

type SafeHtmlProps = {
  html: string;
  as?: ElementType;
  className?: string;
};

/**
 * Renders HTML only after DOMPurify sanitization.
 * Prefer this over raw dangerouslySetInnerHTML anywhere user/content HTML is shown.
 */
export function SafeHtml({ html, as: Tag = "div", className }: SafeHtmlProps) {
  const clean = sanitizeHtml(html);
  return <Tag className={className} dangerouslySetInnerHTML={{ __html: clean }} />;
}
