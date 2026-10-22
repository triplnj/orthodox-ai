import sanitizeHtml from "sanitize-html";

/** Escape text before adding our own paragraph markup; never decode entities. */
export function plainTextToSafeHtml(content: string): string {
  return content
    .replace(/\r\n?/g, "\n")
    .trim()
    .split(/\n\s*\n/)
    .map((paragraph) => {
      const escaped = paragraph
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
      return `<p>${escaped.replace(/\n/g, "<br />")}</p>`;
    })
    .join("");
}

/**
 * Server-side allowlist shared by writes and every HTML rendering boundary.
 * Keep semantic markup and a small subset of Docs/Word presentation styles.
 * No arbitrary CSS, event attributes, embedded documents, or executable URLs.
 */
export function sanitizeBlogHtml(content: string): string {
  return sanitizeHtml(content, {
    allowedTags: [
      "h1", "h2", "h3", "h4", "h5", "h6", "p", "br", "hr", "div", "span",
      "strong", "b", "em", "i", "u", "s", "strike", "sub", "sup",
      "ul", "ol", "li", "blockquote", "q", "cite", "a", "pre", "code",
      "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption",
      "img", "figure", "figcaption",
    ],
    allowedAttributes: {
      "*": ["style"],
      a: ["href", "title", "target", "rel"],
      ol: ["start", "type", "reversed"],
      li: ["value"],
      th: ["colspan", "rowspan", "scope"],
      td: ["colspan", "rowspan"],
      img: ["src", "alt", "title", "width", "height"],
    },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowedSchemesByTag: { img: ["http", "https"] },
    allowProtocolRelative: false,
    allowedStyles: {
      "*": {
        "font-weight": [/^(?:normal|bold|bolder|[1-9]00)$/],
        "font-style": [/^(?:normal|italic|oblique)$/],
        "text-decoration": [/^(?:none|underline|line-through)$/],
        "text-align": [/^(?:left|right|center|justify)$/],
        "margin-left": [/^\d{1,3}(?:\.\d{1,2})?(?:px|pt|em)$/],
      },
    },
    nonTextTags: [
      "script", "style", "textarea", "option", "noscript", "iframe",
      "object", "embed", "svg", "math", "template",
    ],
    transformTags: {
      a: (_tagName, attributes) => ({
        tagName: "a",
        attribs: {
          ...attributes,
          // Do not retain arbitrary window names or opener access.
          ...(attributes.target === "_blank"
            ? { target: "_blank", rel: "noopener noreferrer" }
            : { target: "_self", rel: "noopener noreferrer" }),
        },
      }),
    },
  });
}

/** Existing storage mixes rich HTML and legacy text, so retain its detection. */
export function renderBlogContent(content: string): string {
  return /<([a-z][\s\S]*?)>/i.test(content)
    ? sanitizeBlogHtml(content)
    : plainTextToSafeHtml(content);
}
