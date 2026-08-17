/**
 * Court Ledger - Theme & Settings Module
 * Manages Dark/Light/System themes and settings popover UI.
 */

(function () {
  function initTheme() {
    const settingsBtn = document.getElementById('settings-btn');
    const settingsDropdown = document.getElementById('settings-dropdown');
    const themeOptBtns = document.querySelectorAll('.theme-opt-btn');

    if (settingsBtn && settingsDropdown) {
      settingsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isHidden = settingsDropdown.classList.toggle('hidden');
        settingsBtn.classList.toggle('active', !isHidden);
      });

      settingsDropdown.addEventListener('click', (e) => {
        e.stopPropagation();
      });

      document.addEventListener('click', () => {
        settingsDropdown.classList.add('hidden');
        settingsBtn.classList.remove('active');
      });

      function applyTheme(mode) {
        if (mode === 'system') {
          const isSystemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
          if (isSystemDark) {
            document.documentElement.removeAttribute('data-theme');
          } else {
            document.documentElement.setAttribute('data-theme', 'light');
          }
        } else if (mode === 'light') {
          document.documentElement.setAttribute('data-theme', 'light');
        } else {
          document.documentElement.removeAttribute('data-theme');
        }
      }

      function updateDropdownUI(mode) {
        themeOptBtns.forEach(btn => {
          const btnMode = btn.getAttribute('data-theme');
          btn.classList.toggle('active', btnMode === mode);
        });
      }

      themeOptBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          const mode = btn.getAttribute('data-theme');
          localStorage.setItem('theme-mode', mode);
          applyTheme(mode);
          updateDropdownUI(mode);
          settingsDropdown.classList.add('hidden');
          settingsBtn.classList.remove('active');
        });
      });

      const systemMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      systemMediaQuery.addEventListener('change', () => {
        const currentMode = localStorage.getItem('theme-mode') || 'system';
        if (currentMode === 'system') {
          applyTheme('system');
        }
      });

      const initialMode = localStorage.getItem('theme-mode') || 'system';
      updateDropdownUI(initialMode);
      applyTheme(initialMode);
    }
  }

  window.AppTheme = { initTheme };
})();
