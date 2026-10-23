function parseInline(text) {
  const parts = [];
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let last = 0;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index));

    const token = match[0];
    if (token.startsWith("**")) {
      parts.push(<strong key={match.index}>{token.slice(2, -2)}</strong>);
    } else {
      parts.push(<em key={match.index}>{token.slice(1, -1)}</em>);
    }

    last = pattern.lastIndex;
  }

  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

export default function RichText({ value, className = "" }) {
  if (!value) return null;

  const lines = String(value).split("\n");
  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (/^\s*-\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*-\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*-\s+/, ""));
        i += 1;
      }
      blocks.push(
        <ul key={`ul-${i}`}>
          {items.map((item, index) => <li key={index}>{parseInline(item)}</li>)}
        </ul>
      );
      continue;
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ""));
        i += 1;
      }
      blocks.push(
        <ol key={`ol-${i}`}>
          {items.map((item, index) => <li key={index}>{parseInline(item)}</li>)}
        </ol>
      );
      continue;
    }

    if (!line.trim()) {
      i += 1;
      continue;
    }

    const paragraph = [line];
    i += 1;

    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^\s*-\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i])
    ) {
      paragraph.push(lines[i]);
      i += 1;
    }

    blocks.push(
      <p key={`p-${i}`}>
        {paragraph.map((part, index) => (
          <span key={index}>
            {parseInline(part)}
            {index < paragraph.length - 1 ? <br /> : null}
          </span>
        ))}
      </p>
    );
  }

  return <div className={`rich-text ${className}`.trim()}>{blocks}</div>;
}
