// Skills remain ordinary /name references in drafts and outgoing messages.
// Only the editor renders them as atomic inline labels.
export function composerSkillSegments(value, skills) {
  const names = [...new Set(skills.map(skill => skill.title || skill.name).filter(Boolean))]
    .sort((a, b) => b.length - a.length);
  const segments = [];
  let plain = 0;
  for (let at = 0; at < value.length; at += 1) {
    if (value[at] !== '/') continue;
    const word = value.slice(0, at).split(/\s/u).pop();
    if (word.includes('/') || word.includes('\\') || word.endsWith(':')) continue;
    const name = names.find(title => value.startsWith(title, at + 1)
      && (at + title.length + 1 === value.length || /\s/u.test(value[at + title.length + 1])));
    if (!name) continue;
    if (at > plain) segments.push({ text: value.slice(plain, at) });
    const skill = skills.find(candidate => (candidate.title || candidate.name) === name);
    segments.push({ text: `/${name}`, name, skill });
    at += name.length;
    plain = at + 1;
  }
  if (plain < value.length) segments.push({ text: value.slice(plain) });
  return segments;
}

// Keep the parser's public plain-data contract stable for callers and tests
// that only need token boundaries. Rendering uses the enriched form above.
export function composerSegments(value, skills) {
  return composerSkillSegments(value, skills).map(segment => (
    segment.name ? { text: segment.text, name: segment.name } : { text: segment.text }
  ));
}

const ICON_SHAPES = Object.freeze({
  FileText: [['path', { d: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8ZM14 2v6h6M8 13h8M8 17h8' }]],
  Presentation: [['rect', { x: '3', y: '4', width: '18', height: '12', rx: '2' }], ['path', { d: 'M12 16v5M8 21h8M7 9h3v3H7zM13 8h4M13 11h4' }]],
  LineChart: [['path', { d: 'M3 3v18h18M19 9l-5 5-4-4-3 3' }]],
  BookOpen: [['path', { d: 'M2 4h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 4h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z' }]],
  Palette: [['path', { d: 'M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.9 0 1.6-.7 1.6-1.7 0-.8-.9-1.2-.9-2.2 0-.9.7-1.7 1.7-1.7h2c3.1 0 5.6-2.5 5.6-5.6C22 6 17.5 2 12 2Z' }], ['circle', { cx: '8.5', cy: '7.5', r: '.7' }], ['circle', { cx: '13.5', cy: '6.5', r: '.7' }], ['circle', { cx: '17.5', cy: '10.5', r: '.7' }], ['circle', { cx: '6.5', cy: '12.5', r: '.7' }]],
  Package: [['path', { d: 'm7.5 4.3 9 5.1M21 8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4a2 2 0 0 0 1-1.7ZM3.3 7l8.7 5 8.7-5M12 22V12' }]],
});

export function skillIconShapes(name) {
  return ICON_SHAPES[name] || ICON_SHAPES.Package;
}

export function readComposerNode(node) {
  if (node.nodeType === 3) return node.textContent;
  if (node.dataset?.skillText) return node.dataset.skillText;
  if (node.nodeName === 'BR') return node.dataset?.composerEnd ? '' : '\n';
  // Browsers leave a bare <br> as the caret holder after deleting the final
  // character; deliberate newlines are text nodes plus our marked end node.
  if (node.childNodes.length === 1 && node.firstChild.nodeName === 'BR'
    && !node.firstChild.dataset?.composerEnd) return '';
  return Array.from(node.childNodes, (child, index) => {
    const separator = index && /^(DIV|P)$/.test(child.nodeName) ? '\n' : '';
    return separator + readComposerNode(child);
  }).join('');
}

export function readComposerSelection(root, fallback = { start: 0, end: 0 }) {
  const selection = window.getSelection();
  if (!selection?.rangeCount || !root.contains(selection.anchorNode) || !root.contains(selection.focusNode)) return fallback;
  const selected = selection.getRangeAt(0);
  const before = document.createRange();
  before.selectNodeContents(root);
  before.setEnd(selected.startContainer, selected.startOffset);
  const start = readComposerNode(before.cloneContents()).length;
  before.setEnd(selected.endContainer, selected.endOffset);
  return { start, end: readComposerNode(before.cloneContents()).length,
    backward: selection.anchorNode === selected.endContainer && selection.anchorOffset === selected.endOffset && !selected.collapsed };
}

export function setComposerSelection(root, start, end = start, backward = false) {
  function point(offset) {
    let left = Math.max(0, offset);
    for (const node of root.childNodes) {
      const length = readComposerNode(node).length;
      if (node.nodeType === 3 && left <= length) return [node, left];
      if (left < length) {
        const index = Array.prototype.indexOf.call(root.childNodes, node);
        return [root, index + (left > 0 ? 1 : 0)];
      }
      left -= length;
    }
    return [root, root.childNodes.length];
  }
  const range = document.createRange();
  range.setStart(...point(start));
  range.setEnd(...point(end));
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
  if (backward) {
    selection.collapse(range.endContainer, range.endOffset);
    selection.extend(range.startContainer, range.startOffset);
  }
}

function skillNode(segment) {
  const chip = document.createElement('span');
  chip.contentEditable = 'false';
  chip.className = 'composer-skill-token';
  chip.dataset.skillText = segment.text;
  chip.title = segment.name;
  const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  for (const [key, value] of Object.entries({ width: '16', height: '16', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.7', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' })) icon.setAttribute(key, value);
  skillIconShapes(segment.skill?.icon).forEach(([tag, attributes]) => {
    const shape = document.createElementNS('http://www.w3.org/2000/svg', tag);
    Object.entries(attributes).forEach(([key, value]) => shape.setAttribute(key, value));
    icon.append(shape);
  });
  const label = document.createElement('span');
  label.textContent = segment.name;
  chip.append(icon, label);
  return chip;
}

export function renderComposerValue(root, value, skills) {
  const segments = composerSkillSegments(value, skills);
  const expected = segments.filter(segment => segment.name).map(segment => segment.text);
  const actual = Array.from(root.querySelectorAll('[data-skill-text]'), node => node.dataset.skillText);
  // Keep native text nodes and selection intact during ordinary typing and IME input.
  if ((value || !root.childNodes.length) && readComposerNode(root) === value
    && JSON.stringify(expected) === JSON.stringify(actual)) return false;
  const children = segments.map(segment => segment.name ? skillNode(segment) : document.createTextNode(segment.text));
  if (value.endsWith('\n')) {
    const end = document.createElement('br');
    end.dataset.composerEnd = 'true';
    children.push(end);
  }
  root.replaceChildren(...children);
  return true;
}
