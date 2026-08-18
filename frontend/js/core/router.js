/**
 * Court Ledger - Core Router Module
 * Handles multi-view switching and hash URL navigation.
 */

(function () {
  const viewTitles = {
    hub: 'LEBIN_26',
    courtledger: 'Court Ledger'
  };

  function initRouter() {
    const backToHubBtn = document.getElementById('back-to-hub-btn');
    const headerAppTitle = document.getElementById('header-app-title');
    const toggleViewBtn = document.getElementById('toggle-view-btn');

    const views = {
      hub: document.getElementById('view-hub'),
      courtledger: document.getElementById('view-courtledger')
    };

    function switchView(targetViewId, updateHash = true) {
      if (!views[targetViewId]) targetViewId = 'hub';

      Object.keys(views).forEach(vKey => {
        const vEl = views[vKey];
        if (!vEl) return;
        if (vKey === targetViewId) {
          vEl.classList.remove('hidden');
          requestAnimationFrame(() => {
            vEl.classList.add('active');
          });
        } else {
          vEl.classList.remove('active');
          vEl.classList.add('hidden');
        }
      });

      if (headerAppTitle) {
        headerAppTitle.textContent = viewTitles[targetViewId] || 'LEBIN_26';
      }

      if (backToHubBtn) {
        if (targetViewId === 'hub') {
          backToHubBtn.classList.add('hidden');
        } else {
          backToHubBtn.classList.remove('hidden');
        }
      }

      const hubHeaderActions = document.getElementById('hub-header-actions');
      const courtledgerHeaderActions = document.getElementById('courtledger-header-actions');

      if (hubHeaderActions) {
        hubHeaderActions.classList.toggle('hidden', targetViewId !== 'hub');
      }
      if (courtledgerHeaderActions) {
        courtledgerHeaderActions.classList.toggle('hidden', targetViewId !== 'courtledger');
      }

      window.scrollTo({ top: 0, behavior: 'smooth' });

      if (updateHash) {
        if (targetViewId === 'hub') {
          if (window.location.hash) {
            history.pushState('', document.title, window.location.pathname + window.location.search);
          }
        } else {
          window.location.hash = targetViewId;
        }
      }
    }

    if (backToHubBtn) {
      backToHubBtn.addEventListener('click', () => {
        switchView('hub');
      });
    }

    const toolCards = document.querySelectorAll('.tool-card[data-target-view], .shortcut-card[data-target-view]');
    toolCards.forEach(card => {
      card.addEventListener('click', () => {
        const targetView = card.getAttribute('data-target-view');
        if (targetView) {
          switchView(targetView);
        }
      });
    });

    function handleHashRoute() {
      const hash = window.location.hash.replace('#', '').trim().toLowerCase();
      if (hash && views[hash]) {
        switchView(hash, false);
      } else {
        switchView('hub', false);
      }
    }

    window.addEventListener('hashchange', handleHashRoute);
    handleHashRoute();

    return { switchView };
  }

  window.AppRouter = { initRouter, viewTitles };
})();
