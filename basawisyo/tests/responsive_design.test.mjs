import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

test("RWD Architecture: HTML Viewport Meta Configuration", () => {
  const html = fs.readFileSync(path.join(rootDir, "index.html"), "utf8");
  assert.match(
    html,
    /<meta\s+name=["']viewport["']\s+content=["'][^"']*width=device-width[^"']*viewport-fit=cover[^"']*["']/i,
    "index.html must define viewport meta with width=device-width and viewport-fit=cover"
  );
});

test("RWD Architecture: Fluid Root Container & Typography System", () => {
  const baseCss = fs.readFileSync(path.join(rootDir, "src", "styles", "base.css"), "utf8");

  // Fluid typography tokens
  assert.match(baseCss, /--font-h1:\s*clamp\(/, "Must define fluid --font-h1 clamp");
  assert.match(baseCss, /--font-h2:\s*clamp\(/, "Must define fluid --font-h2 clamp");
  assert.match(baseCss, /--font-h3:\s*clamp\(/, "Must define fluid --font-h3 clamp");
  assert.match(baseCss, /--font-reading:\s*clamp\(/, "Must define fluid --font-reading clamp");

  // Fluid #app container
  assert.match(baseCss, /#app\s*\{[^}]*clamp\(/, "#app must use fluid clamp padding");
  assert.match(baseCss, /@media\s*\(max-width:\s*767px\)\s*\{\s*#app\s*\{[^}]*safe-area-inset-bottom/, "#app must clear safe area on mobile");
});

test("RWD Architecture: Navigation Responsive Geometry & Touch Targets", () => {
  const navCss = fs.readFileSync(path.join(rootDir, "src", "styles", "navigation.css"), "utf8");

  // Mobile navigation (< 768px)
  assert.match(navCss, /@media\s*\(max-width:\s*767px\)/, "Must define mobile navigation breakpoint");
  assert.match(navCss, /nav\s*button\s*\{[^}]*min-height:\s*56px/, "Mobile nav buttons must satisfy WCAG minimum 44px (set to 56px)");
  assert.match(navCss, /nav\s*button\s*\{[^}]*clamp\(/, "Mobile nav buttons must use fluid typography");
  assert.match(navCss, /nav\s*button\s*\{[^}]*text-overflow:\s*ellipsis/, "Mobile nav buttons must protect against text overflow");

  // Desktop navigation (>= 768px)
  assert.match(navCss, /@media\s*\(min-width:\s*768px\)/, "Must define tablet/desktop navigation breakpoint");
  assert.match(navCss, /#sn\s*button\s*\{[^}]*white-space:\s*nowrap/, "Desktop pill buttons must have white-space: nowrap");
});

test("RWD Architecture: Reading Studio Split-Screen Standard Breakpoint", () => {
  const baseCss = fs.readFileSync(path.join(rootDir, "src", "styles", "base.css"), "utf8");
  const studioCss = fs.readFileSync(path.join(rootDir, "src", "styles", "reading-studio.css"), "utf8");
  const visualCss = fs.readFileSync(path.join(rootDir, "src", "styles", "visual-system.css"), "utf8");

  // All reading split behaviors standardized on 768px
  assert.match(baseCss, /@media\s*\(min-width:\s*768px\)\s*\{\s*\.reading-split/, "reading-split must activate at 768px");
  assert.match(studioCss, /@media\s*\(max-width:\s*767px\)\s*\{\s*\.studio-grid/, "studio-grid single-column must be bounded below 768px");
  assert.match(visualCss, /@media\s*\(max-width:\s*767px\)\s*\{\s*\.reading-passage-col/, "reading-passage-col spacing must align at 768px");
});

test("RWD Architecture: Data Table Sticky Columns & Mobile Scroll Cues", () => {
  const dashCss = fs.readFileSync(path.join(rootDir, "src", "styles", "learning-dashboards.css"), "utf8");
  const rolesCss = fs.readFileSync(path.join(rootDir, "src", "styles", "roles.css"), "utf8");

  // Table wrapper
  assert.match(rolesCss, /\.responsive-table-wrap\s*\{[^}]*overflow-x:\s*auto/, "Table wrapper must have horizontal scroll");
  
  // Sticky first column on mobile
  assert.match(dashCss, /@media\s*\(max-width:\s*767px\)\s*\{[^}]*th:first-child[^}]*position:\s*sticky/, "First column header must be sticky on mobile");
  assert.match(dashCss, /@media\s*\(max-width:\s*767px\)\s*\{[^}]*td:first-child[^}]*position:\s*sticky/, "First column data cell must be sticky on mobile");

  // Scroll hint indicator
  assert.match(dashCss, /\.table-scroll-hint/, "Must define .table-scroll-hint style");
});

test("RWD Architecture: Modals & Universal Popups Small Viewport Compliance", () => {
  const baseCss = fs.readFileSync(path.join(rootDir, "src", "styles", "base.css"), "utf8");
  const html = fs.readFileSync(path.join(rootDir, "index.html"), "utf8");

  // Universal Pop-up card bounds
  assert.match(baseCss, /\.app-popup-card\s*\{[^}]*max-width:\s*min\(440px/, "Universal popup must respect small viewport widths");
  assert.match(baseCss, /\.app-popup-card\s*\{[^}]*max-height:\s*calc\(100dvh\s*-\s*32px\)/, "Universal popup must respect small viewport heights");
  assert.match(baseCss, /\.app-popup-card\s*\{[^}]*overflow-y:\s*auto/, "Universal popup must support internal scrolling");

  // Payment Notice modal bounds
  assert.match(html, /id=["']payment-notice-modal["'][^>]*style=["'][^"']*z-index:\s*2000/, "Payment notice modal has elevated z-index");
  assert.match(html, /payment-notice-modal[\s\S]*?max-height:\s*calc\(100dvh\s*-\s*32px\)/, "Payment notice card respects dynamic viewport height");
});
