document.addEventListener('DOMContentLoaded', () => {
  const theme = localStorage.getItem('theme');
  const isDark = theme === 'dark';

  const themeContainer = document.getElementById('theme-switch');

  themeContainer.innerHTML = `
    <button id="theme-toggle">${isDark ? 'go to SUNSETS' : 'go to AFTER DARK'}</button>
  `;

  const toggleBtn = document.getElementById('theme-toggle');
  const body = document.body;

  if (isDark) {
    body.classList.add('dark-mode');
  }

  toggleBtn.addEventListener('click', () => {
    body.classList.toggle('dark-mode');
    const isDarkNow = body.classList.contains('dark-mode');
    localStorage.setItem('theme', isDarkNow ? 'dark' : 'light');
    toggleBtn.textContent = isDarkNow ? 'go to SUNSETS' : 'go to AFTER DARK';
  });
});
