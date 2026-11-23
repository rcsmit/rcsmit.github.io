// version = "20261123-120700"
import { initNav } from "./nav.js";
import { initFilter } from "./filter.js";
import { initDialog } from "./dialog.js";
import { initForms } from "./forms.js";
import { initTimer } from "./timer.js";

const version = "20261123-120700";
document.documentElement.dataset.version = version;

// Hero stagger fallback (dynamic-sibling-animations guide).
if (!CSS.supports("animation-delay: calc(sibling-index() * 0.1s)")) {
  [...(document.querySelector(".hero-copy")?.children ?? [])].forEach((el, i) =>
    el.style.setProperty("--sibling-index", String(i + 1)));
}

// Popover polyfill only where the Popover API is missing (navbar guide).
const needsPopoverPolyfill = !Object.hasOwn(HTMLElement.prototype, "popover");
const ready = needsPopoverPolyfill
  ? import("../assets/vendor/popover-polyfill-0.7.3.min.js").catch(() => {})
  : Promise.resolve();

ready.then(() => {
  initNav();
  initFilter();
  initDialog();
  initForms();
  initTimer();
  const year = document.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());
});
