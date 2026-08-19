/**
 * Court Ledger - Swipe Gesture System
 * 1:1 Pointer Tracking Swipe Viewport with Physical Rubberbanding & Spring Velocity Handoff.
 */

(function () {
  function initSwipeSystem() {
    const toggleViewBtn = document.getElementById('toggle-view-btn');
    const swipeViewport = document.querySelector('.swipe-viewport');
    const swipeTrack = document.getElementById('swipe-track');
    const indicatorDots = document.querySelectorAll('.indicator-dot');

    if (!swipeViewport || !swipeTrack) return;

    let currentPage = 0;
    let isDraggingSwipe = false;
    let startDragX = 0;
    let startOffsetPct = 0;
    let viewportWidth = 0;
    let velocityHistory = [];

    function getTranslateXPercent(el) {
      const style = window.getComputedStyle(el);
      const transform = style.transform;
      if (!transform || transform === 'none') return 0;
      const matrix = new DOMMatrixReadOnly(transform);
      const tx = matrix.m41;
      const w = el.getBoundingClientRect().width;
      if (w === 0) return 0;
      return (tx / w) * 100;
    }

    function rubberband(overshoot, dimension, constant = 0.55) {
      const sign = Math.sign(overshoot);
      const absOvershoot = Math.abs(overshoot);
      return sign * ((absOvershoot * dimension * constant) / (dimension + constant * absOvershoot));
    }

    function setPage(pageIndex, velocity = 0) {
      if (window.innerWidth >= 900) return;
      currentPage = pageIndex;
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (prefersReducedMotion) {
        const slides = document.querySelectorAll('.swipe-slide');
        slides.forEach((slide, idx) => {
          slide.classList.toggle('active-slide', idx === pageIndex);
        });
        indicatorDots.forEach((dot, idx) => {
          dot.classList.toggle('active', idx === pageIndex);
        });
        return;
      }

      let duration = 400;
      viewportWidth = swipeViewport.getBoundingClientRect().width;

      if (Math.abs(velocity) > 0.1 && viewportWidth > 0) {
        const targetPct = pageIndex === 0 ? 0 : -50;
        const currentPct = getTranslateXPercent(swipeTrack);
        const distancePx = Math.abs(targetPct - currentPct) / 50 * viewportWidth;
        duration = Math.max(180, Math.min(480, distancePx / Math.abs(velocity)));
      }

      swipeTrack.style.transition = `transform ${duration}ms var(--ease-spring-approx)`;

      if (pageIndex === 0) {
        swipeTrack.style.transform = 'translate3d(0%, 0, 0)';
        if (toggleViewBtn) {
          toggleViewBtn.innerHTML = '<span class="btn-icon">📱</span><span class="btn-text">QR</span>';
          toggleViewBtn.classList.remove('active');
        }
      } else {
        swipeTrack.style.transform = 'translate3d(-50%, 0, 0)';
        if (toggleViewBtn) {
          toggleViewBtn.innerHTML = '<span class="btn-icon">📊</span><span class="btn-text">Court Ledger</span>';
          toggleViewBtn.classList.add('active');
        }
      }

      indicatorDots.forEach((dot, idx) => {
        dot.classList.toggle('active', idx === pageIndex);
      });
    }

    swipeViewport.addEventListener('pointerdown', (e) => {
      if (window.innerWidth >= 900) return;
      if (
        e.target.closest('#duration-slider') ||
        e.target.closest('.drawer-sheet') ||
        e.target.closest('.picker-trigger') ||
        e.target.closest('select') ||
        e.target.closest('input') ||
        e.target.closest('.segmented-control') ||
        e.target.closest('.host-selector-segmented') ||
        e.target.closest('.host-opt-btn') ||
        e.target.closest('.qr-image-wrapper') ||
        e.target.closest('.qr-image') ||
        e.target.closest('.stepper-wrapper') ||
        e.target.closest('.stepper-btn') ||
        e.target.closest('button') ||
        e.target.closest('.modal-card') ||
        e.target.closest('.modal-overlay') ||
        e.target.closest('.modal-bills-list') ||
        e.target.closest('.modal-venues-list') ||
        e.button !== 0
      ) {
        return;
      }

      isDraggingSwipe = true;
      swipeTrack.classList.add('dragging');
      startDragX = e.clientX;
      viewportWidth = swipeViewport.getBoundingClientRect().width;
      startOffsetPct = getTranslateXPercent(swipeTrack);
      velocityHistory = [{ x: e.clientX, time: performance.now() }];
      swipeViewport.setPointerCapture(e.pointerId);
    });

    swipeViewport.addEventListener('pointermove', (e) => {
      if (!isDraggingSwipe) return;
      const deltaX = e.clientX - startDragX;
      let deltaPct = (deltaX / viewportWidth) * 50;
      let targetPct = startOffsetPct + deltaPct;

      if (targetPct > 0) {
        const rubberPx = rubberband(deltaX, viewportWidth);
        targetPct = (rubberPx / viewportWidth) * 50;
      } else if (targetPct < -50) {
        const rubberPx = rubberband(deltaX, viewportWidth);
        targetPct = -50 + (rubberPx / viewportWidth) * 50;
      }

      swipeTrack.style.transform = `translate3d(${targetPct}%, 0, 0)`;

      velocityHistory.push({ x: e.clientX, time: performance.now() });
      if (velocityHistory.length > 5) {
        velocityHistory.shift();
      }
    });

    swipeViewport.addEventListener('pointerup', () => {
      if (!isDraggingSwipe) return;
      isDraggingSwipe = false;
      swipeTrack.classList.remove('dragging');

      let velocity = 0;
      if (velocityHistory.length >= 2) {
        const first = velocityHistory[0];
        const last = velocityHistory[velocityHistory.length - 1];
        const dt = last.time - first.time;
        if (dt > 0) {
          velocity = (last.x - first.x) / dt;
        }
      }

      const currentOffsetPct = getTranslateXPercent(swipeTrack);
      const currentOffsetPx = (currentOffsetPct / 50) * viewportWidth;
      const projectedPx = currentOffsetPx + velocity * 160;

      let targetPage = currentPage;
      if (projectedPx > -viewportWidth / 2) {
        targetPage = 0;
      } else {
        targetPage = 1;
      }

      if (Math.abs(velocity) > 0.28) {
        targetPage = velocity > 0 ? 0 : 1;
      }

      setPage(targetPage, velocity);
    });

    swipeViewport.addEventListener('pointercancel', () => {
      if (!isDraggingSwipe) return;
      isDraggingSwipe = false;
      swipeTrack.classList.remove('dragging');
      setPage(currentPage);
    });

    if (toggleViewBtn) {
      toggleViewBtn.addEventListener('click', () => {
        const nextPage = currentPage === 0 ? 1 : 0;
        setPage(nextPage);
      });
    }

    indicatorDots.forEach(dot => {
      dot.addEventListener('click', () => {
        const pageIndex = parseInt(dot.getAttribute('data-page'));
        setPage(pageIndex);
      });
    });

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      const slides = document.querySelectorAll('.swipe-slide');
      slides.forEach((slide, idx) => {
        slide.classList.toggle('active-slide', idx === currentPage);
      });
    }

    return { setPage };
  }

  window.CourtLedgerSwipe = { initSwipeSystem };
})();
