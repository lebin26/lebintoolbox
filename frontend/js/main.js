/**
 * Court Ledger - Main Entry Point
 * Bootstraps router, theme, drawer, domain state, calculator UI, swipe gesture, bill copier, QR overlay, and smart roster.
 */

// Global Toast Utility
let toastTimer = null;
window.showToast = function (message, duration = 2200) {
  if (!message) return;
  let toast = document.getElementById('global-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'global-toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.innerHTML = `<span class="toast-msg">${message}</span>`;
  toast.classList.add('show');

  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove('show');
  }, duration);
};

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Initialize Core Router
  if (window.AppRouter) {
    window.AppRouter.initRouter();
  }

  // 2. Initialize Drawer Modal
  if (window.AppDrawer) {
    window.AppDrawer.initDrawer();
  }

  // 3. Initialize Theme & Settings
  if (window.AppTheme) {
    window.AppTheme.initTheme();
  }

  // 4. Initialize UI Event Controls & Calculation Engine
  let uiController = null;
  if (window.CourtLedgerUI) {
    uiController = window.CourtLedgerUI.initCourtLedgerUI();
  }

  // 5. Initialize Venue Database State
  if (window.CourtLedgerState) {
    window.CourtLedgerState.initVenueState(() => {
      if (window.CourtLedgerUI && typeof window.CourtLedgerUI.calculate === 'function') {
        window.CourtLedgerUI.calculate();
      } else if (uiController && typeof uiController.calculate === 'function') {
        uiController.calculate();
      }
    });
  }

  // 6. Initialize Settings Menu Dropdown & Quick Actions
  bindSettingsMenu();

  // 7. Initialize Financial Overview (Sub-App #2) Modals
  if (window.FinancialUI) {
    window.FinancialUI.bindModals();
  }

  console.log('📦 OmniBox initialized successfully! (Sub-Apps: Court Ledger, Financial Overview)');
});

function bindSettingsMenu() {
  const settingsBtn = document.getElementById('courtledger-settings-btn') || document.getElementById('settings-btn');
  const settingsDropdown = document.getElementById('courtledger-settings-dropdown') || document.getElementById('settings-dropdown');

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
  }

  // Menu items: Manage Venues
  const menuManageVenues = document.getElementById('menu-manage-venues');
  if (menuManageVenues) {
    menuManageVenues.addEventListener('click', () => {
      if (settingsDropdown) settingsDropdown.classList.add('hidden');
      if (settingsBtn) settingsBtn.classList.remove('active');
      const manageModal = document.getElementById('court-manage-modal');
      if (manageModal) {
        manageModal.classList.remove('hidden');
        document.body.classList.add('modal-open');
        if (window.CourtLedgerUI && typeof window.CourtLedgerUI.renderModalVenuesList === 'function') {
          window.CourtLedgerUI.renderModalVenuesList();
        }
      }
    });
  }

  // Menu items: History Bills
  const menuHistoryBills = document.getElementById('menu-history-bills');
  if (menuHistoryBills) {
    menuHistoryBills.addEventListener('click', () => {
      if (settingsDropdown) settingsDropdown.classList.add('hidden');
      if (settingsBtn) settingsBtn.classList.remove('active');
      if (window.AppRouter) {
        window.AppRouter.switchView('historybills');
      }
    });
  }
}
