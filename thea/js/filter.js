// version = "20261123-120700"
// Filtering itself is pure CSS (:has). This only announces the result count.

export function initFilter() {
  const status = document.getElementById("course-count");
  const radios = document.querySelectorAll('input[name="kursfilter"]');
  const courses = [...document.querySelectorAll(".course[data-category]")];
  if (!status || !radios.length) return;

  radios.forEach((radio) =>
    radio.addEventListener("change", () => {
      const value = radio.value;
      const count = value === "alle" ? courses.length : courses.filter((c) => c.dataset.category === value).length;
      status.textContent = `${count} ${count === 1 ? "Kurs" : "Kurse"} angezeigt`;
    })
  );
}
