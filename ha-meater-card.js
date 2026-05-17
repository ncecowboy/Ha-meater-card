const DEFAULT_TITLE = 'Meater Overview';

class HaMeaterCard extends HTMLElement {
  constructor() {
    super();
    this._config = {
      title: DEFAULT_TITLE,
      show_unavailable: false,
    };
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
      title: DEFAULT_TITLE,
      show_unavailable: false,
      ...config,
    };

    this._initializeDom();

    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._initializeDom();
    this._render();
  }

  getCardSize() {
    const entityCount = this._getEntities().length || 1;
    return Math.max(1, Math.ceil(entityCount / 2));
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
    if (!this.shadowRoot) {
      this.attachShadow({ mode: 'open' });
    }

    if (this._elements) {
      return;
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

      .tile {
        border-radius: 12px;
        padding: 12px;
        background: linear-gradient(160deg, rgba(var(--rgb-primary-color), 0.12), rgba(var(--rgb-primary-color), 0.02));
        border: 1px solid rgba(var(--rgb-primary-color), 0.2);
      }

      .tile-name {
        font-size: 0.86rem;
        color: var(--secondary-text-color);
        line-height: 1.2;
      }

      .tile-value {
        margin-top: 6px;
        font-size: 1.2rem;
        font-weight: 700;
        line-height: 1.2;
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
    if (!this.shadowRoot || !this._config) {
      return;
    }

    this._initializeDom();

    if (!this._elements) {
      return;
    }

    const { title, count, content } = this._elements;
    const entities = this._getEntities();
    title.textContent = this._config.title || DEFAULT_TITLE;
    const entityLabel = entities.length === 1 ? 'entity' : 'entities';
    count.textContent = `${entities.length} ${entityLabel}`;

    content.replaceChildren();

    if (!entities.length) {
      const empty = document.createElement('div');
      empty.className = 'empty';
      empty.textContent = Array.isArray(this._config.entities)
        ? 'No matching configured entities were found.'
        : 'No Meater entities were found. Confirm the Meater integration is loaded.';
      content.appendChild(empty);
    } else {
      const grid = document.createElement('div');
      grid.className = 'grid';

      for (const entity of entities) {
        const tile = document.createElement('div');
        tile.className = 'tile';

        const name = document.createElement('div');
        name.className = 'tile-name';
        name.textContent = entity.attributes?.friendly_name || entity.entity_id;

        const value = document.createElement('div');
        value.className = 'tile-value';
        value.textContent = this._formatState(entity);

        const meta = document.createElement('div');
        meta.className = 'tile-meta';
        meta.textContent = this._formatMeta(entity.attributes || {});

        tile.append(name, value);
        if (meta.textContent) {
          tile.appendChild(meta);
        }

        grid.appendChild(tile);
      }

      content.appendChild(grid);
    }
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
    this._config = {};
  }

  setConfig(config) {
    this._config = config || {};
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

    const config = this._config || {};
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
        <input id="title" type="text" value="${this._escapeHtml(config.title || DEFAULT_TITLE)}" />
      </div>
      <div class="field">
        <label for="entities">Entities (one per line, optional)</label>
        <textarea id="entities" placeholder="sensor.meater_probe_1_internal_temperature">${this._escapeHtml(
          Array.isArray(config.entities) ? config.entities.join('\n') : ''
        )}</textarea>
        <div class="hint">${entityOptions.length} Meater entities discovered from Home Assistant state.</div>
      </div>
      <div class="field">
        <label for="showUnavailable">Show unavailable entities</label>
        <input id="showUnavailable" type="checkbox" ${config.show_unavailable ? 'checked' : ''} />
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
