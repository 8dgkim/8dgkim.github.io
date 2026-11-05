/* ==========================================================================
   math.js : typeset LaTeX in a note with KaTeX (assets/katex), only on notes that include it
   Delimiters: $$...$$ and \[...\] for display math, \(...\) and $...$ inline; \$ is a literal dollar.
   Text inside pre, code, script, style, textarea, or any .nomath element is left alone.
   ========================================================================== */
(function () {
'use strict';
if (!window.katex) return;
const DELIMS = [['$$', '$$', true], ['\\[', '\\]', true], ['\\(', '\\)', false], ['$', '$', false]];
const SKIP = 'pre, code, script, style, textarea, .nomath, .katex';

// the closing delimiter, not counting one escaped with a backslash
function closing(s, r, from) {
  for (let j = s.indexOf(r, from); j >= 0; j = s.indexOf(r, j + 1)) if (s[j - 1] !== '\\' || r[0] === '\\') return j;
  return -1;
}
// split a text into plain runs and math runs
function split(s) {
  const out = []; let buf = '', i = 0;
  scan: while (i < s.length) {
    if (s[i] === '\\' && s[i + 1] === '$') { buf += '$'; i += 2; continue; }
    for (const [l, r, display] of DELIMS) {
      if (!s.startsWith(l, i)) continue;
      const j = closing(s, r, i + l.length);
      if (j < 0 || j === i + l.length) continue;
      if (buf) out.push({ text: buf }); buf = '';
      out.push({ tex: s.slice(i + l.length, j), display });
      i = j + r.length; continue scan;
    }
    buf += s[i++];
  }
  if (buf) out.push({ text: buf });
  return out;
}
function typeset(root) {
  const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (/\$|\\\(|\\\[/.test(n.nodeValue) && !n.parentElement.closest(SKIP) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT),
  });
  const nodes = []; while (walk.nextNode()) nodes.push(walk.currentNode);
  for (const n of nodes) {
    const parts = split(n.nodeValue); if (!parts.some((p) => p.tex !== undefined)) continue;
    const frag = document.createDocumentFragment();
    for (const p of parts) {
      if (p.tex === undefined) { frag.appendChild(document.createTextNode(p.text)); continue; }
      const el = document.createElement('span');
      try { window.katex.render(p.tex, el, { displayMode: p.display, throwOnError: false }); } catch (e) { el.textContent = p.tex; }
      frag.appendChild(el);
    }
    n.parentNode.replaceChild(frag, n);
  }
}
typeset(document.querySelector('article') || document.body);
})();
