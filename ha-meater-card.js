const DEFAULT_TITLE = 'Meater Overview';
const GAUGE_PADDING_RATIO = 0.15;
const GAUGE_MARKER_COLORS = ['var(--error-color)', 'var(--warning-color)', 'var(--info-color)', 'var(--primary-color)'];
const ZERO_SPREAD_GAUGE_RANGE = 5;
const PROBE_KEY_SUFFIXES = [
  'internal_temperature',
  'ambient_temperature',
  'target_temperature',
  'cook_phase',
  'status',
  'battery',
  'battery_level',
  'connection_status',
  'surface_temperature',
  'core_temperature',
  'temperature',
];
const DEFAULT_CARD_CONFIG = {
  title: DEFAULT_TITLE,
  show_unavailable: false,
};

class HaMeaterCard extends HTMLElement {
  constructor() {
    super();
    this._config = { ...DEFAULT_CARD_CONFIG };
  }

  static getConfigElement() {
    return document.createElement('ha-meater-card-editor');
  }

  static getStubConfig() {
    return {
      type: 'custom:ha-meater-card',
      title: DEFAULT_TITLE,
      show_unavailable: false,
    };
  }

  setConfig(config) {
    if (!config || config.type !== 'custom:ha-meater-card') {
      throw new Error('Card type must be custom:ha-meater-card');
    }

    this._config = {
      ...DEFAULT_CARD_CONFIG,
      ...config,
    };

    this._initializeDom();

    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  getCardSize() {
    const probeCount = this._getProbeCards().length || 1;
    return Math.max(1, probeCount);
  }

  _getEntities() {
    if (!this._hass || !this._hass.states) {
      return [];
    }

    const selectedEntities = Array.isArray(this._config?.entities)
      ? this._config.entities
          .map((entityId) => this._hass.states[entityId])
          .filter(Boolean)
      : Object.values(this._hass.states).filter((state) =>
          /^[^.]+\.meater([._]|$)/i.test(state.entity_id)
        );

    return selectedEntities
      .filter((state) => this._config.show_unavailable || state.state !== 'unavailable')
      .sort((left, right) => {
        const leftName = left.attributes?.friendly_name || left.entity_id;
        const rightName = right.attributes?.friendly_name || right.entity_id;
        return leftName.localeCompare(rightName);
      });
  }

  _initializeDom() {
    if (this._elements) {
      return;
    }

    if (!this.shadowRoot) {
      this.attachShadow({ mode: 'open' });
    }

    const style = document.createElement('style');
    style.textContent = `
      ha-card {
        padding: 16px;
      }

      .header {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        margin-bottom: 12px;
      }

      .title {
        font-size: 1.15rem;
        font-weight: 600;
      }

      .count {
        color: var(--secondary-text-color);
        font-size: 0.85rem;
      }

      .grid {
        display: grid;
        gap: 10px;
        grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
      }

      .probe-card {
        border-radius: 12px;
        padding: 12px;
        background: linear-gradient(160deg, rgba(var(--rgb-primary-color), 0.12), rgba(var(--rgb-primary-color), 0.02));
        border: 1px solid rgba(var(--rgb-primary-color), 0.2);
      }

      .tile {
        border-radius: 12px;
        padding: 12px;
        background: linear-gradient(160deg, rgba(var(--rgb-primary-color), 0.12), rgba(var(--rgb-primary-color), 0.02));
        border: 1px solid rgba(var(--rgb-primary-color), 0.2);
      }

      .probe-title {
        font-size: 1rem;
        font-weight: 600;
        line-height: 1.2;
      }

      .probe-status {
        margin-top: 2px;
        font-size: 0.85rem;
        color: var(--secondary-text-color);
      }

      .gauge {
        margin-top: 10px;
      }

      .gauge-track {
        position: relative;
        height: 10px;
        border-radius: 999px;
        background: rgba(var(--rgb-primary-color), 0.12);
      }

      .gauge-marker {
        position: absolute;
        top: 50%;
        width: 12px;
        height: 12px;
        border-radius: 50%;
        border: 2px solid white;
        transform: translate(-50%, -50%);
      }

      .gauge-labels {
        margin-top: 4px;
        display: flex;
        justify-content: space-between;
        font-size: 0.75rem;
        color: var(--secondary-text-color);
      }

      .temperature-list {
        margin: 8px 0 0;
        padding: 0;
        list-style: none;
      }

      .temperature-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        font-size: 0.82rem;
      }

      .temperature-name {
        font-size: 0.86rem;
        color: var(--secondary-text-color);
        line-height: 1.2;
      }

      .temperature-value {
        font-weight: 600;
      }

      .timer-list {
        margin-top: 8px;
        display: grid;
        gap: 4px;
      }

      .timer-item {
        display: flex;
        justify-content: space-between;
        gap: 8px;
        font-size: 0.82rem;
      }

      .timer-name {
        color: var(--secondary-text-color);
      }

      .timer-value {
        font-weight: 600;
        font-variant-numeric: tabular-nums;
      }

      .tile-meta {
        margin-top: 8px;
        font-size: 0.8rem;
        color: var(--secondary-text-color);
      }

      .empty {
        color: var(--secondary-text-color);
        font-size: 0.95rem;
        padding: 8px 0;
      }
    `;

    const card = document.createElement('ha-card');
    const header = document.createElement('div');
    header.className = 'header';

    const title = document.createElement('div');
    title.className = 'title';

    const count = document.createElement('div');
    count.className = 'count';

    const content = document.createElement('div');

    header.append(title, count);
    card.append(header, content);
    this.shadowRoot.append(style, card);

    this._elements = { title, count, content };
  }

  _render() {
    if (!this._config) {
      return;
    }

    this._initializeDom();

    if (!this.shadowRoot || !this._elements) {
      return;
    }

    const { title, count, content } = this._elements;
    const probes = this._getProbeCards();
    title.textContent = this._config.title;
    const probeText = probes.length === 1 ? 'probe' : 'probes';
    count.textContent = `${probes.length} ${probeText}`;

    content.replaceChildren();

    if (!probes.length) {
      const empty = document.createElement('div');
      empty.className = 'empty';
      empty.textContent = Array.isArray(this._config.entities)
        ? 'No matching configured probe entities were found.'
        : 'No Meater probe entities were found. Confirm the Meater integration is loaded.';
      content.appendChild(empty);
    } else {
      const grid = document.createElement('div');
      grid.className = 'grid';

      for (const probe of probes) {
        const probeCard = document.createElement('div');
        probeCard.className = 'probe-card';

        const probeTitle = document.createElement('div');
        probeTitle.className = 'probe-title';
        probeTitle.textContent = probe.name;

        const probeStatus = document.createElement('div');
        probeStatus.className = 'probe-status';
        probeStatus.textContent = `Status: ${probe.status}`;

        probeCard.append(probeTitle, probeStatus);

        if (probe.temperatures.length) {
          const gauge = this._buildTemperatureGauge(probe.temperatures);
          probeCard.appendChild(gauge);
        }

        if (probe.timers.length) {
          const timerList = this._buildTimerList(probe.timers);
          probeCard.appendChild(timerList);
        }

        if (probe.meta) {
          const meta = document.createElement('div');
          meta.className = 'tile-meta';
          meta.textContent = probe.meta;
          probeCard.appendChild(meta);
        }

        grid.appendChild(probeCard);
      }

      content.appendChild(grid);
    }
  }

  _getProbeCards() {
    const grouped = new Map();
    const entities = this._getEntities();

    for (const entity of entities) {
      const probeKey = this._getProbeKey(entity.entity_id);
      if (!probeKey) {
        continue;
      }

      if (!grouped.has(probeKey)) {
        grouped.set(probeKey, []);
      }

      grouped.get(probeKey).push(entity);
    }

    return [...grouped.entries()]
      .map(([probeKey, probeEntities]) => this._buildProbeCard(probeKey, probeEntities))
      .sort((left, right) => left.name.localeCompare(right.name));
  }

  _buildProbeCard(probeKey, entities) {
    const firstEntity = entities[0];
    const name = firstEntity?.attributes?.probe_name || this._formatProbeName(probeKey);
    const temperatures = [];
    const metaParts = [];
    let status = null;
    let elapsedSeconds = null;
    let remainingSeconds = null;

    for (const entity of entities) {
      const metric = this._getMetricName(entity.entity_id, probeKey);
      const attributes = entity.attributes || {};

      if (!status && metric === 'status' && entity.state && entity.state !== 'unknown') {
        status = entity.state;
      }

      if (!status && metric === 'cook_phase' && entity.state && entity.state !== 'unknown') {
        status = entity.state;
      }

      if (!status && attributes.cook_phase) {
        status = attributes.cook_phase;
      }

      const isTemperatureMetric =
        metric.includes('temperature') ||
        /°[CF]/.test(String(attributes.unit_of_measurement || ''));
      const numericState = this._isNumeric(entity.state) ? Number(entity.state) : null;
      if (isTemperatureMetric && numericState !== null) {
        const label = this._formatTemperatureLabel(metric, attributes.friendly_name || entity.entity_id);
        const unit = attributes.unit_of_measurement || '';
        temperatures.push({
          label,
          value: numericState,
          displayValue: `${numericState} ${unit}`.trim(),
        });
      }

      if (attributes.battery_level !== undefined) {
        metaParts.push(`Battery: ${attributes.battery_level}%`);
      } else if (/battery/.test(metric) && this._isNumeric(entity.state)) {
        metaParts.push(`Battery: ${entity.state}%`);
      }

      if (elapsedSeconds === null) {
        elapsedSeconds = this._extractTimerSeconds(metric, entity.state, attributes, 'elapsed');
      }

      if (remainingSeconds === null) {
        remainingSeconds = this._extractTimerSeconds(metric, entity.state, attributes, 'remaining');
      }
    }

    const timers = [];
    if (elapsedSeconds !== null) {
      timers.push({ label: 'Elapsed time', value: this._formatTimer(elapsedSeconds) });
    }
    if (remainingSeconds !== null) {
      timers.push({ label: 'Time until complete', value: this._formatTimer(remainingSeconds) });
    }

    return {
      name,
      status: status || 'Unknown',
      temperatures: this._dedupeTemperatures(temperatures),
      timers,
      meta: metaParts.filter(Boolean).join(' • '),
    };
  }

  _buildTemperatureGauge(temperatures) {
    const gauge = document.createElement('div');
    gauge.className = 'gauge';

    const track = document.createElement('div');
    track.className = 'gauge-track';

    const values = temperatures.map((temperature) => temperature.value);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const spread = Math.max(0, maxValue - minValue);
    const rangeMinBase = spread === 0 ? minValue - ZERO_SPREAD_GAUGE_RANGE : minValue - spread * GAUGE_PADDING_RATIO;
    const rangeMaxBase = spread === 0 ? maxValue + ZERO_SPREAD_GAUGE_RANGE : maxValue + spread * GAUGE_PADDING_RATIO;
    const rangeMin = spread === 0 && minValue >= 0 ? Math.max(0, rangeMinBase) : rangeMinBase;
    const rangeMax = rangeMaxBase;
    const rangeSpan = rangeMax - rangeMin;

    temperatures.forEach((temperature, index) => {
      const marker = document.createElement('div');
      marker.className = 'gauge-marker';
      marker.style.left = `${((temperature.value - rangeMin) / rangeSpan) * 100}%`;
      marker.style.background = GAUGE_MARKER_COLORS[index % GAUGE_MARKER_COLORS.length];
      marker.title = `${temperature.label}: ${temperature.displayValue}`;
      track.appendChild(marker);
    });

    const labels = document.createElement('div');
    labels.className = 'gauge-labels';
    const minLabel = document.createElement('span');
    minLabel.textContent = rangeMin.toFixed(0);
    const maxLabel = document.createElement('span');
    maxLabel.textContent = rangeMax.toFixed(0);
    labels.append(minLabel, maxLabel);

    const temperatureList = document.createElement('ul');
    temperatureList.className = 'temperature-list';

    temperatures.forEach((temperature) => {
      const row = document.createElement('li');
      row.className = 'temperature-item';
      const name = document.createElement('span');
      name.className = 'temperature-name';
      name.textContent = temperature.label;
      const value = document.createElement('span');
      value.className = 'temperature-value';
      value.textContent = temperature.displayValue;
      row.append(name, value);
      temperatureList.appendChild(row);
    });

    gauge.append(track, labels, temperatureList);
    return gauge;
  }

  _buildTimerList(timers) {
    const timerList = document.createElement('div');
    timerList.className = 'timer-list';

    timers.forEach((timer) => {
      const row = document.createElement('div');
      row.className = 'timer-item';

      const name = document.createElement('span');
      name.className = 'timer-name';
      name.textContent = timer.label;

      const value = document.createElement('span');
      value.className = 'timer-value';
      value.textContent = timer.value;

      row.append(name, value);
      timerList.appendChild(row);
    });

    return timerList;
  }

  _formatState(entity) {
    const rawState = entity.state;

    if (rawState === 'unknown' || rawState === 'unavailable') {
      return rawState;
    }

    const unit = entity.attributes?.unit_of_measurement;
    if (!unit) {
      return rawState;
    }

    return `${rawState} ${unit}`;
  }

  _formatMeta(attributes) {
    const parts = [];

    if (attributes.probe_name) {
      parts.push(`Probe: ${attributes.probe_name}`);
    }

    if (attributes.battery_level !== undefined) {
      parts.push(`Battery: ${attributes.battery_level}%`);
    }

    if (attributes.target_temperature !== undefined) {
      let targetValue = attributes.target_temperature;
      if (
        this._isNumeric(targetValue) &&
        attributes.unit_of_measurement
      ) {
        targetValue = `${targetValue} ${attributes.unit_of_measurement}`;
      }
      parts.push(`Target: ${targetValue}`);
    }

    if (attributes.cook_phase) {
      parts.push(`Phase: ${attributes.cook_phase}`);
    }

    return parts.join(' • ');
  }

  _getProbeKey(entityId) {
    const objectId = entityId.split('.')[1] || '';
    if (!objectId.startsWith('meater_probe_')) {
      return null;
    }

    for (const suffix of PROBE_KEY_SUFFIXES) {
      if (objectId.endsWith(`_${suffix}`)) {
        return objectId.slice(0, -(suffix.length + 1));
      }
    }

    return objectId;
  }

  _getMetricName(entityId, probeKey) {
    const objectId = entityId.split('.')[1] || '';
    if (!objectId.startsWith(`${probeKey}_`)) {
      return '';
    }
    return objectId.slice(probeKey.length + 1);
  }

  _formatProbeName(probeKey) {
    return probeKey
      .replace(/^meater_/i, '')
      .replaceAll('_', ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  _formatTemperatureLabel(metric, fallbackName) {
    if (!metric) {
      return fallbackName;
    }

    return metric
      .replace(/_temperature$/i, '')
      .replace(/^temperature$/i, 'current')
      .replaceAll('_', ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  _dedupeTemperatures(temperatures) {
    const unique = new Map();
    for (const temperature of temperatures) {
      unique.set(temperature.label, temperature);
    }
    return [...unique.values()];
  }

  _extractTimerSeconds(metric, state, attributes, type) {
    // Match elapsed-related metrics without treating *_remaining variants as elapsed.
    const elapsedMetricPattern =
      /(?:^|_)(?:elapsed|time_elapsed|cook_time|duration)(?:$|_)(?!remaining|left|until_complete|to_completion|time_to_completion)/;
    const remainingMetricPattern = /(remaining|time_left|until_complete|to_completion|time_to_completion)/;
    const metricPattern = type === 'elapsed' ? elapsedMetricPattern : remainingMetricPattern;
    const attributeKeys =
      type === 'elapsed'
        ? ['elapsed_time', 'time_elapsed', 'cook_elapsed_time', 'duration']
        : ['remaining_time', 'time_remaining', 'cook_time_remaining', 'time_until_complete', 'eta_seconds'];

    if (metricPattern.test(metric)) {
      const seconds = this._parseDurationSeconds(state);
      if (seconds !== null) {
        return seconds;
      }
    }

    for (const key of attributeKeys) {
      if (attributes[key] !== undefined) {
        const seconds = this._parseDurationSeconds(attributes[key]);
        if (seconds !== null) {
          return seconds;
        }
      }
    }

    return null;
  }

  _parseDurationSeconds(value) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      if (value < 0) {
        return null;
      }
      return Math.round(value);
    }

    if (typeof value !== 'string') {
      return null;
    }

    const normalized = value.trim().toLowerCase();
    if (!normalized) {
      return null;
    }

    if (/^\d+(\.\d+)?$/.test(normalized)) {
      const parsedValue = Number(normalized);
      if (parsedValue < 0) {
        return null;
      }
      return Math.round(parsedValue);
    }

    const colonParts = normalized.split(':');
    if (colonParts.length === 2 || colonParts.length === 3) {
      const parsed = colonParts.map((part) => Number(part));
      if (parsed.every((part) => Number.isFinite(part) && part >= 0)) {
        if (parsed.length === 2) {
          return parsed[0] * 60 + parsed[1];
        }
        return parsed[0] * 3600 + parsed[1] * 60 + parsed[2];
      }
    }

    const hourMatch = normalized.match(/(\d+(?:\.\d+)?)h/);
    const minuteMatch = normalized.match(/(\d+(?:\.\d+)?)m/);
    const secondMatch = normalized.match(/(\d+(?:\.\d+)?)s/);
    if (hourMatch || minuteMatch || secondMatch) {
      const hours = hourMatch ? Number(hourMatch[1]) : 0;
      const minutes = minuteMatch ? Number(minuteMatch[1]) : 0;
      const seconds = secondMatch ? Number(secondMatch[1]) : 0;
      return Math.round(hours * 3600 + minutes * 60 + seconds);
    }

    return null;
  }

  _formatTimer(durationSeconds) {
    const safeSeconds = Math.max(0, Math.round(durationSeconds));
    const hours = Math.floor(safeSeconds / 3600);
    const minutes = Math.floor((safeSeconds % 3600) / 60);
    const seconds = safeSeconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  _isNumeric(value) {
    if (typeof value === 'number') {
      return Number.isFinite(value);
    }
    if (typeof value === 'string' && value.trim() !== '') {
      return Number.isFinite(Number(value));
    }
    return false;
  }
}

if (!customElements.get('ha-meater-card')) {
  customElements.define('ha-meater-card', HaMeaterCard);
}

window.customCards = window.customCards || [];
if (!window.customCards.some((card) => card.type === 'ha-meater-card')) {
  window.customCards.push({
    type: 'ha-meater-card',
    name: 'HA Meater Card',
    description: 'A Lovelace card for visualizing Meater entities.',
  });
}

class HaMeaterCardEditor extends HTMLElement {
  constructor() {
    super();
    this._config = { ...DEFAULT_CARD_CONFIG };
  }

  setConfig(config) {
    this._config = {
      ...DEFAULT_CARD_CONFIG,
      ...(config || {}),
    };
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  _render() {
    if (!this.shadowRoot) {
      this.attachShadow({ mode: 'open' });
    }

    const entityOptions = this._hass?.states
      ? Object.keys(this._hass.states)
          .filter((entityId) => this._isMeaterEntityId(entityId))
          .sort((a, b) => a.localeCompare(b))
      : [];

    this.shadowRoot.innerHTML = `
      <style>
        .field {
          margin: 8px 0;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        label {
          font-size: 0.85rem;
          color: var(--secondary-text-color);
        }

        input,
        textarea {
          font: inherit;
          padding: 8px;
        }

        textarea {
          min-height: 110px;
          resize: vertical;
        }

        .hint {
          margin-top: 4px;
          font-size: 0.8rem;
          color: var(--secondary-text-color);
        }
      </style>
      <div class="field">
        <label for="title">Title</label>
        <input id="title" type="text" value="${this._escapeHtml(this._config.title || DEFAULT_TITLE)}" />
      </div>
      <div class="field">
        <label for="entities">Entities (one per line, optional)</label>
        <textarea id="entities" placeholder="sensor.meater_probe_1_internal_temperature">${this._escapeHtml(
          Array.isArray(this._config.entities) ? this._config.entities.join('\n') : ''
        )}</textarea>
        <div class="hint">${entityOptions.length} Meater entities discovered from Home Assistant state.</div>
      </div>
      <div class="field">
        <label for="showUnavailable">Show unavailable entities</label>
        <input id="showUnavailable" type="checkbox" ${this._config.show_unavailable ? 'checked' : ''} />
      </div>
    `;

    this.shadowRoot.getElementById('title').addEventListener('input', (event) => {
      this._updateConfig({ title: event.target.value.trim() || DEFAULT_TITLE });
    });

    this.shadowRoot.getElementById('entities').addEventListener('input', (event) => {
      const entities = event.target.value
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
      this._updateConfig({ entities: entities.length ? entities : undefined });
    });

    this.shadowRoot.getElementById('showUnavailable').addEventListener('change', (event) => {
      this._updateConfig({ show_unavailable: event.target.checked });
    });
  }

  _updateConfig(changes) {
    const nextConfig = { ...this._config, ...changes, type: 'custom:ha-meater-card' };
    if (nextConfig.entities === undefined) {
      delete nextConfig.entities;
    }

    this._config = nextConfig;
    this.dispatchEvent(
      new CustomEvent('config-changed', {
        detail: { config: nextConfig },
        bubbles: true,
        composed: true,
      })
    );
  }

  _escapeHtml(value) {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  _isMeaterEntityId(entityId) {
    return /^[^.]+\.meater([._]|$)/i.test(entityId);
  }
}

if (!customElements.get('ha-meater-card-editor')) {
  customElements.define('ha-meater-card-editor', HaMeaterCardEditor);
}
