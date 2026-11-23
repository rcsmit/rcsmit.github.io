// version = "20261123-120700"
// Responsive navigation (navbar guide), scrollspy (scrollspy guide),
// and the stuck-header fallback (state-aware-sticky-headers guide).

export function initNav() {
  const header = document.getElementById("site-header");
  const inner = header?.querySelector(".header-inner");
  const menu = document.getElementById("site-menu");
  if (!header || !inner || !menu) return;

  initLayoutSwitch(header, inner, menu);
  initScrollspy(menu);
  initStuckFallback();
}

/* ---------- Collapse only when the inline row does not fit ---------- */
function initLayoutSwitch(header, inner, menu) {
  let isWide = false;
  let lastWidth = 0;

  const isOpen = () => {
    try { return menu.matches(":popover-open"); } catch { return menu.classList.contains(":popover-open"); }
  };

  const update = () => {
    const width = inner.clientWidth;
    // While collapsed, only remeasure when the header has grown (avoids thrash).
    if (!isWide && lastWidth && width <= lastWidth) { lastWidth = width; return; }
    lastWidth = width;

    const wasOpen = menu.hasAttribute("popover") && isOpen();
    header.classList.add("is-measuring", "is-wide");
    const fits = inner.scrollWidth <= inner.clientWidth + 1;
    isWide = fits;
    header.classList.toggle("is-wide", fits);

    if (fits) {
      menu.removeAttribute("popover");
    } else if (!menu.hasAttribute("popover")) {
      menu.setAttribute("popover", "auto");
    }
    if (!fits && wasOpen && !isOpen()) menu.showPopover?.();

    requestAnimationFrame(() => header.classList.remove("is-measuring"));
  };

  const ro = new ResizeObserver(update);
  ro.observe(header);
  ro.observe(menu);
  update();

  // Close the collapsed menu after choosing a link.
  menu.addEventListener("click", (event) => {
    if (event.target.closest("a") && menu.hasAttribute("popover") && isOpen()) menu.hidePopover();
  });
}

/* ---------- Scrollspy ---------- */
function initScrollspy(menu) {
  const links = [...menu.querySelectorAll('a[href^="#"]')];

  if (CSS.supports("scroll-target-group: auto")) {
    const sync = () => {
      const current = menu.querySelector("a:target-current");
      links.forEach((link) => link.setAttribute("aria-current", link === current ? "true" : "false"));
    };
    sync();
    document.addEventListener("scrollend", sync);
    return;
  }

  const sections = links
    .map((link) => document.getElementById(link.hash.slice(1)))
    .filter(Boolean);
  const setActive = (id) => {
    links.forEach((link) => {
      const active = id !== null && link.hash === `#${id}`;
      link.classList.toggle("target-current", active);
      link.setAttribute("aria-current", active ? "true" : "false");
    });
  };
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) setActive(entry.target.id);
    });
  }, { rootMargin: "-50% 0px -50% 0px", threshold: 0 });
  sections.forEach((section) => observer.observe(section));

  // Above the first tracked section nothing is current.
  const first = sections[0];
  if (first) {
    new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting === false && entry.boundingClientRect.top > 0) setActive(null);
    }, { rootMargin: "-50% 0px -50% 0px" }).observe(first);
  }
}

/* ---------- Stuck header fallback (scroll-state queries unsupported) ---------- */
function initStuckFallback() {
  if (CSS.supports("container-type: scroll-state")) return;
  const shell = document.querySelector(".header-shell");
  if (!shell) return;
  const sentinel = document.createElement("div");
  sentinel.setAttribute("aria-hidden", "true");
  sentinel.style.cssText = "position:absolute;inset-block-start:0;inline-size:1px;block-size:1px;pointer-events:none;";
  document.body.prepend(sentinel);
  new IntersectionObserver(([entry]) => {
    shell.classList.toggle("is-stuck", !entry.isIntersecting);
  }).observe(sentinel);
}
