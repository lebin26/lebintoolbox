/**
 * Court Ledger - Master Application Entry Point
 * Bootstraps authentication, router, theme, drawer, domain state, calculator UI, swipe gesture, admin dashboard, bill copier, and QR overlay.
 */

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Initialize Auth Manager & Session Validation
  if (window.AuthManager) {
    await window.AuthManager.initAuth();
    bindAuthPageControls();
  }

  // 2. Initialize Core Router
  if (window.AppRouter) {
    window.AppRouter.initRouter();
  }

  // 3. Initialize Drawer Modal
  if (window.AppDrawer) {
    window.AppDrawer.initDrawer();
  }

  // 4. Initialize CourtLedger UI Recalculator reference
  let uiController = null;

  // 5. Initialize Theme & Settings
  if (window.AppTheme) {
    window.AppTheme.initTheme();
  }

  // 6. Initialize Venue Database State
  if (window.CourtLedgerState) {
    window.CourtLedgerState.initVenueState(() => {
      if (uiController && typeof uiController.calculate === 'function') {
        uiController.calculate();
      }
    });
  }

  // 7. Initialize UI Event Controls & Calculation Engine
  if (window.CourtLedgerUI) {
    uiController = window.CourtLedgerUI.initCourtLedgerUI();
    if (uiController && uiController.renderBillsList) {
      window.CourtLedgerUI.renderBillsList = uiController.renderBillsList;
    }
  }

  // 8. Initialize Admin Module
  if (window.AdminModule) {
    window.AdminModule.initAdminUI();
  }

  // 9. Initialize Swipe Viewport Gesture
  if (window.CourtLedgerSwipe) {
    window.CourtLedgerSwipe.initSwipeSystem();
  }

  // 10. Initialize Bill Copy System
  if (window.CourtLedgerBill) {
    window.CourtLedgerBill.initBillSystem();
  }

  // 11. Initialize QR Overlay
  if (window.CourtLedgerQR) {
    window.CourtLedgerQR.initQRSystem();
  }

  console.log('HostCalculator application initialized successfully!');
});

function bindAuthPageControls() {
  const tabBtnLogin = document.getElementById('tab-btn-login');
  const tabBtnRegister = document.getElementById('tab-btn-register');
  const loginForm = document.getElementById('auth-login-form');
  const registerForm = document.getElementById('auth-register-form');

  if (tabBtnLogin && tabBtnRegister) {
    tabBtnLogin.addEventListener('click', () => {
      tabBtnLogin.classList.add('active');
      tabBtnRegister.classList.remove('active');
      if (loginForm) loginForm.classList.remove('hidden');
      if (registerForm) registerForm.classList.add('hidden');
    });

    tabBtnRegister.addEventListener('click', () => {
      tabBtnRegister.classList.add('active');
      tabBtnLogin.classList.remove('active');
      if (registerForm) registerForm.classList.remove('hidden');
      if (loginForm) loginForm.classList.add('hidden');
    });
  }

  // Login Submit Handler
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('login-email')?.value.trim();
      const password = document.getElementById('login-password')?.value;
      const submitBtn = document.getElementById('btn-submit-login');

      if (!email || !password) {
        window.showToast('请输入账号和密码');
        return;
      }

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = '登录验证中...';
      }

      try {
        const user = await window.AuthManager.login(email, password);
        window.showToast(`🎉 欢迎回来，${user.name || user.email}！`);
        if (window.AppRouter) window.AppRouter.switchView('hub');
      } catch (err) {
        window.showToast(`登录失败: ${err.message}`);
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = '🔑 立即登录';
        }
      }
    });
  }

  // Register Submit Handler
  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('reg-name')?.value.trim();
      const email = document.getElementById('reg-email')?.value.trim();
      const password = document.getElementById('reg-password')?.value;
      const submitBtn = document.getElementById('btn-submit-register');

      if (!email || !password || !name) {
        window.showToast('请完整填写注册信息');
        return;
      }

      if (/\s/.test(name)) {
        window.showToast('用户名不能包含空格，请使用字母、数字或下划线');
        return;
      }

      if (name.length < 3 || name.length > 20) {
        window.showToast('用户名长度需在 3 到 20 个字符之间');
        return;
      }

      if (/^[_\-.]|[_\-.]$/.test(name)) {
        window.showToast('用户名不能以下划线、中划线或点号开头或结尾');
        return;
      }

      if (/[_\-.]{2,}/.test(name)) {
        window.showToast('用户名不能包含连续的符号 (例如 __ 或 --)');
        return;
      }

      const validRegex = /^[\u4e00-\u9fa5a-zA-Z0-9_-]+$/;
      if (!validRegex.test(name)) {
        window.showToast('用户名仅支持字母、数字、下划线(_)、连字符(-)及中文字符');
        return;
      }

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = '账号创建中...';
      }

      try {
        const user = await window.AuthManager.register(email, password, name);
        window.showToast(`✨ 账号注册成功！欢迎您，${user.name}！`);
        if (window.AppRouter) window.AppRouter.switchView('hub');
      } catch (err) {
        window.showToast(`注册失败: ${err.message}`);
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = '✨ 注册新账号';
        }
      }
    });
  }

  // Settings Menu - Court Ledger Admin Users Management
  const menuCourtledgerAdminUsers = document.getElementById('menu-courtledger-admin-users');
  if (menuCourtledgerAdminUsers) {
    menuCourtledgerAdminUsers.addEventListener('click', () => {
      const clSettingsDropdown = document.getElementById('courtledger-settings-dropdown');
      if (clSettingsDropdown) clSettingsDropdown.classList.add('hidden');
      if (window.AppRouter) window.AppRouter.switchView('admin');
    });
  }

  // Settings Menu - Logout Buttons (inside Hub and Court Ledger settings)
  document.querySelectorAll('.btn-logout').forEach(btn => {
    btn.addEventListener('click', () => {
      const settingsDropdown = document.getElementById('settings-dropdown');
      const clSettingsDropdown = document.getElementById('courtledger-settings-dropdown');
      if (settingsDropdown) settingsDropdown.classList.add('hidden');
      if (clSettingsDropdown) clSettingsDropdown.classList.add('hidden');

      window.AuthManager.logout();
      window.showToast('已退出登录');
    });
  });
}
