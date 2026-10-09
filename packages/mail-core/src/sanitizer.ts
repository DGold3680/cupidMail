import sanitizeHtml from "sanitize-html";

export interface SanitizeOptions {
  allowRemoteImages?: boolean;
}

/**
 * Sanitizes HTML email body to protect against XSS and malicious scripts.
 */
export function sanitizeEmailHtml(
  rawHtml: string,
  options: SanitizeOptions = { allowRemoteImages: false }
): string {
  if (!rawHtml) return "";

  const allowedTags = [
    "a", "abbr", "address", "article", "aside", "b", "bdi", "bdo", "blockquote",
    "br", "caption", "cite", "code", "col", "colgroup", "dd", "del", "details",
    "dfn", "div", "dl", "dt", "em", "figcaption", "figure", "footer", "h1",
    "h2", "h3", "h4", "h5", "h6", "header", "hr", "i", "img", "ins", "kbd",
    "li", "main", "mark", "nav", "ol", "p", "pre", "q", "rp", "rt", "ruby",
    "s", "samp", "section", "small", "span", "strong", "sub", "summary",
    "sup", "table", "tbody", "td", "tfoot", "th", "thead", "time", "tr",
    "u", "ul", "var", "wbr"
  ];

  const allowedAttributes: Record<string, string[]> = {
    "*": ["style", "class", "dir", "align", "valign", "color", "bgcolor", "width", "height"],
    a: ["href", "name", "target", "rel", "title"],
    img: ["src", "alt", "title", "width", "height", "style", "loading"],
    table: ["border", "cellpadding", "cellspacing", "width", "align", "bgcolor"],
    td: ["align", "valign", "width", "height", "colspan", "rowspan", "bgcolor"],
    th: ["align", "valign", "width", "height", "colspan", "rowspan", "bgcolor"],
  };

  return sanitizeHtml(rawHtml, {
    allowedTags,
    allowedAttributes,
    allowedSchemes: ["http", "https", "mailto", "data", "cid"],
    transformTags: {
      a: (tagName, attribs) => {
        // Enforce safe rel and target on external links
        return {
          tagName: "a",
          attribs: {
            ...attribs,
            target: "_blank",
            rel: "noopener noreferrer nofollow",
          },
        };
      },
      img: (tagName, attribs) => {
        if (!options.allowRemoteImages && attribs.src && attribs.src.startsWith("http")) {
          // Replace remote image with placeholder or data-src for on-demand loading
          return {
            tagName: "span",
            attribs: {
              class: "blocked-remote-image inline-block p-1 bg-rose-50 text-rose-800 text-xs rounded border border-rose-200",
              "data-original-src": attribs.src,
            },
            text: `[Remote Image Hidden]`,
          };
        }
        return {
          tagName,
          attribs,
        };
      },
    },
  });
}
