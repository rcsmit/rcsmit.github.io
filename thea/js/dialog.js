// version = "20261123-120700"
// Waitlist dialog: invoker commands (declarative-dialog-popover-control),
// light dismiss with closedby + fallback (light-dismiss-a-dialog),
// exit animation fallback (animate-to-from-top-layer).

let displayTransitionSupport;
function canTransitionDisplay() {
  if (displayTransitionSupport !== undefined) return displayTransitionSupport;
  if (!window.CSS?.supports?.("transition-behavior", "allow-discrete") || !document.body) return false;
  const probe = document.createElement("div");
  probe.style.cssText = "transition: display 1s allow-discrete !important; display: block;";
  document.body.appendChild(probe);
  getComputedStyle(probe).display;
  probe.style.display = "none";
  displayTransitionSupport = getComputedStyle(probe).display === "block";
  probe.remove();
  return displayTransitionSupport;
}
const supportsTopLayerExit = () => window.CSS?.supports?.("overlay", "auto") && canTransitionDisplay();

async function closeTopLayer(dialog) {
  if (!dialog.open) return;
  if (!supportsTopLayerExit()) {
    dialog.setAttribute("data-closing", "");
    const animations = dialog.getAnimations({ subtree: true });
    if (animations.length > 0) {
      await Promise.race([
        Promise.allSettled(animations.map((a) => a.finished)),
        new Promise((resolve) => setTimeout(resolve, 600)),
      ]);
    }
    if (!dialog.hasAttribute("data-closing")) return;
    dialog.removeAttribute("data-closing");
  }
  dialog.close();
}

export function initDialog() {
  const dialog = document.getElementById("waitlist");
  if (!dialog) return;
  const title = document.getElementById("waitlist-title");
  const meta = document.getElementById("waitlist-meta");
  const price = document.getElementById("waitlist-price");
  const courseField = document.getElementById("waitlist-course");
  const form = document.getElementById("waitlist-form");

  const populate = (source) => {
    const data = source?.dataset ?? {};
    title.textContent = data.course || "Kurs";
    meta.textContent = data.meta || "";
    price.textContent = data.price || "";
    courseField.value = data.course || "";
    form.reset();
    const status = form.querySelector(".form-status");
    if (status) { status.textContent = ""; delete status.dataset.state; }
    form.querySelector('button[type="submit"]').disabled = false;
  };

  const goToCheckout = (source) => {
    const url = source?.dataset.checkout;
    if (url) { window.location.assign(url); return true; }
    return false;
  };

  const supportsCommands = Object.hasOwn(HTMLButtonElement.prototype, "commandForElement");

  if (supportsCommands) {
    // Command events fire on the target and do not bubble.
    dialog.addEventListener("command", (event) => {
      if (event.command === "show-modal") {
        if (goToCheckout(event.source)) { event.preventDefault(); return; }
        populate(event.source);
      } else if (event.command === "close" && !supportsTopLayerExit()) {
        event.preventDefault();
        closeTopLayer(dialog);
      }
    });
  } else {
    document.querySelectorAll('[commandfor="waitlist"]').forEach((button) => {
      button.addEventListener("click", () => {
        if (button.getAttribute("command") === "show-modal") {
          if (goToCheckout(button)) return;
          populate(button);
          dialog.showModal();
        } else {
          closeTopLayer(dialog);
        }
      });
    });
  }

  // Route Esc through the animated close where exit transitions need the fallback.
  dialog.addEventListener("cancel", (event) => {
    if (supportsTopLayerExit()) return;
    event.preventDefault();
    closeTopLayer(dialog);
  });

  // Light-dismiss fallback where closedby is unsupported (Safari).
  if (!("closedBy" in HTMLDialogElement.prototype)) {
    dialog.addEventListener("click", (event) => {
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      const inside = rect.top <= event.clientY && event.clientY <= rect.bottom &&
        rect.left <= event.clientX && event.clientX <= rect.right;
      if (!inside) closeTopLayer(dialog);
    });
  }
}
