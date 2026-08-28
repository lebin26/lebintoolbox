/**
 * OmniBox - Core Multi-App Router
 * Handles seamless view transitions between Auth Gateway, Hub, Court Ledger, and Financial Overview.
 */

(function () {
  const viewTitles = {
    auth: 'OmniBox | 账号登录',
    hub: 'OmniBox',
    courtledger: 'Court Ledger',
    historybills: 'History Bills',
    financial: 'Financial Overview'
  };

  function initRouter() {
    const backToHubBtn = document.getElementById('back-to-hub-btn');
    const headerAppTitle = document.getElementById('header-app-title');
    const courtledgerSettingsBtn = document.getElementById('courtledger-settings-btn');
    const hubSettingsBtn = document.getElementById('hub-settings-btn');

    const views = {
      auth: document.getElementById('view-auth'),
      hub: document.getElementById('view-hub'),
      courtledger: document.getElementById('view-courtledger'),
      historybills: document.getElementById('view-historybills'),
      financial: document.getElementById('view-financial')
    };

    let currentActiveViewId = 'auth';

    function switchView(targetViewId, updateHash = true) {
      // Authentication barrier: require login before accessing hub or sub-apps
      const isLoggedIn = window.Auth && typeof window.Auth.isLoggedIn === 'function' ? window.Auth.isLoggedIn() : false;
      if (!isLoggedIn) {
        targetViewId = 'auth';
      } else if (targetViewId === 'auth') {
        targetViewId = 'hub';
      }

      if (!views[targetViewId]) targetViewId = isLoggedIn ? 'hub' : 'auth';
      currentActiveViewId = targetViewId;

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
        headerAppTitle.textContent = viewTitles[targetViewId] || 'OmniBox';
      }

      // Back Button visibility
      if (backToHubBtn) {
        if (targetViewId === 'hub' || targetViewId === 'auth') {
          backToHubBtn.classList.add('hidden');
        } else {
          backToHubBtn.classList.remove('hidden');
          const btnText = backToHubBtn.querySelector('.btn-text');
          if (btnText) {
            btnText.textContent = targetViewId === 'historybills' ? 'Court Ledger' : 'OmniBox';
          }
        }
      }

      // Settings dropdown button visibility
      if (courtledgerSettingsBtn) {
        courtledgerSettingsBtn.classList.toggle('hidden', targetViewId !== 'courtledger');
      }
      if (hubSettingsBtn) {
        hubSettingsBtn.classList.toggle('hidden', targetViewId !== 'hub');
      }

      // Trigger sub-app specific hooks
      if (targetViewId === 'courtledger') {
        if (window.CourtLedgerUI && typeof window.CourtLedgerUI.calculate === 'function') {
          window.CourtLedgerUI.calculate();
        }
      } else if (targetViewId === 'historybills') {
        if (window.CourtLedgerState && typeof window.CourtLedgerState.fetchBills === 'function') {
          window.CourtLedgerState.fetchBills().then(() => {
            if (window.CourtLedgerUI && typeof window.CourtLedgerUI.renderBillsList === 'function') {
              window.CourtLedgerUI.renderBillsList();
            }
          });
        } else if (window.CourtLedgerUI && typeof window.CourtLedgerUI.renderBillsList === 'function') {
          window.CourtLedgerUI.renderBillsList();
        }
      } else if (targetViewId === 'financial') {
        if (window.FinancialUI && typeof window.FinancialUI.initFinancialUI === 'function') {
          window.FinancialUI.initFinancialUI();
        }
      }

      window.scrollTo({ top: 0, behavior: 'smooth' });

      if (updateHash) {
        if (targetViewId === 'hub' || targetViewId === 'auth') {
          if (window.location.hash) {
            history.pushState('', document.title, window.location.pathname + window.location.search);
          }
        } else {
          window.location.hash = targetViewId;
        }
      }
    }

    // Bind Shortcut Cards in Main Hub
    function bindCardClicks() {
      const cards = document.querySelectorAll('.shortcut-card[data-target-view], [data-target-view]');
      cards.forEach(card => {
        card.addEventListener('click', () => {
          const target = card.getAttribute('data-target-view');
          if (target) switchView(target);
        });
      });
    }
    bindCardClicks();

    // Bind Back to Hub Button
    if (backToHubBtn) {
      backToHubBtn.addEventListener('click', () => {
        if (currentActiveViewId === 'historybills') {
          switchView('courtledger');
        } else {
          switchView('hub');
        }
      });
    }

    function handleHashRoute() {
      const hash = window.location.hash.replace('#', '').trim().toLowerCase();
      const isLoggedIn = window.Auth && typeof window.Auth.isLoggedIn === 'function' ? window.Auth.isLoggedIn() : false;
      if (!isLoggedIn) {
        switchView('auth', false);
      } else if (hash && views[hash] && hash !== 'auth') {
        switchView(hash, false);
      } else {
        switchView('hub', false);
      }
    }

    window.addEventListener('hashchange', handleHashRoute);

    // Listen to Auth State Changes
    window.addEventListener('auth:change', (e) => {
      if (e.detail && e.detail.isLoggedIn) {
        if (currentActiveViewId === 'auth') {
          const hash = window.location.hash.replace('#', '');
          switchView(hash && views[hash] && hash !== 'auth' ? hash : 'hub');
        }
      } else {
        switchView('auth');
      }
    });

    handleHashRoute();

    window.AppRouter.switchView = switchView;
    window.AppRouter.bindCardClicks = bindCardClicks;
  }

  window.AppRouter = { initRouter, viewTitles, switchView: null };

  // Auto initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initRouter);
  } else {
    initRouter();
  }
})();
