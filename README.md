# HA Meater Card

A custom Lovelace card for Home Assistant that automatically discovers and displays entities from the Meater integration (probes and block sensors) in a clean visual grid.

## Installation

### HACS (recommended)

1. In HACS, add this repository as a **Custom repository** with type **Dashboard**.
2. Install **HA Meater Card** from HACS.
3. Add the resource in **Settings → Dashboards → Resources** if it is not added automatically:

```yaml
url: /hacsfiles/ha-meater-card/ha-meater-card.js
type: module
```

### Manual

1. Copy `ha-meater-card.js` to your Home Assistant `/config/www/` folder.
2. Add the resource in **Settings → Dashboards → Resources**:

```yaml
url: /local/ha-meater-card.js
type: module
```

## Usage

### Auto-discover Meater entities

```yaml
type: custom:ha-meater-card
title: Meater Overview
```

Auto-discovery includes all `sensor.meater_*` entities, so multiple probes (for example `probe_1`, `probe_2`, etc.) are shown automatically.

### Show specific entities

```yaml
type: custom:ha-meater-card
title: Grill Session
entities:
  - sensor.meater_probe_1_internal_temperature
  - sensor.meater_probe_1_ambient_temperature
  - sensor.meater_probe_1_target_temperature
  - sensor.meater_block_battery
show_unavailable: false
```

### Lovelace visual editor

This card now supports the Lovelace visual editor. You can set:

- title
- show unavailable entities
- explicit entity list (one entity per line)

## Notes

- The card searches for entities with `meater` in the entity ID when `entities` is not provided.
- Entity tiles show friendly name, current value, and useful metadata when available (probe name, battery, target temperature, and cook phase).
