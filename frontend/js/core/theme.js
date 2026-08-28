/**
 * OmniBox - Theme & Global Display Settings Module
 * Manages Dark/Light/System themes and popover dropdown UI.
 */

(function () {
  function initTheme() {
    const hubSettingsBtn = document.getElementById('hub-settings-btn');
    const hubSettingsDropdown = document.getElementById('hub-settings-dropdown');
    const clSettingsBtn = document.getElementById('courtledger-settings-btn');
    const clSettingsDropdown = document.getElementById('courtledger-settings-dropdown');
    const themeOptBtns = document.querySelectorAll('.theme-opt-btn');

    function bindDropdown(btn, dropdown) {
      if (!btn || !dropdown) return;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        // Close other dropdowns
        document.querySelectorAll('.settings-dropdown').forEach(dd => {
          if (dd !== dropdown) dd.classList.add('hidden');
        });
        document.querySelectorAll('.tv-btn-settings').forEach(b => {
          if (b !== btn) b.classList.remove('active');
        });

        const isHidden = dropdown.classList.toggle('hidden');
        btn.classList.toggle('active', !isHidden);
      });

      dropdown.addEventListener('click', (e) => {
        e.stopPropagation();
      });
    }

    bindDropdown(hubSettingsBtn, hubSettingsDropdown);
    bindDropdown(clSettingsBtn, clSettingsDropdown);

    document.addEventListener('click', () => {
      document.querySelectorAll('.settings-dropdown').forEach(dd => dd.classList.add('hidden'));
      document.querySelectorAll('.tv-btn-settings').forEach(b => b.classList.remove('active'));
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
        document.querySelectorAll('.settings-dropdown').forEach(dd => dd.classList.add('hidden'));
        document.querySelectorAll('.tv-btn-settings').forEach(b => b.classList.remove('active'));
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

  window.AppTheme = { initTheme };
})();
