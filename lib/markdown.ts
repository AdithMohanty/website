// Small Markdown renderer for blog posts: headings, paragraphs, bold, italic,
// code, links, images, lists, quotes, code blocks and rules.

function escape(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function safeUrl(url: string) {
  return /^(https?:|mailto:|\/|#)/i.test(url) ? url : "#";
}

function inline(text: string) {
  let s = escape(text);
  s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+&quot;([^&]*)&quot;)?\)/g, (_, alt, url, cap) => {
    const img = `<img src="${safeUrl(url)}" alt="${alt}" loading="lazy" />`;
    return cap ? `<figure>${img}<figcaption>${cap}</figcaption></figure>` : img;
  });
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, url) => `<a href="${safeUrl(url)}">${label}</a>`);
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>");
  return s;
}

export function renderMarkdown(md: string) {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      i++;
      continue;
    }

    if (line.startsWith("```")) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) code.push(lines[i++]);
      i++;
      out.push(`<pre><code>${escape(code.join("\n"))}</code></pre>`);
      continue;
    }

    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      const level = Math.min(heading[1].length + 1, 5);
      out.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      i++;
      continue;
    }

    if (/^(-{3,}|\*{3,})$/.test(line.trim())) {
      out.push("<hr />");
      i++;
      continue;
    }

    if (line.startsWith(">")) {
      const quote: string[] = [];
      while (i < lines.length && lines[i].startsWith(">")) quote.push(lines[i++].replace(/^>\s?/, ""));
      out.push(`<blockquote><p>${inline(quote.join(" "))}</p></blockquote>`);
      continue;
    }

    const ordered = /^\d+\.\s+/;
    const unordered = /^[-*]\s+/;
    if (ordered.test(line) || unordered.test(line)) {
      const pattern = ordered.test(line) ? ordered : unordered;
      const tag = pattern === ordered ? "ol" : "ul";
      const items: string[] = [];
      while (i < lines.length && pattern.test(lines[i])) {
        items.push(`<li>${inline(lines[i++].replace(pattern, ""))}</li>`);
      }
      out.push(`<${tag}>${items.join("")}</${tag}>`);
      continue;
    }

    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(#{1,4}\s|```|>|[-*]\s|\d+\.\s)/.test(lines[i]) &&
      !/^(-{3,}|\*{3,})$/.test(lines[i].trim())
    ) {
      para.push(lines[i++]);
    }
    const html = inline(para.join(" "));
    out.push(/^<(figure|img)[^]*>$/.test(html) ? html : `<p>${html}</p>`);
  }

  return out.join("\n");
}
