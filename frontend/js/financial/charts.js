/**
 * Financial Overview - Vanilla Canvas & SVG Chart Engine
 * Renders smooth Bezier asset curves, Donut allocation rings, and distribution bars.
 */

(function () {
  const FinancialCharts = {
    /**
     * Render Smooth Bezier Asset Trend Curve on HTML5 Canvas with Theme Awareness
     */
    renderAssetCurve(canvas, trendData, baseCurrency = 'MYR') {
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      const width = rect.width || 400;
      const height = rect.height || 220;

      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);

      ctx.clearRect(0, 0, width, height);

      const isLight = document.documentElement.getAttribute('data-theme') === 'light';
      const textColorMuted = isLight ? '#6b7280' : '#94a3b8';
      const gridColor = isLight ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.06)';
      const pointBg = isLight ? '#ffffff' : '#09090b';

      if (!trendData || trendData.length === 0) {
        ctx.fillStyle = textColorMuted;
        ctx.font = '13px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('暂无历史月度数据，录入快照后自动生成趋势曲线', width / 2, height / 2);
        return;
      }

      const paddingLeft = 60;
      const paddingRight = 24;
      const paddingTop = 24;
      const paddingBottom = 34;

      const chartW = width - paddingLeft - paddingRight;
      const chartH = height - paddingTop - paddingBottom;

      const values = trendData.map(d => Number(d.total) || 0);
      let minVal = Math.min(...values);
      let maxVal = Math.max(...values);

      if (minVal === maxVal) {
        minVal = Math.max(0, minVal * 0.8);
        maxVal = maxVal * 1.2 || 1000;
      }
      // Add comfortable margin
      const valRange = maxVal - minVal;
      minVal = Math.max(0, minVal - valRange * 0.1);
      maxVal = maxVal + valRange * 0.1;

      // Draw horizontal grid lines
      const gridLines = 4;
      ctx.strokeStyle = gridColor;
      ctx.lineWidth = 1;
      ctx.fillStyle = textColorMuted;
      ctx.font = '10px monospace';
      ctx.textAlign = 'right';

      for (let i = 0; i <= gridLines; i++) {
        const y = paddingTop + (chartH / gridLines) * i;
        const v = maxVal - ((maxVal - minVal) / gridLines) * i;

        ctx.beginPath();
        ctx.moveTo(paddingLeft, y);
        ctx.lineTo(width - paddingRight, y);
        ctx.stroke();

        let label = v >= 1000000 ? (v / 1000000).toFixed(1) + 'M' : v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v.toFixed(0);
        ctx.fillText(label, paddingLeft - 8, y + 3);
      }

      // Calculate Coordinates
      const points = trendData.map((d, i) => {
        const x = trendData.length === 1 ? (paddingLeft + chartW / 2) : paddingLeft + (chartW / (trendData.length - 1)) * i;
        const normalized = (d.total - minVal) / (maxVal - minVal || 1);
        const y = paddingTop + chartH - normalized * chartH;
        return { x, y, data: d };
      });

      // Draw Gradient Fill Area
      ctx.beginPath();
      ctx.moveTo(points[0].x, paddingTop + chartH);
      ctx.lineTo(points[0].x, points[0].y);

      for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[i];
        const p1 = points[i + 1];
        const cpX1 = p0.x + (p1.x - p0.x) / 2;
        const cpY1 = p0.y;
        const cpX2 = p0.x + (p1.x - p0.x) / 2;
        const cpY2 = p1.y;
        ctx.bezierCurveTo(cpX1, cpY1, cpX2, cpY2, p1.x, p1.y);
      }

      ctx.lineTo(points[points.length - 1].x, paddingTop + chartH);
      ctx.closePath();

      const gradient = ctx.createLinearGradient(0, paddingTop, 0, paddingTop + chartH);
      gradient.addColorStop(0, 'rgba(16, 185, 129, 0.32)');
      gradient.addColorStop(1, 'rgba(16, 185, 129, 0.0)');
      ctx.fillStyle = gradient;
      ctx.fill();

      // Draw Smooth Stroke Line
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);

      for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[i];
        const p1 = points[i + 1];
        const cpX1 = p0.x + (p1.x - p0.x) / 2;
        const cpY1 = p0.y;
        const cpX2 = p0.x + (p1.x - p0.x) / 2;
        const cpY2 = p1.y;
        ctx.bezierCurveTo(cpX1, cpY1, cpX2, cpY2, p1.x, p1.y);
      }

      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Draw Points and X Labels
      ctx.textAlign = 'center';
      ctx.font = '10px system-ui, sans-serif';

      points.forEach((p, idx) => {
        // Point Circle
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4.5, 0, Math.PI * 2);
        ctx.fillStyle = pointBg;
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#10b981';
        ctx.stroke();

        // X Label (Month)
        ctx.fillStyle = textColorMuted;
        const mLabel = p.data.monthKey ? p.data.monthKey.slice(2) : `M${idx + 1}`;
        ctx.fillText(mLabel, p.x, height - 10);
      });

      // Store points for hover tooltip interaction
      canvas._chartPoints = points;
      canvas._chartDpr = dpr;
      canvas._chartRect = rect;

      // Bind mouse hover tooltip only once
      if (!canvas._tooltipBound) {
        canvas._tooltipBound = true;
        canvas.style.cursor = 'crosshair';

        canvas.addEventListener('mousemove', (e) => {
          const pts = canvas._chartPoints;
          if (!pts || pts.length === 0) return;

          const r = canvas.getBoundingClientRect();
          const mx = e.clientX - r.left;
          const my = e.clientY - r.top;

          // Find closest point within 20px radius
          let closestPt = null;
          let minDist = 20;
          for (const pt of pts) {
            const dist = Math.sqrt((mx - pt.x) ** 2 + (my - pt.y) ** 2);
            if (dist < minDist) {
              minDist = dist;
              closestPt = pt;
            }
          }

          // Show/hide native title tooltip
          if (closestPt) {
            const sym = baseCurrency === 'MYR' ? 'RM' : baseCurrency;
            const val = Number(closestPt.data.total).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            canvas.title = `${closestPt.data.monthKey}: ${sym} ${val}`;
          } else {
            canvas.title = '';
          }
        });

        canvas.addEventListener('mouseleave', () => {
          canvas.title = '';
        });
      }
    }
  };

  window.FinancialCharts = FinancialCharts;
})();
