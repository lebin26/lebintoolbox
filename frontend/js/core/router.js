/**
 * OmniBox - Core Router Module
 * Handles multi-view switching and hash URL navigation.
 */

(function () {
  const viewTitles = {
    login: 'Account Login',
    hub: 'OmniBox',
    courtledger: 'Court Ledger',
    historybills: 'History Bills',
    advancemanager: 'Advance Manager',
    admin: 'Admin Dashboard'
  };

  function initRouter() {
    const backToHubBtn = document.getElementById('back-to-hub-btn');
    const headerAppTitle = document.getElementById('header-app-title');
    const toggleViewBtn = document.getElementById('toggle-view-btn');

    const views = {
      login: document.getElementById('view-login'),
      hub: document.getElementById('view-hub'),
      courtledger: document.getElementById('view-courtledger'),
      historybills: document.getElementById('view-historybills'),
      advancemanager: document.getElementById('view-advancemanager'),
      admin: document.getElementById('view-admin')
    };

    let currentActiveViewId = 'hub';
    let previousViewId = 'hub';

    function switchView(targetViewId, updateHash = true) {
      // 1. Auth Navigation Guard
      const isLoggedIn = window.AuthManager && window.AuthManager.isLoggedIn;

      if (!isLoggedIn && targetViewId !== 'login') {
        targetViewId = 'login';
      } else if (isLoggedIn && targetViewId === 'login') {
        targetViewId = 'hub';
      }

      // 2. Sub-App Access Permission Guard
      if (isLoggedIn && window.AuthManager && typeof window.AuthManager.hasAppAccess === 'function') {
        if ((targetViewId === 'courtledger' || targetViewId === 'historybills') && !window.AuthManager.hasAppAccess('courtledger')) {
          if (typeof window.showToast === 'function') {
            window.showToast('⛔ 访问权限不足：您当前暂无【Court Ledger】的访问授权，请联系 Admin 开通！');
          }
          targetViewId = 'hub';
        } else if (targetViewId === 'advancemanager' && !window.AuthManager.hasAppAccess('advancemanager')) {
          if (typeof window.showToast === 'function') {
            window.showToast('⛔ 访问权限不足：您当前暂无【Advance Manager】的访问授权，请联系 Admin 开通！');
          }
          targetViewId = 'hub';
        } else if (targetViewId === 'admin' && !window.AuthManager.hasAppAccess('admin')) {
          if (typeof window.showToast === 'function') {
            window.showToast('⛔ 访问权限不足：您当前暂无【Admin Console】的访问授权，请联系 Admin 开通！');
          }
          targetViewId = 'hub';
        }
      }

      if (!views[targetViewId]) targetViewId = isLoggedIn ? 'hub' : 'login';
      if (currentActiveViewId !== targetViewId) {
        previousViewId = currentActiveViewId;
      }
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

      if (backToHubBtn) {
        if (targetViewId === 'hub' || targetViewId === 'login') {
          backToHubBtn.classList.add('hidden');
        } else {
          backToHubBtn.classList.remove('hidden');
          const btnText = backToHubBtn.querySelector('.btn-text');
          if (btnText) {
            if (targetViewId === 'historybills') {
              btnText.textContent = 'Court Ledger';
            } else if (targetViewId === 'admin') {
              btnText.textContent = previousViewId === 'courtledger' ? 'Court Ledger' : 'OmniBox';
            } else {
              btnText.textContent = 'OmniBox';
            }
          }
        }
      }

      const hubHeaderActions = document.getElementById('hub-header-actions');
      const courtledgerHeaderActions = document.getElementById('courtledger-header-actions');
      const advancemanagerHeaderActions = document.getElementById('advancemanager-header-actions');
      const adminMenuToggleBtn = document.getElementById('admin-menu-toggle-btn');
      const amMenuToggleBtn = document.getElementById('am-menu-toggle-btn');

      if (hubHeaderActions) {
        hubHeaderActions.classList.toggle('hidden', targetViewId !== 'hub');
      }
      if (courtledgerHeaderActions) {
        courtledgerHeaderActions.classList.toggle('hidden', targetViewId !== 'courtledger');
      }
      if (advancemanagerHeaderActions) {
        advancemanagerHeaderActions.classList.toggle('hidden', targetViewId !== 'advancemanager');
      }
      if (adminMenuToggleBtn) {
        adminMenuToggleBtn.classList.toggle('hidden', targetViewId !== 'admin');
      }
      if (amMenuToggleBtn) {
        amMenuToggleBtn.classList.toggle('hidden', targetViewId !== 'advancemanager');
      }

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
      } else if (targetViewId === 'admin') {
        if (window.AdminModule && typeof window.AdminModule.loadActiveTabData === 'function') {
          window.AdminModule.loadActiveTabData();
        }
      } else if (targetViewId === 'advancemanager') {
        if (window.AdvanceManagerUI && typeof window.AdvanceManagerUI.loadInitialData === 'function') {
          window.AdvanceManagerUI.loadInitialData();
        }
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
        if (currentActiveViewId === 'historybills') {
          switchView('courtledger');
        } else if (currentActiveViewId === 'admin') {
          switchView(previousViewId === 'courtledger' ? 'courtledger' : 'hub');
        } else {
          switchView('hub');
        }
      });
    }

    const toolCards = document.querySelectorAll('.tool-card[data-target-view], .shortcut-card[data-target-view]');
    toolCards.forEach(card => {
      card.addEventListener('click', () => {
        const targetView = card.getAttribute('data-target-view');
        if (targetView) {
          if (card.classList.contains('is-locked') || (window.AuthManager && !window.AuthManager.hasAppAccess(targetView))) {
            const appTitles = {
              courtledger: 'Court Ledger',
              advancemanager: 'Advance Manager',
              admin: 'Admin Console'
            };
            const appName = appTitles[targetView] || targetView;
            if (typeof window.showToast === 'function') {
              window.showToast(`⛔ 访问权限不足：您当前暂无【${appName}】的访问授权，请联系 Admin 开通！`);
            }
            return;
          }
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

    window.AppRouter.switchView = switchView;
    return { switchView };
  }

  window.AppRouter = { initRouter, viewTitles, switchView: null };
})();
