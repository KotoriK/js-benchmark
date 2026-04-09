// ---------------------------------------------------------------------------
// ECharts – tree-shaken imports
// ---------------------------------------------------------------------------
import * as echarts from 'echarts/core';
import { BarChart } from 'echarts/charts';
import {
  TooltipComponent,
  GridComponent,
  LegendComponent,
  DataZoomComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

echarts.use([
  BarChart,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  DataZoomComponent,
  CanvasRenderer,
]);

// ---------------------------------------------------------------------------
// Colour palette for series
// ---------------------------------------------------------------------------
const PALETTE = [
  '#4ecdc4', '#45b7d1', '#f7dc6f', '#bb8fce', '#ff6b6b',
  '#52be80', '#f0b27a', '#7fb3d3', '#f1948a', '#82e0aa',
];

function seriesColor(i) { return PALETTE[i % PALETTE.length]; }

// ---------------------------------------------------------------------------
// ECharts helpers
// ---------------------------------------------------------------------------
function makeChart(domId) {
  const el = document.getElementById(domId);
  return echarts.init(el, null, {
    renderer: 'canvas',
    theme: {
      backgroundColor: '#16213e',
      textStyle: { color: '#eaeaea' },
    },
  });
}

function renderSimpleChart(chart, groups, metric) {
  const xLabels = groups.map(g => g.label);
  const methodSet = new Set();
  groups.forEach(g => g.measurements.forEach(m => methodSet.add(m.name)));
  const methods = [...methodSet];

  const series = methods.map((method, idx) => ({
    name: method,
    type: 'bar',
    data: groups.map(g => {
      const m = g.measurements.find(m => m.name === method);
      return m ? +(m[metric] ?? m.duration ?? 0).toFixed(4) : null;
    }),
    itemStyle: { color: seriesColor(idx) },
  }));

  chart.setOption({
    backgroundColor: '#16213e',
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: { data: methods, textStyle: { color: '#eaeaea' }, top: 10 },
    grid: { left: '3%', right: '4%', bottom: '20%', top: '15%', containLabel: true },
    xAxis: {
      type: 'category',
      data: xLabels,
      axisLabel: { rotate: 30, color: '#eaeaea', interval: 0, fontSize: 10 },
    },
    yAxis: {
      type: 'value',
      name: 'Duration (ms)',
      axisLabel: { color: '#eaeaea' },
      nameTextStyle: { color: '#eaeaea' },
    },
    series,
    dataZoom: [{ type: 'slider', show: xLabels.length > 8, xAxisIndex: [0], start: 0, end: 100 }],
  });
}

function renderWasmChart(chart, tests, metric) {
  const testSet   = new Set(tests.map(t => t.test));
  const methodSet = new Set(tests.map(t => t.method));
  const testNames = [...testSet];
  const methods   = [...methodSet];

  const byMethod = {};
  tests.forEach(t => {
    if (!byMethod[t.method]) byMethod[t.method] = {};
    byMethod[t.method][t.test] = t[metric];
  });

  const series = methods.map((method, idx) => ({
    name: method,
    type: 'bar',
    data: testNames.map(t => byMethod[method][t] != null ? +byMethod[method][t].toFixed(4) : null),
    itemStyle: { color: seriesColor(idx) },
  }));

  chart.setOption({
    backgroundColor: '#16213e',
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: { data: methods, textStyle: { color: '#eaeaea' }, top: 10 },
    grid: { left: '3%', right: '4%', bottom: '20%', top: '15%', containLabel: true },
    xAxis: {
      type: 'category',
      data: testNames,
      axisLabel: { rotate: 30, color: '#eaeaea', interval: 0, fontSize: 10 },
    },
    yAxis: {
      type: 'value',
      name: `${metric.toUpperCase()} (ms)`,
      axisLabel: { color: '#eaeaea' },
      nameTextStyle: { color: '#eaeaea' },
    },
    series,
    dataZoom: [{ type: 'slider', show: testNames.length > 8, xAxisIndex: [0], start: 0, end: 100 }],
  });
}

// ---------------------------------------------------------------------------
// TOC helpers
// ---------------------------------------------------------------------------
let tocOpen = false;

function buildToc(benchmarkNames) {
  const tocList = document.getElementById('tocList');
  tocList.innerHTML = '';
  benchmarkNames.forEach(({ id, name }) => {
    const li = document.createElement('li');
    const a  = document.createElement('a');
    a.href      = `#${id}`;
    a.textContent = name;
    a.className = 'block text-[#eaeaea] hover:text-teal truncate py-0.5 transition-colors';
    a.addEventListener('click', () => {
      tocOpen = false;
      document.getElementById('tocPanel').classList.add('hidden');
    });
    li.appendChild(a);
    tocList.appendChild(li);
  });
}

// ---------------------------------------------------------------------------
// Category renderers
// ---------------------------------------------------------------------------
function renderSimpleCategory(categoryId, category) {
  const container = document.getElementById(`cat-${categoryId}`);
  const charts    = [];
  const tocItems  = [];

  category.benchmarks.forEach((bench, bi) => {
    const sectionId = `bench-${categoryId}-${bi}`;
    tocItems.push({ id: sectionId, name: bench.name });

    const section = document.createElement('div');
    section.id        = sectionId;
    section.className = 'bg-card p-5 rounded-xl mb-5 scroll-mt-4';

    const title = document.createElement('h3');
    title.className   = 'text-teal text-lg font-semibold mb-3';
    title.textContent = bench.name;
    if (bench.error) {
      const badge = document.createElement('span');
      badge.className = 'error-badge';
      badge.textContent = 'Error';
      badge.title = bench.error;
      title.appendChild(badge);
    }
    section.appendChild(title);

    if (!bench.groups || bench.groups.length === 0) {
      const msg = document.createElement('p');
      msg.className   = 'text-muted';
      msg.textContent = bench.error || 'No results captured.';
      section.appendChild(msg);
      container.appendChild(section);
      return;
    }

    const allMethods = [...new Set(bench.groups.flatMap(g => g.measurements.map(m => m.name)))];

    // Chart
    const chartId  = `chart-${categoryId}-${bi}`;
    const chartDiv = document.createElement('div');
    chartDiv.id        = chartId;
    chartDiv.className = 'w-full h-[420px] my-5';
    section.appendChild(chartDiv);

    // Table
    const tableWrap = document.createElement('div');
    tableWrap.className = 'max-h-[500px] overflow-y-auto rounded-lg';
    let html = '<table class="bm-table"><thead><tr><th>Test</th>' +
      allMethods.map(m => `<th>${m}</th>`).join('') + '</tr></thead><tbody>';

    bench.groups.forEach(g => {
      const bestDur = Math.min(...g.measurements.map(m => m.duration ?? Infinity));
      html += `<tr><td>${g.label}</td>`;
      allMethods.forEach(method => {
        const m = g.measurements.find(x => x.name === method);
        if (m) {
          const isBest = Math.abs((m.duration ?? 0) - bestDur) < 1e-9;
          html += `<td class="${isBest ? 'best-result' : ''}">${(m.duration ?? 0).toFixed(4)}</td>`;
        } else {
          html += '<td>–</td>';
        }
      });
      html += '</tr>';
    });
    html += '</tbody></table>';
    tableWrap.innerHTML = html;
    section.appendChild(tableWrap);

    container.appendChild(section);
    charts.push({ chartId, groups: bench.groups });
  });

  // Store TOC items on the container for later use
  container.dataset.tocItems = JSON.stringify(tocItems);

  requestAnimationFrame(() => {
    charts.forEach(({ chartId, groups }) => {
      const c = makeChart(chartId);
      renderSimpleChart(c, groups, 'duration');
      window.addEventListener('resize', () => c.resize());
    });
  });
}

function renderWasmCategory(categoryId, category) {
  const container  = document.getElementById(`cat-${categoryId}`);
  const charts     = [];
  const tocItems   = [];
  const WASM_METRICS = ['avg', 'median', 'min', 'p95'];
  let currentMetric = 'avg';

  category.benchmarks.forEach((bench, bi) => {
    const sectionId = `bench-${categoryId}-${bi}`;
    tocItems.push({ id: sectionId, name: bench.name });

    const section = document.createElement('div');
    section.id        = sectionId;
    section.className = 'bg-card p-5 rounded-xl mb-5 scroll-mt-4';

    const title = document.createElement('h3');
    title.className   = 'text-teal text-lg font-semibold mb-3';
    title.textContent = bench.name + (bench.benchmarkType ? ` — ${bench.benchmarkType}` : '');
    section.appendChild(title);

    if (!bench.tests || bench.tests.length === 0) {
      section.appendChild(
        Object.assign(document.createElement('p'), { className: 'text-muted', textContent: 'No results.' }),
      );
      container.appendChild(section);
      return;
    }

    // Metric selector
    const metricSel = document.createElement('div');
    metricSel.className = 'flex gap-2.5 flex-wrap items-center my-4';
    WASM_METRICS.forEach(m => {
      const btn = document.createElement('button');
      btn.className      = `px-4 py-2 rounded text-white text-sm cursor-pointer transition-colors border-0 ${m === 'avg' ? 'bg-highlight' : 'bg-accent hover:bg-highlight'}`;
      btn.textContent    = m.toUpperCase() + ' (ms)';
      btn.dataset.metric = m;
      metricSel.appendChild(btn);
    });
    section.appendChild(metricSel);

    // Chart
    const chartId  = `chart-${categoryId}-${bi}`;
    const chartDiv = document.createElement('div');
    chartDiv.id        = chartId;
    chartDiv.className = 'w-full h-[420px] my-5';
    section.appendChild(chartDiv);

    // Table
    const testNames = [...new Set(bench.tests.map(t => t.test))].sort();
    const methods   = [...new Set(bench.tests.map(t => t.method))].sort();

    const tableWrap = document.createElement('div');
    tableWrap.className = 'max-h-[500px] overflow-y-auto rounded-lg';
    let html = '<table class="bm-table"><thead><tr><th>Method</th>' +
      testNames.map(t => `<th>${t}</th>`).join('') + '</tr></thead><tbody>';

    methods.forEach(method => {
      const row = bench.tests.filter(t => t.method === method);
      const map = {};
      row.forEach(r => { map[r.test] = r; });
      html += `<tr><td>${method}</td>`;
      testNames.forEach(testName => {
        const t = map[testName];
        if (t) {
          const best = Math.min(...bench.tests.filter(x => x.test === testName).map(x => x.avg));
          html += `<td class="${Math.abs(t.avg - best) < 1e-9 ? 'best-result' : ''}">${t.avg.toFixed(4)}</td>`;
        } else {
          html += '<td>–</td>';
        }
      });
      html += '</tr>';
    });
    html += '</tbody></table>';
    tableWrap.innerHTML = html;
    section.appendChild(tableWrap);

    container.appendChild(section);
    charts.push({ chartId, tests: bench.tests, metricSel });
  });

  container.dataset.tocItems = JSON.stringify(tocItems);

  requestAnimationFrame(() => {
    const chartInstances = {};
    charts.forEach(({ chartId, tests, metricSel }) => {
      const c = makeChart(chartId);
      chartInstances[chartId] = { chart: c, tests };
      renderWasmChart(c, tests, currentMetric);
      window.addEventListener('resize', () => c.resize());

      metricSel.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', () => {
          metricSel.querySelectorAll('button').forEach(b => {
            b.className = b.className.replace('bg-highlight', 'bg-accent hover:bg-highlight');
          });
          btn.className = btn.className.replace('bg-accent hover:bg-highlight', 'bg-highlight');
          renderWasmChart(chartInstances[chartId].chart, chartInstances[chartId].tests, btn.dataset.metric);
        });
      });
    });
  });
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------
fetch('benchmark-data.json')
  .then(r => r.json())
  .then(data => {

    // ── Header info ──────────────────────────────────────────
    document.getElementById('timestamp').innerHTML =
      '<strong>Run at:</strong> ' + new Date(data.timestamp).toLocaleString();

    const sha = (data.commit || '').substring(0, 8);
    const commitLink = data.repoUrl
      ? `<a href="${data.repoUrl}/commit/${data.commit}" target="_blank" rel="noopener"
            class="text-teal hover:underline font-mono">${sha}</a>`
      : `<span class="font-mono">${sha}</span>`;
    document.getElementById('commit').innerHTML =
      `<strong>Commit:</strong> ` +
      (data.repoUrl
        ? `<a href="${data.repoUrl}" target="_blank" rel="noopener" class="text-sky hover:underline">${data.repoUrl.replace('https://github.com/', '')}</a> @ ${commitLink}`
        : commitLink);

    // ── System info ───────────────────────────────────────────
    if (data.systemInfo) {
      const si = data.systemInfo;
      const speedStr = si.cpuSpeed ? ` @ ${si.cpuSpeed} MHz` : '';
      document.getElementById('systemInfo').innerHTML = `
        <div class="p-2"><strong>Platform:</strong> ${si.platform} (${si.arch})</div>
        <div class="p-2"><strong>Node.js:</strong> ${si.nodeVersion}</div>
        <div class="p-2"><strong>CPU:</strong> ${si.cpuCores}× ${si.cpuModel}${speedStr}</div>
        <div class="p-2"><strong>Memory:</strong> ${si.totalMemoryGB} GB total</div>
      `;
    }

    const tabsEl    = document.getElementById('categoryTabs');
    const contentEl = document.getElementById('categoryContent');

    const categoryOrder  = ['generic', 'dom', 'wasm'];
    const categoryLabels = { generic: '⚙️ Generic JS', dom: '🌐 DOM', wasm: '🦀 WebAssembly' };

    let firstTab = true;
    categoryOrder.forEach(catId => {
      const cat = data.categories[catId];
      if (!cat) return;

      // Tab button
      const btn = document.createElement('button');
      btn.className    = `px-5 py-2.5 rounded-md text-white border-0 cursor-pointer text-base transition-colors ${firstTab ? 'bg-highlight' : 'bg-accent hover:bg-highlight'}`;
      btn.textContent  = categoryLabels[catId] || catId;
      btn.dataset.cat  = catId;
      tabsEl.appendChild(btn);

      // Content section
      const section = document.createElement('div');
      section.id        = `cat-${catId}`;
      section.className = firstTab ? '' : 'hidden';
      const heading = document.createElement('h2');
      heading.className   = 'text-[#eaeaea] mt-7 mb-3 text-xl font-semibold';
      heading.textContent = cat.title;
      section.appendChild(heading);
      if (cat.timestamp) {
        const ts = document.createElement('p');
        ts.className   = 'text-muted mb-4 text-sm';
        ts.textContent = 'Benchmarked at: ' + new Date(cat.timestamp).toLocaleString();
        section.appendChild(ts);
      }
      contentEl.appendChild(section);

      if (cat.type === 'wasm') {
        renderWasmCategory(catId, cat);
      } else {
        renderSimpleCategory(catId, cat);
      }

      firstTab = false;
    });

    // ── Tab switching ─────────────────────────────────────────
    let activeCatId = null;

    function activateTab(catId) {
      activeCatId = catId;
      tabsEl.querySelectorAll('button').forEach(b => {
        const isActive = b.dataset.cat === catId;
        b.className = b.className.replace(
          isActive ? /bg-accent hover:bg-highlight/ : /bg-highlight/,
          isActive ? 'bg-highlight' : 'bg-accent hover:bg-highlight',
        );
      });
      contentEl.querySelectorAll('[id^="cat-"]').forEach(s => {
        s.classList.toggle('hidden', s.id !== `cat-${catId}`);
      });

      // Update TOC for the newly visible category
      const activeCatEl = document.getElementById(`cat-${catId}`);
      const items = activeCatEl?.dataset?.tocItems
        ? JSON.parse(activeCatEl.dataset.tocItems)
        : [];
      buildToc(items);
    }

    tabsEl.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => activateTab(btn.dataset.cat));
    });

    // Initialise TOC for the first visible tab
    const firstCatId = categoryOrder.find(id => !!data.categories[id]);
    if (firstCatId) activateTab(firstCatId);

    // ── Floating TOC button ───────────────────────────────────
    const tocBtn   = document.getElementById('tocBtn');
    const tocPanel = document.getElementById('tocPanel');

    tocBtn.addEventListener('click', e => {
      e.stopPropagation();
      tocOpen = !tocOpen;
      tocPanel.classList.toggle('hidden', !tocOpen);
    });

    document.addEventListener('click', e => {
      if (tocOpen && !document.getElementById('tocContainer').contains(e.target)) {
        tocOpen = false;
        tocPanel.classList.add('hidden');
      }
    });
  })
  .catch(err => {
    console.error('Failed to load benchmark data:', err);
    document.getElementById('categoryContent').innerHTML =
      '<p class="text-highlight">Failed to load benchmark-data.json. Check the console for details.</p>';
  });
