import { v4 as uuidv4 } from "uuid";

/**
 * Converts raw HTML email content into a valid Unlayer design JSON.
 *
 * Strategy: parse the HTML body into paragraphs and map each to an
 * Unlayer "paragraph" content block inside a single row + column layout.
 *
 * For complex or unparseable HTML, falls back to a single Unlayer
 * "html" (custom HTML) block wrapping the entire body content.
 */
export function htmlToUnlayerDesign(html: string): Record<string, any> {
  const bodyHtml = extractBodyContent(html);
  const blocks = parseHtmlToBlocks(bodyHtml);

  const contentBlocks =
    blocks.length > 0 ? blocks : [makeCustomHtmlBlock(bodyHtml)];

  const counters: Record<string, number> = {
    u_column: 1,
    u_row: 1,
  };

  contentBlocks.forEach((block) => {
    const key = `u_content_${block.type}`;
    counters[key] = (counters[key] || 0) + 1;
  });

  return {
    counters,
    body: {
      id: shortId(),
      rows: [
        {
          id: shortId(),
          cells: [1],
          columns: [
            {
              id: shortId(),
              contents: contentBlocks,
              values: {
                backgroundColor: "",
                padding: "0px",
                border: {},
                borderRadius: "0px",
                _meta: { htmlID: "u_column_1", htmlClassNames: "u_column" },
                deletable: true,
                locked: false,
              },
            },
          ],
          values: {
            displayCondition: null,
            columns: false,
            _styleGuide: null,
            backgroundColor: "",
            columnsBackgroundColor: "",
            backgroundImage: {
              url: "",
              fullWidth: true,
              repeat: "no-repeat",
              size: "custom",
              position: "center",
              customPosition: ["50%", "50%"],
            },
            padding: "0px",
            anchor: "",
            hideDesktop: false,
            _meta: { htmlID: "u_row_1", htmlClassNames: "u_row" },
            selectable: true,
            draggable: true,
            duplicatable: true,
            deletable: true,
            hideable: true,
            locked: false,
          },
        },
      ],
      headers: [],
      footers: [],
      values: {
        _styleGuide: null,
        popupPosition: "center",
        popupDisplayDelay: 0,
        popupWidth: "600px",
        popupHeight: "auto",
        borderRadius: "10px",
        contentAlign: "center",
        contentVerticalAlign: "middle",
        contentWidth: "500px",
        fontFamily: {
          label: "Arial",
          value: "arial,helvetica,sans-serif",
        },
        textColor: "#000000",
        popupBackgroundColor: "#FFFFFF",
        popupBackgroundImage: {
          url: "",
          fullWidth: true,
          repeat: "no-repeat",
          size: "cover",
          position: "center",
          customPosition: ["50%", "50%"],
        },
        popupOverlay_backgroundColor: "rgba(0, 0, 0, 0.1)",
        popupCloseButton_position: "top-right",
        popupCloseButton_backgroundColor: "#DDDDDD",
        popupCloseButton_iconColor: "#000000",
        popupCloseButton_borderRadius: "0px",
        popupCloseButton_margin: "0px",
        popupCloseButton_action: {
          name: "close_popup",
          attrs: {
            onClick:
              "document.querySelector('.u-popup-container').style.display = 'none';",
          },
        },
        language: {},
        backgroundColor: "#F7F8F9",
        preheaderText: "",
        linkStyle: {
          body: true,
          linkColor: "#0000ee",
          linkHoverColor: "#0000ee",
          linkUnderline: true,
          linkHoverUnderline: true,
        },
        backgroundImage: {
          url: "",
          fullWidth: true,
          repeat: "no-repeat",
          size: "custom",
          position: "center",
          customPosition: ["50%", "50%"],
        },
        accessibilityTitle: "",
        _meta: { htmlID: "u_body", htmlClassNames: "u_body" },
      },
    },
    schemaVersion: 24,
  };
}

function shortId(): string {
  return uuidv4().slice(0, 10);
}

/**
 * Extracts the inner content of <body> from a full HTML document.
 * Then unwraps single-cell table layouts common in email HTML.
 */
function extractBodyContent(html: string): string {
  // Extract content between <body> tags
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  let content = bodyMatch ? bodyMatch[1].trim() : html.trim();

  // Email templates often wrap content in <table><tr><td>...</td></tr></table>
  // Try to unwrap if there's a single <td>
  const tdMatch = content.match(/<td[^>]*>([\s\S]*?)<\/td>/i);
  if (tdMatch) {
    content = tdMatch[1].trim();
  }

  return content;
}

/**
 * Parses simple HTML (paragraphs with inline formatting) into
 * Unlayer content blocks.
 */
function parseHtmlToBlocks(html: string): any[] {
  const blocks: any[] = [];
  let paragraphCounter = 0;

  // Split on <p> tags, keeping their content
  const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  let match;

  while ((match = pRegex.exec(html)) !== null) {
    const innerHtml = match[1].trim();
    if (!innerHtml) continue;

    paragraphCounter++;
    blocks.push(makeParagraphBlock(innerHtml, paragraphCounter));
  }

  return blocks;
}

/**
 * Converts inner HTML (with <strong>, <br>, plain text) into
 * Unlayer's Lexical textJson format.
 */
function htmlToLexicalChildren(innerHtml: string): any[] {
  const children: any[] = [];

  // Tokenize: split on <strong>...</strong>, <b>...</b>, <br />, <br>, and <a>
  const tokenRegex =
    /<strong>([\s\S]*?)<\/strong>|<b>([\s\S]*?)<\/b>|<br\s*\/?>|<a\s+[^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>|([^<]+)/gi;
  let tokenMatch;

  while ((tokenMatch = tokenRegex.exec(innerHtml)) !== null) {
    const [fullMatch, strongText, boldText, href, linkText, plainText] =
      tokenMatch;

    if (strongText !== undefined || boldText !== undefined) {
      const text = (strongText || boldText).trim();
      if (text) {
        children.push({
          detail: 0,
          format: 1, // bold
          mode: "normal",
          style: "",
          text,
          type: "extended-text",
          version: 1,
        });
      }
    } else if (fullMatch.match(/^<br/i)) {
      children.push({ type: "linebreak", version: 1 });
    } else if (href !== undefined) {
      children.push({
        detail: 0,
        format: 0,
        mode: "normal",
        style: "",
        text: (linkText || href).trim(),
        type: "extended-text",
        version: 1,
      });
    } else if (plainText !== undefined) {
      const text = plainText.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
      if (text.trim()) {
        children.push({
          detail: 0,
          format: 0,
          mode: "normal",
          style: "",
          text,
          type: "extended-text",
          version: 1,
        });
      }
    }
  }

  return children.length > 0
    ? children
    : [
        {
          detail: 0,
          format: 0,
          mode: "normal",
          style: "",
          text: " ",
          type: "extended-text",
          version: 1,
        },
      ];
}

function makeTextJson(innerHtml: string): string {
  const children = htmlToLexicalChildren(innerHtml);

  return JSON.stringify({
    root: {
      children: [
        {
          children,
          format: "",
          indent: 0,
          type: "extended-paragraph",
          version: 1,
          textFormat: 0,
          textStyle: "",
        },
      ],
      format: "",
      indent: 0,
      type: "root",
      version: 1,
    },
  });
}

function makeParagraphBlock(innerHtml: string, counter: number): any {
  return {
    id: shortId(),
    type: "paragraph",
    values: {
      textJson: makeTextJson(innerHtml),
      containerPadding: "10px",
      anchor: "",
      fontSize: "14px",
      textAlign: "left",
      lineHeight: "140%",
      linkStyle: {
        inherit: true,
        linkColor: "#0000ee",
        linkHoverColor: "#0000ee",
        linkUnderline: true,
        linkHoverUnderline: true,
      },
      displayCondition: null,
      _styleGuide: null,
      _meta: {
        htmlID: `u_content_paragraph_${counter}`,
        htmlClassNames: "u_content_paragraph",
      },
      selectable: true,
      draggable: true,
      duplicatable: true,
      deletable: true,
      hideable: true,
      locked: false,
      _languages: {},
    },
  };
}

/**
 * Fallback: wraps the entire HTML into a single Unlayer custom HTML block.
 */
function makeCustomHtmlBlock(html: string): any {
  return {
    id: shortId(),
    type: "html",
    values: {
      html,
      containerPadding: "10px",
      anchor: "",
      displayCondition: null,
      _styleGuide: null,
      _meta: {
        htmlID: "u_content_html_1",
        htmlClassNames: "u_content_html",
      },
      selectable: true,
      draggable: true,
      duplicatable: true,
      deletable: true,
      hideable: true,
      locked: false,
      _languages: {},
    },
  };
}

/**
 * Returns true if json_data is empty/missing and needs to be generated.
 */
export function isEmptyDesign(jsonData: any): boolean {
  if (!jsonData) return true;
  if (typeof jsonData === "object" && Object.keys(jsonData).length === 0)
    return true;
  return false;
}
