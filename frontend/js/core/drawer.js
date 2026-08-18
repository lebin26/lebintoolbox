/**
 * Court Ledger - Drawer Module
 * Manages the mobile bottom-sheet selection modal with staggered entry animations.
 */

(function () {
  let activeHiddenInput = null;
  let activeDisplayEl = null;
  let onSelectionCallback = null;

  function openDrawer(title, min, max, currentVal, hiddenInput, displayEl, onSelect) {
    const drawerOverlay = document.getElementById('drawer-overlay');
    const drawerTitle = document.getElementById('drawer-title');
    const drawerBody = document.getElementById('drawer-body');

    if (!drawerOverlay || !drawerTitle || !drawerBody) return;

    activeHiddenInput = hiddenInput;
    activeDisplayEl = displayEl;
    onSelectionCallback = onSelect;

    drawerTitle.textContent = title;
    drawerBody.innerHTML = '';

    const container = document.createElement('div');
    container.className = 'drawer-options-grid';

    for (let i = min; i <= max; i++) {
      const cell = document.createElement('div');
      cell.className = 'drawer-option-cell';
      cell.textContent = i;
      cell.setAttribute('data-value', i);
      
      const delayIndex = Math.min(i - min, 12);
      cell.style.setProperty('--stagger-index', delayIndex);
      
      if (i === currentVal) {
        cell.classList.add('selected');
      }
      container.appendChild(cell);
    }

    container.addEventListener('click', (e) => {
      const cell = e.target.closest('.drawer-option-cell');
      if (cell) {
        const val = parseInt(cell.getAttribute('data-value'));
        if (!isNaN(val)) {
          if (activeHiddenInput) activeHiddenInput.value = val;
          if (activeDisplayEl) activeDisplayEl.textContent = val;
          if (typeof onSelectionCallback === 'function') {
            onSelectionCallback(val);
          }
          closeDrawer();
        }
      }
    });

    drawerBody.appendChild(container);
    drawerOverlay.classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const cells = container.querySelectorAll('.drawer-option-cell');
        cells.forEach(cell => cell.classList.add('animate-in'));
      });
    });
  }

  function closeDrawer() {
    const drawerOverlay = document.getElementById('drawer-overlay');
    if (drawerOverlay) {
      drawerOverlay.classList.add('hidden');
    }
    document.body.style.overflow = '';
  }

  function initDrawer() {
    const drawerOverlay = document.getElementById('drawer-overlay');
    const drawerCloseBtn = document.getElementById('drawer-close');

    if (drawerCloseBtn) {
      drawerCloseBtn.addEventListener('click', closeDrawer);
    }
    if (drawerOverlay) {
      drawerOverlay.addEventListener('click', (e) => {
        if (e.target === drawerOverlay) {
          closeDrawer();
        }
      });
    }
  }

  window.AppDrawer = { openDrawer, closeDrawer, initDrawer };
})();
