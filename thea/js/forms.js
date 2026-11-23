// version = "20261123-120700"
// Forms: native constraint validation + :user-invalid styling
// (required-field-feedback / accessible-error-announcement guides).
import { CONFIG } from "./config.js";

/* ---------- aria-invalid / aria-describedby sync with :user-invalid ---------- */
const linkError = (el, shown) => {
  const errorId = el.dataset.error;
  if (!errorId) return;
  const ids = (el.getAttribute("aria-describedby") || "").split(/\s+/).filter((id) => id && id !== errorId);
  if (shown) ids.push(errorId);
  if (ids.length) el.setAttribute("aria-describedby", ids.join(" "));
  else el.removeAttribute("aria-describedby");
};

let announcer;
let announceTimer;
let announcedField;

const spokenText = (node) => {
  const copy = node.cloneNode(true);
  copy.querySelectorAll('[aria-hidden="true"]').forEach((n) => n.remove());
  copy.querySelectorAll('[role="img"][aria-label]').forEach((n) => n.replaceWith(`${n.getAttribute("aria-label")}: `));
  return copy.textContent.replace(/\s+/g, " ").trim();
};

const announceError = (el) => {
  const error = document.getElementById(el.dataset.error);
  if (!error) return;
  const label = el.labels?.[0] ? `${spokenText(el.labels[0])}: ` : "";
  clearTimeout(announceTimer);
  announcer.textContent = "";
  announcedField = el;
  announceTimer = setTimeout(() => { announcer.textContent = label + spokenText(error); }, 500);
};

const flagged = new WeakSet();
const announced = new WeakSet();

const syncAria = (el, announce = false) => {
  if (!el.matches?.("form[data-form] :is(input, select, textarea)") || el.type === "hidden" || el.closest(".hp")) return;
  const invalid = el.matches(":user-invalid");
  if (invalid) {
    if (announce && !announced.has(el)) { announceError(el); announced.add(el); }
    el.setAttribute("aria-invalid", "true");
    linkError(el, true);
    flagged.add(el);
  } else if (flagged.has(el) || el.getAttribute("aria-invalid") !== "true") {
    el.setAttribute("aria-invalid", "false");
    linkError(el, false);
    flagged.delete(el);
    announced.delete(el);
    if (announcedField === el) { clearTimeout(announceTimer); announcer.textContent = ""; }
  }
};

/* ---------- Submission ---------- */
const formToText = (form) =>
  [...new FormData(form).entries()]
    .filter(([key]) => key !== "website")
    .map(([key, value]) => `${key}: ${value}`)
    .join("\n");

async function submitForm(form) {
  const status = form.querySelector(".form-status");
  const button = form.querySelector('button[type="submit"]');
  const kind = form.dataset.form;

  // Honeypot filled → silently treat as done.
  if (form.querySelector('.hp input')?.value) {
    status.dataset.state = "ok";
    status.textContent = "Danke!";
    return;
  }

  const endpoint = CONFIG.formEndpoints?.[kind];
  button.disabled = true;

  if (endpoint) {
    status.textContent = "Wird gesendet …";
    delete status.dataset.state;
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        body: new FormData(form),
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error(String(response.status));
      status.dataset.state = "ok";
      status.textContent = kind === "webinar"
        ? "Danke! Du bist angemeldet – schau gleich in dein Postfach."
        : "Super, du stehst auf der Warteliste!";
      form.reset();
    } catch {
      status.dataset.state = "error";
      status.textContent = `Das hat leider nicht geklappt. Bitte versuch es noch einmal oder schreib an ${CONFIG.contactEmail}.`;
      button.disabled = false;
    }
    return;
  }

  // No endpoint configured yet: hand off to the visitor's e-mail program.
  const subject = kind === "webinar" ? "Anmeldung Gratis Webinar" : `Warteliste: ${form.elements.kurs?.value || "Kurs"}`;
  const href = `mailto:${CONFIG.contactEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(formToText(form))}`;
  status.dataset.state = "ok";
  status.textContent = "Fast geschafft: Dein E-Mail-Programm öffnet sich mit der fertigen Anmeldung. Bitte nur noch absenden.";
  window.location.href = href;
  setTimeout(() => { button.disabled = false; }, 2000);
}

export function initForms() {
  const forms = document.querySelectorAll("form[data-form]");
  if (!forms.length) return;

  announcer = document.createElement("div");
  announcer.setAttribute("aria-live", "polite");
  announcer.className = "visually-hidden";
  document.body.append(announcer);

  forms.forEach((form) => {
    [...form.elements].forEach((el) => syncAria(el));

    // Show inline errors instead of the browser's validation bubble, and focus
    // the first invalid field ourselves (cancelling 'invalid' skips that step).
    let firstInvalid = null;
    form.addEventListener("invalid", (event) => {
      event.preventDefault();
      announced.add(event.target);
      syncAria(event.target);
      // 'invalid' fires once per field in DOM order; microtasks run between
      // listener calls, so reset the flag on a task, after the whole batch.
      if (!firstInvalid) {
        firstInvalid = event.target;
        firstInvalid.focus();
        setTimeout(() => { firstInvalid = null; });
      }
    }, true);

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      submitForm(form);
    });

    form.addEventListener("reset", () => {
      setTimeout(() => [...form.elements].forEach((el) => syncAria(el)));
    });
  });

  document.addEventListener("blur", (e) => syncAria(e.target, true), true);
  document.addEventListener("input", (e) => { if (e.target.hasAttribute?.("aria-invalid")) syncAria(e.target); });
  document.addEventListener("change", (e) => syncAria(e.target, true), true);
}
