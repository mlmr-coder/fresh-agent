// Skills remain ordinary /name references in drafts and outgoing messages.
// Only the editor renders them as atomic inline labels.
export function composerSegments(value, skills) {
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
    segments.push({ text: `/${name}`, name });
    at += name.length;
    plain = at + 1;
  }
  if (plain < value.length) segments.push({ text: value.slice(plain) });
  return segments;
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
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'M14.5 3.5 20.5 9.5 M13 2l9 9-3 3-9-9 3-3Z M11.5 9.5 3 18l3 3 8.5-8.5 M4 17l3 3');
  icon.append(path);
  const label = document.createElement('span');
  label.textContent = segment.name;
  chip.append(icon, label);
  return chip;
}

export function renderComposerValue(root, value, skills) {
  const segments = composerSegments(value, skills);
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
