/**
 * Court Ledger - Master Application Entry Point
 * Bootstraps router, theme, drawer, domain state, calculator UI, swipe gesture, bill copier, and QR overlay.
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Initialize Core Router
  if (window.AppRouter) {
    window.AppRouter.initRouter();
  }

  // 2. Initialize Drawer Modal
  if (window.AppDrawer) {
    window.AppDrawer.initDrawer();
  }

  // 3. Initialize CourtLedger UI Recalculator reference
  let uiController = null;

  // 4. Initialize Theme & Settings
  if (window.AppTheme) {
    window.AppTheme.initTheme();
  }

  // 5. Initialize Venue Database State
  if (window.CourtLedgerState) {
    window.CourtLedgerState.initVenueState(() => {
      if (uiController && typeof uiController.calculate === 'function') {
        uiController.calculate();
      }
    });
  }

  // 6. Initialize UI Event Controls & Calculation Engine
  if (window.CourtLedgerUI) {
    uiController = window.CourtLedgerUI.initCourtLedgerUI();
  }

  // 7. Initialize Swipe Viewport Gesture
  if (window.CourtLedgerSwipe) {
    window.CourtLedgerSwipe.initSwipeSystem();
  }

  // 8. Initialize Bill Copy System
  if (window.CourtLedgerBill) {
    window.CourtLedgerBill.initBillSystem();
  }

  // 9. Initialize QR Overlay
  if (window.CourtLedgerQR) {
    window.CourtLedgerQR.initQRSystem();
  }

  console.log('Court Ledger application initialized successfully!');
});
