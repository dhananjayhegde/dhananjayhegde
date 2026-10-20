const assert = require("node:assert/strict");
const test = require("node:test");

const { buildTableOfContents } = require("../lib/table-of-contents");

test("permalink markers are excluded from table of contents labels", () => {
  const content = `
    <h1 id="first">First heading <a class="header-anchor" href="#first"><span aria-hidden="true">#</span></a></h1>
    <h2 id="second">Second heading <a href="#second" title="Permalink" class='extra header-anchor'><span>#</span></a></h2>
  `;

  const toc = buildTableOfContents(content);

  assert.match(toc, />First heading<\/a>/);
  assert.match(toc, />Second heading<\/a>/);
  assert.doesNotMatch(toc, />[^<]*#\s*<\/a>/);
});
