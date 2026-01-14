/**
 * Bags Shield API Status Dashboard
 * Handles API health checks, scan/simulate actions, and upstream status
 */

(function() {
  'use strict';

  // Sample payloads
  const SAMPLE_PAYLOADS = {
    scan: {
      rawTransaction: "AQAAAAAAAAAAAAAA",
      network: "solana-devnet"
    },
    simulate: {
      mint: "So11111111111111111111111111111111111111112"
    }
  };

  // Get base URL (defaults to current origin)
  function getBaseUrl() {
    return window.location.origin;
  }

  // Format latency
  function formatLatency(ms) {
    if (!Number.isFinite(ms)) return '—';
    if (ms < 1) return '<1 ms';
    if (ms < 1000) return `${Math.round(ms)} ms`;
    return `${(ms / 1000).toFixed(2)} s`;
  }

  // Update status indicator
  function updateStatus(card, status, text) {
    const indicator = card.querySelector('.status-indicator');
    const statusText = card.querySelector('.status-text');
    if (indicator) {
      indicator.setAttribute('data-status', status);
    }
    if (statusText) {
      statusText.textContent = text || status;
    }
  }

  // Update meta information
  function updateMeta(card, httpStatus, latency, requestId) {
    const httpEl = card.querySelector('[data-http-status]');
    const latencyEl = card.querySelector('[data-latency]');
    const reqIdEl = card.querySelector('[data-request-id]');

    if (httpEl) httpEl.textContent = httpStatus || '—';
    if (latencyEl) latencyEl.textContent = formatLatency(latency);
    if (reqIdEl) reqIdEl.textContent = requestId || '—';
  }

  // Extract highlights from response
  function extractHighlights(data, endpoint) {
    const highlights = [];

    if (!data || typeof data !== 'object') return highlights;

    // Success status
    if (data.success !== undefined) {
      highlights.push({
        label: 'Success',
        value: data.success ? 'true' : 'false',
        class: data.success ? 'success' : 'error'
      });
    }

    // Request ID
    if (data.meta?.requestId) {
      highlights.push({
        label: 'Request ID',
        value: data.meta.requestId.substring(0, 8) + '...'
      });
    }

    // Mode
    if (data.meta?.mode) {
      highlights.push({
        label: 'Mode',
        value: data.meta.mode
      });
    }

    // Scan-specific highlights
    if (endpoint === '/api/scan' && data.response) {
      if (data.response.shieldScore !== undefined) {
        highlights.push({
          label: 'ShieldScore',
          value: String(data.response.shieldScore),
          class: data.response.shieldScore >= 80 ? 'success' : data.response.shieldScore >= 60 ? 'warning' : 'error'
        });
      }
      if (data.response.riskLevel) {
        highlights.push({
          label: 'Risk Level',
          value: data.response.riskLevel
        });
      }
    }

    // Simulate-specific highlights
    if (endpoint === '/api/simulate' && data.response) {
      if (data.response.shieldScore !== undefined) {
        highlights.push({
          label: 'ShieldScore',
          value: String(data.response.shieldScore),
          class: data.response.shieldScore >= 80 ? 'success' : data.response.shieldScore >= 60 ? 'warning' : 'error'
        });
      }
      if (data.response.grade) {
        highlights.push({
          label: 'Grade',
          value: data.response.grade
        });
      }
      if (data.response.isSafe !== undefined) {
        highlights.push({
          label: 'Is Safe',
          value: data.response.isSafe ? 'Yes' : 'No',
          class: data.response.isSafe ? 'success' : 'error'
        });
      }
    }

    return highlights;
  }

  // Render highlights
  function renderHighlights(container, highlights) {
    if (!container) return;

    if (highlights.length === 0) {
      container.innerHTML = '';
      return;
    }

    container.innerHTML = highlights.map(h => `
      <div class="highlight-item">
        <span class="highlight-label">${h.label}:</span>
        <span class="highlight-value ${h.class || ''}">${h.value}</span>
      </div>
    `).join('');
  }

  // Escape HTML to prevent XSS
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Render headers
  function renderHeaders(container, headers) {
    if (!container) return;

    if (!headers || Object.keys(headers).length === 0) {
      container.innerHTML = '';
      return;
    }

    container.innerHTML = `
      <div class="headers-section">
        <div class="headers-title">Headers</div>
        <div class="headers-list">
          <div class="header-item"><span class="header-name">x-vercel-id:</span> <span class="header-value">${escapeHtml(headers['x-vercel-id'])}</span></div>
          <div class="header-item"><span class="header-name">x-vercel-cache:</span> <span class="header-value">${escapeHtml(headers['x-vercel-cache'])}</span></div>
          <div class="header-item"><span class="header-name">date:</span> <span class="header-value">${escapeHtml(headers['date'])}</span></div>
          <div class="header-item"><span class="header-name">content-type:</span> <span class="header-value">${escapeHtml(headers['content-type'])}</span></div>
        </div>
      </div>
    `;
  }

  // Update response display
  function updateResponse(card, data, endpoint, headers = null) {
    const responsePre = card.querySelector('.response-json');
    const highlightsContainer = card.querySelector('[data-highlights]');
    const headersContainer = card.querySelector('[data-headers]');

    if (responsePre) {
      try {
        responsePre.textContent = JSON.stringify(data, null, 2);
      } catch (e) {
        responsePre.textContent = String(data);
      }
    }

    if (highlightsContainer) {
      const highlights = extractHighlights(data, endpoint);
      renderHighlights(highlightsContainer, highlights);
    }

    if (headersContainer && headers) {
      renderHeaders(headersContainer, headers);
    }
  }

  // Make API request
  async function makeRequest(endpoint, method = 'GET', body = null) {
    const baseUrl = getBaseUrl();
    const url = `${baseUrl}${endpoint}`;

    const options = {
      method,
      headers: {
        'Accept': 'application/json'
      }
    };

    if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      options.headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(body);
    }

    const startTime = performance.now();
    try {
      const response = await fetch(url, options);
      const elapsed = performance.now() - startTime;
      const text = await response.text();

      let data = null;
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }

      const requestId = response.headers.get('x-request-id') || 
                      (data?.meta?.requestId) || 
                      null;

      // Capture Vercel/debug headers
      const headers = {
        'x-vercel-id': response.headers.get('x-vercel-id') || '—',
        'x-vercel-cache': response.headers.get('x-vercel-cache') || '—',
        'date': response.headers.get('date') || '—',
        'content-type': response.headers.get('content-type') || '—'
      };

      return {
        success: response.ok,
        status: response.status,
        data,
        latency: elapsed,
        requestId,
        headers
      };
    } catch (error) {
      const elapsed = performance.now() - startTime;
      return {
        success: false,
        status: 0,
        data: { error: error.message },
        latency: elapsed,
        requestId: null,
        headers: {
          'x-vercel-id': '—',
          'x-vercel-cache': '—',
          'date': '—',
          'content-type': '—'
        }
      };
    }
  }

  // Run health check
  async function runHealthCheck() {
    const card = document.getElementById('health-card');
    if (!card) return;

    updateStatus(card, 'running', 'Verificando...');
    updateMeta(card, '—', null, '—');
    updateResponse(card, null, '/api/health', null);

    const result = await makeRequest('/api/health', 'GET');

    if (result.success) {
      updateStatus(card, 'success', 'OK');
    } else {
      updateStatus(card, 'error', 'Erro');
    }

    updateMeta(card, result.status, result.latency, result.requestId);
    updateResponse(card, result.data, '/api/health', result.headers);
  }

  // Run scan
  async function runScan() {
    const card = document.getElementById('scan-card');
    if (!card) return;

    const button = card.querySelector('[data-action="scan"]');
    if (button) button.disabled = true;

    updateStatus(card, 'running', 'Executando...');
    updateMeta(card, '—', null, '—');
    updateResponse(card, null, '/api/scan', null);

    const result = await makeRequest('/api/scan', 'POST', SAMPLE_PAYLOADS.scan);

    if (result.success && result.data?.success) {
      updateStatus(card, 'success', 'OK');
    } else {
      updateStatus(card, 'error', 'Erro');
    }

    updateMeta(card, result.status, result.latency, result.requestId);
    updateResponse(card, result.data, '/api/scan', result.headers);

    if (button) button.disabled = false;
  }

  // Run simulate
  async function runSimulate() {
    const card = document.getElementById('simulate-card');
    if (!card) return;

    const button = card.querySelector('[data-action="simulate"]');
    if (button) button.disabled = true;

    updateStatus(card, 'running', 'Executando...');
    updateMeta(card, '—', null, '—');
    updateResponse(card, null, '/api/simulate', null);

    const result = await makeRequest('/api/simulate', 'POST', SAMPLE_PAYLOADS.simulate);

    if (result.success && result.data?.success) {
      updateStatus(card, 'success', 'OK');
    } else {
      updateStatus(card, 'error', 'Erro');
    }

    updateMeta(card, result.status, result.latency, result.requestId);
    updateResponse(card, result.data, '/api/simulate', result.headers);

    if (button) button.disabled = false;
  }

  // Run upstream check
  async function runUpstreamCheck() {
    const card = document.getElementById('upstream-card');
    if (!card) return;

    updateStatus(card, 'running', 'Verificando...');
    updateMeta(card, '—', null, '—');
    updateResponse(card, null, '/api/bags/ping', null);

    const result = await makeRequest('/api/bags/ping', 'GET');

    if (result.success && result.data?.success) {
      updateStatus(card, 'success', 'OK');
    } else if (result.status === 0) {
      // Network error or endpoint doesn't exist
      updateStatus(card, 'error', 'N/A');
      updateResponse(card, { message: 'Endpoint não disponível ou erro de rede' }, '/api/bags/ping', result.headers);
    } else {
      updateStatus(card, 'error', 'Erro');
    }

    updateMeta(card, result.status, result.latency, result.requestId);
    updateResponse(card, result.data, '/api/bags/ping', result.headers);
  }

  // Initialize
  function init() {
    // Set build date
    const buildDateEl = document.getElementById('build-date');
    if (buildDateEl) {
      const now = new Date();
      buildDateEl.textContent = now.toLocaleDateString('pt-BR', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      buildDateEl.setAttribute('datetime', now.toISOString());
    }

    // Attach event listeners
    const scanButton = document.querySelector('[data-action="scan"]');
    if (scanButton) {
      scanButton.addEventListener('click', runScan);
    }

    const simulateButton = document.querySelector('[data-action="simulate"]');
    if (simulateButton) {
      simulateButton.addEventListener('click', runSimulate);
    }

    // Run health check on load
    runHealthCheck();

    // Try upstream check (may fail if endpoint doesn't exist, that's OK)
    runUpstreamCheck().catch(() => {
      const card = document.getElementById('upstream-card');
      if (card) {
        updateStatus(card, 'error', 'N/A');
        updateResponse(card, { message: 'Endpoint não disponível' }, '/api/bags/ping', null);
      }
    });
  }

  // Run when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
