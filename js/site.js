/* ==========================================================================
   site.js : on every page, links to other websites open in a new tab (and the browser switches to it).
   Links within this site (the same origin: home, notes, operations, the visualization on github.io) stay in the tab,
   as do jumps within the page and mail links; a link that sets its own target keeps it.
   ========================================================================== */
(function () {
'use strict';
for (const a of document.querySelectorAll('a[href]')) {
  if (a.hasAttribute('target') || !/^https?:$/.test(a.protocol) || a.origin === location.origin) continue;
  a.target = '_blank'; a.rel = 'noopener';
}
})();
