# Plan: Web Dashboard для L2 API (порт 3000)

> **Статус:** 🔄 Этап 1–2 в процессе → см. [Чеклист реального прогресса](#-чеклист-реального-прогресса)
> **Дата обновления:** 2026-03-17
> **Стек:** Vanilla JS · HTML · CSS (без фреймворков)
> **Цель:** Специализированный игровой Dashboard + Live API Explorer для управления L2 ботом

---

## ⚠️ Критические правки относительно исходного плана

| #   | Проблема в исходном плане                                                  | Исправление                                             |
| --- | -------------------------------------------------------------------------- | ------------------------------------------------------- |
| 1   | Этапы 1–2 помечены ✅, но все чекбоксы `[ ]`                               | Добавлен раздел «Чеклист реального прогресса»           |
| 2   | `express.static()` не описан — файлы не будут отдаваться                   | Добавлен готовый код `dashboard.ts`                     |
| 3   | WS-клиент без reconnect-логики                                             | Добавлен exponential backoff                            |
| 4   | Polling каждые 2с при живом WS — избыточно                                 | WS-события как основной транспорт, polling как fallback |
| 5   | `?token=demo` хардкодом в WS URL                                           | Токен из конфига / env                                  |
| 6   | Scalar подключается без CSP-заголовков — браузер блокирует CDN             | Добавлены `helmet` + CSP whitelist                      |
| 7   | `openapi.json` лежит в `src/dashboard/` — компилятор его туда не скопирует | Перенесён в `public/` или копируется скриптом           |
| 8   | Нет `npm` скрипта для сборки статики                                       | Добавлен `scripts/copy-dashboard.ts`                    |
| 9   | Pico.css без версии — сломается при обновлении CDN                         | Версия зафиксирована                                    |
| 10  | Нет обработки CORS для локального dev                                      | Добавлен `cors` middleware                              |

---

## 🎯 Концепция: "L2 Bot Dashboard"

**Специализированный игровой dashboard**, который:

- Показывает real-time состояние игры (HP/MP, позиция, цель)
- Визуализирует WebSocket события в live-режиме
- Документирует API (Scalar / OpenAPI)
- Позволяет тестировать эндпоинты (Try It Out)

---

## 🏗️ Архитектура

```
┌─────────────────────────────────────────────────────────────┐
│                    Web Dashboard (порт 3000)                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ API Docs    │  │ Live Status │  │ WebSocket Monitor   │  │
│  │ (Scalar)    │  │ (HP/MP/Pos) │  │ (Events Log)        │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ API Tester  │  │ Inventory   │  │ Combat Controls     │  │
│  │ (Try It)    │  │ (Visual)    │  │ (Quick Actions)     │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│              Express Server (src/api/server.ts)             │
│  GET  /                ──▶  Dashboard SPA (static)          │
│  GET  /api-docs        ──▶  Scalar UI (static page)         │
│  GET  /openapi.json    ──▶  OpenAPI spec (static file)      │
│  ANY  /api/v1/*        ──▶  REST endpoints                  │
│  GET  /ws              ──▶  WebSocket upgrade               │
└─────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Технологический стек

| Компонент     | Технология                   | Версия (CDN)               | Обоснование                   |
| ------------- | ---------------------------- | -------------------------- | ----------------------------- |
| **UI**        | Vanilla JS + Custom Elements | —                          | Нет зависимостей от React/Vue |
| **CSS**       | Pico.css                     | **2.0.6** (зафиксировать!) | Семантический, нет классов    |
| **API Docs**  | Scalar                       | **latest** (CDN)           | Современная замена Swagger UI |
| **Icons**     | Lucide                       | **0.383.0**                | Легкие SVG иконки             |
| **Charts**    | Chart.js                     | **4.4.3**                  | Графики HP/MP/XP              |
| **Real-time** | Native WebSocket             | —                          | Прямое подключение к `/ws`    |
| **Security**  | helmet + cors                | npm                        | CSP, CORS для dev-режима      |

> **Правило:** все CDN-ресурсы указывать с точной версией (`@2.0.6`, `@4.4.3`).
> Без версии — риск поломки при выходе major-апдейта.

---

## 📁 Структура файлов (исправлено)

```
l2ts-interlude-client-l2jmobius/
├── src/
│   ├── api/
│   │   ├── server.ts              # Express сервер (добавить static + helmet)
│   │   └── routes/
│   │       └── dashboard.ts       # ← НОВЫЙ: роуты для UI (health, openapi)
│   └── config.ts                  # Уже существует — добавить DASHBOARD_TOKEN
│
├── public/                        # ← НОВЫЙ: статика (не src/dashboard/!)
│   ├── index.html                 # SPA точка входа
│   ├── api-docs.html              # Scalar UI
│   ├── openapi.json               # OpenAPI спецификация (сюда, не в src/)
│   ├── css/
│   │   └── dashboard.css
│   └── js/
│       ├── app.js                 # Инициализация + роутинг вкладок
│       ├── api-client.js          # REST клиент
│       ├── ws-client.js           # WebSocket клиент (с reconnect)
│       ├── components/
│       │   ├── status-panel.js    # HP/MP/XP + позиция
│       │   ├── event-log.js       # WS лог событий
│       │   ├── combat-controls.js # Быстрые действия
│       │   └── inventory-grid.js  # Инвентарь
│       └── utils/
│           └── formatters.js      # hp%, время, числа L2
│
└── scripts/
    └── copy-dashboard.ts          # ← НОВЫЙ: копирует public/ → dist/public/
```

> **Почему `public/` а не `src/dashboard/`?**
> TypeScript компилирует только `.ts` файлы из `src/`. Статика (`.html`, `.js`, `.css`)
> в `src/` не копируется в `dist/` автоматически — нужен отдельный скрипт или `tsc-alias`.
> Папка `public/` — стандартная конвенция для Express-проектов.

---

## ⚙️ Обязательные изменения в существующем коде

### 1. `src/api/server.ts` — добавить static serving + middleware

```typescript
import express from "express";
import helmet from "helmet";
import cors from "cors";
import path from "path";

const app = express();

// --- SECURITY ---
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "cdn.jsdelivr.net", // Pico.css, Scalar
          "unpkg.com", // Chart.js, Lucide
          "'unsafe-inline'", // Scalar требует inline scripts
        ],
        styleSrc: ["'self'", "cdn.jsdelivr.net", "'unsafe-inline'"],
        connectSrc: ["'self'", "ws://localhost:3000"], // WebSocket
        imgSrc: ["'self'", "data:"],
      },
    },
  }),
);

// --- CORS (только для dev) ---
if (process.env.NODE_ENV !== "production") {
  app.use(cors({ origin: "http://localhost:3000" }));
}

// --- STATIC ---
const publicPath = path.join(__dirname, "../../public"); // dist/../public
app.use(express.static(publicPath));

// --- API ---
app.use(express.json());
app.use("/api/v1", apiRouter);

// --- SPA FALLBACK (для вкладок без hash-роутинга) ---
app.get("/api-docs", (req, res) => {
  res.sendFile(path.join(publicPath, "api-docs.html"));
});

// Всё остальное → index.html
app.get("*", (req, res) => {
  if (!req.path.startsWith("/api")) {
    res.sendFile(path.join(publicPath, "index.html"));
  }
});
```

### 2. `src/config.ts` — добавить токен дашборда

```typescript
export const config = {
  // ... существующие поля ...
  dashboard: {
    port: 3000,
    token: process.env.DASHBOARD_TOKEN ?? "dev-token-change-me",
    wsPath: "/ws",
  },
};
```

### 3. `scripts/copy-dashboard.ts` — копирование статики в `dist/`

```typescript
import { cpSync } from "fs";
import { join } from "path";

const src = join(process.cwd(), "public");
const dest = join(process.cwd(), "dist", "public");

cpSync(src, dest, { recursive: true });
console.log("✅ Dashboard static files copied to dist/public/");
```

Добавить в `package.json`:

```json
{
  "scripts": {
    "build": "tsc && npx ts-node scripts/copy-dashboard.ts",
    "dev": "tsx watch src/index.ts",
    "dev:dashboard": "tsx watch src/index.ts & npx live-server public --port=3001"
  }
}
```

---

## 📡 Интеграция API

### REST API клиент — `public/js/api-client.js`

```javascript
class L2ApiClient {
  #baseUrl;
  #token;

  constructor(baseUrl = "/api/v1", token = "dev-token-change-me") {
    this.#baseUrl = baseUrl;
    this.#token = token;
  }

  async #request(method, path, body) {
    const res = await fetch(`${this.#baseUrl}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.#token}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      throw new Error(`API Error ${res.status}: ${await res.text()}`);
    }
    return res.json();
  }

  getStatus() {
    return this.#request("GET", "/status");
  }
  getCharacter() {
    return this.#request("GET", "/character");
  }
  getInventory() {
    return this.#request("GET", "/inventory");
  }
  moveTo(x, y, z) {
    return this.#request("POST", "/move/to", { x, y, z });
  }
  attack(objectId) {
    return this.#request("POST", "/attack", { objectId });
  }
  useSkill(skillId) {
    return this.#request("POST", "/skill/use", { skillId });
  }
  sendChat(msg, type) {
    return this.#request("POST", "/chat", { message: msg, type });
  }
}

export const api = new L2ApiClient();
```

> ✅ Используются приватные поля `#` (ES2022) — поддерживается в Node 18+
> ✅ Единая точка обработки ошибок в `#request`
> ✅ `Authorization` header вместо query-параметра `?token=`

---

### WebSocket клиент — `public/js/ws-client.js`

```javascript
class L2WsClient extends EventTarget {
  #ws = null;
  #reconnectDelay = 1000; // начальная задержка 1с
  #maxDelay = 30_000; // максимум 30с
  #shouldConnect = true;

  connect(url = `ws://${location.host}/ws`) {
    this.#ws = new WebSocket(url);

    this.#ws.addEventListener("open", () => {
      console.log("[WS] Connected");
      this.#reconnectDelay = 1000; // сброс задержки
      this.dispatchEvent(new CustomEvent("connected"));
      this.subscribe(["character", "combat", "world", "system"]);
    });

    this.#ws.addEventListener("message", (e) => {
      try {
        const event = JSON.parse(e.data);
        // Пробрасываем как CustomEvent с типом из пакета
        this.dispatchEvent(new CustomEvent(event.type, { detail: event.data }));
        this.dispatchEvent(new CustomEvent("any", { detail: event }));
      } catch (err) {
        console.warn("[WS] Bad message:", e.data);
      }
    });

    this.#ws.addEventListener("close", () => {
      if (this.#shouldConnect) {
        console.warn(
          `[WS] Disconnected. Reconnecting in ${this.#reconnectDelay}ms...`,
        );
        this.dispatchEvent(new CustomEvent("disconnected"));
        setTimeout(() => this.connect(url), this.#reconnectDelay);
        // Exponential backoff
        this.#reconnectDelay = Math.min(
          this.#reconnectDelay * 2,
          this.#maxDelay,
        );
      }
    });

    this.#ws.addEventListener("error", (e) => {
      console.error("[WS] Error:", e);
    });
  }

  subscribe(channels) {
    this.#send({ type: "subscribe", channels });
  }

  #send(data) {
    if (this.#ws?.readyState === WebSocket.OPEN) {
      this.#ws.send(JSON.stringify(data));
    }
  }

  disconnect() {
    this.#shouldConnect = false;
    this.#ws?.close();
  }
}

export const ws = new L2WsClient();
```

> ✅ Extends `EventTarget` — нативный браузерный паттерн, не нужен EventEmitter
> ✅ Exponential backoff reconnect (1→2→4→8...→30 сек)
> ✅ `#shouldConnect` флаг для graceful disconnect

---

### Инициализация — `public/js/app.js`

```javascript
import { api } from "./api-client.js";
import { ws } from "./ws-client.js";
import { StatusPanel } from "./components/status-panel.js";
import { EventLog } from "./components/event-log.js";

// Регистрируем Web Components
customElements.define("l2-status-panel", StatusPanel);
customElements.define("l2-event-log", EventLog);

// Подключаем WebSocket
ws.connect();

// WS события → обновляем UI (основной транспорт данных)
ws.addEventListener("character", (e) => {
  document.querySelector("l2-status-panel")?.update(e.detail);
});

ws.addEventListener("any", (e) => {
  document.querySelector("l2-event-log")?.append(e.detail);
});

// REST polling — ТОЛЬКО как fallback при отсутствии WS-событий
let lastWsEvent = 0;
ws.addEventListener("connected", () => {
  lastWsEvent = Date.now();
});
ws.addEventListener("any", () => {
  lastWsEvent = Date.now();
});

setInterval(async () => {
  const silentFor = Date.now() - lastWsEvent;
  if (silentFor > 10_000) {
    // WS молчит 10 секунд — fallback к REST
    try {
      const char = await api.getCharacter();
      document.querySelector("l2-status-panel")?.update(char);
    } catch (err) {
      console.warn("[Polling] REST fallback error:", err);
    }
  }
}, 5_000);
```

> ✅ WS как основной транспорт, REST polling только как fallback
> ✅ Web Components через `customElements.define` — нативный браузерный API
> ✅ Polling с умным условием (не долбит сервер без нужды)

---

## 🎨 Экраны интерфейса

### Главная (Dashboard)

```
┌──────────────────────────────────────────────────────────────┐
│ 🎮 L2 Bot Dashboard              [🟢 IN_GAME] [WS: ●] [⚙]  │
├──────────────────────────────────────────────────────────────┤
│ ┌──────────────┐  ┌────────────────────────────────────────┐ │
│ │ Character    │  │         WebSocket Event Log            │ │
│ │ Name: Test   │  │  [system] 12:01 Connected to game      │ │
│ │ Lv: 40 Warr. │  │  [char]   12:01 HP: 1200/1500 (-100)  │ │
│ │              │  │  [combat] 12:01 Attacking Werewolf     │ │
│ │ HP ████░░ 80%│  │  [world]  12:01 NPC spawned: Shop      │ │
│ │ MP █████░ 90%│  │                          [▼ autoscroll]│ │
│ │ XP ██░░░░ 30%│  │  Filter: [all][system][char][combat]   │ │
│ │              │  └────────────────────────────────────────┘ │
│ │ X: 82928     │  ┌────────────────────────────────────────┐ │
│ │ Y: 53600     │  │  🎯 Target: Werewolf Lv.38             │ │
│ │ Z: -1490     │  │  HP: 800/1200  [██████░░░░]  67%       │ │
│ └──────────────┘  │  [Attack] [Skill] [Reset Target]       │ │
│ ┌──────────────┐  └────────────────────────────────────────┘ │
│ │ Quick Actions│                                             │
│ │ [⚔ Attack]   │                                             │
│ │ [✨ Skill]   │                                             │
│ │ [🎒 Pickup]  │                                             │
│ │ [💺 Sit]     │                                             │
│ └──────────────┘                                             │
└──────────────────────────────────────────────────────────────┘
```

---

## 📋 Чеклист реального прогресса

### ✅ Этап 1: Базовый каркас

- [x] Создать структуру `public/`
- [x] Настроить `express.static('public')` в `server.ts`
- [x] `index.html` с базовой разметкой и вкладками
- [x] Pico.css **2.0.6** подключён
- [ ] `helmet` и `cors` установлены и настроены (`npm i helmet cors`)
- [ ] SPA fallback route в `server.ts`

### ✅ Этап 2: OpenAPI + Scalar

- [x] `openapi.json` создан из `L2TS_API_DOCUMENTATION.md`
- [x] `api-docs.html` со Scalar UI
- [ ] Scalar версия зафиксирована в CDN URL
- [ ] CSP-заголовки разрешают `cdn.jsdelivr.net` (иначе Scalar не загрузится!)
- [ ] Проверить отображение всех эндпоинтов в браузере

### ✅ Этап 3: Live Status Panel (выполнено)

- [x] Web Component `<l2-status-panel>` в `status-panel.js`
- [x] HP/MP/XP отображаются через `<progress>` или CSS bar
- [x] Позиция X/Y/Z обновляется из WS-событий
- [x] Цель (target) с HP-баром
- [x] Real-time обновление через WebSocket события `character.stats_changed`
- [x] Визуальные эффекты при изменении статов (flash для heal/damage)
- [x] Эффект level-up при повышении уровня
- [x] Состояние смерти персонажа (grayscale + reduced opacity)

### ⏳ Этап 4: WebSocket Monitor

- [ ] Web Component `<l2-event-log>` в `event-log.js`
- [ ] `ws-client.js` с reconnect + exponential backoff
- [ ] Цветовая дифференциация по каналам (CSS классы)
- [ ] Автоскролл + кнопка пауза
- [ ] Фильтры по каналам

### ✅ Этап 5: Quick Actions & API Tester (выполнено)

- [x] Быстрые кнопки действий (Attack, Pickup, Sit/Stand, Chat)
- [x] Кнопки управления подключением (Connect/Disconnect)
- [x] Автоматическое включение/отключение кнопок по состоянию игры
- [x] Toggle-режим для Attack и Sit (визуальная индикация активности)
- [x] Loading состояние на кнопках при выполнении запросов
- [x] Улучшенные модальные окна для Chat и Skill выбора
- [x] Обработка цели (Target) с кнопками Attack/Skill
- [x] Цветовая индикация пинга (good/medium/bad)

### ⏳ Этап 6: Инвентарь и улучшения

- [ ] CSS Grid сетка предметов
- [ ] Фильтры по типам предметов
- [ ] Информация о снаряжении
- [ ] Chart.js графики дамага / HP/MP за бой

---

## 🚀 Порядок запуска (пошагово)

```bash
# 1. Установить новые зависимости
npm install helmet cors
npm install -D @types/cors

# 2. Проверить что public/ раздаётся:
curl http://localhost:3000/
# Должен вернуть HTML

# 3. Проверить OpenAPI:
curl http://localhost:3000/openapi.json
# Должен вернуть JSON со spec

# 4. Проверить WebSocket:
# В консоли браузера:
# const ws = new WebSocket('ws://localhost:3000/ws');
# ws.onmessage = (e) => console.log(e.data);

# 5. Открыть дашборд:
open http://localhost:3000

# 6. Открыть API docs:
open http://localhost:3000/api-docs
```

---

## ✅ Что было сделано

### Character Panel (оживлён)
- ✅ WebSocket подписка на `character.stats_changed` для обновления HP/MP/CP в реальном времени
- ✅ WebSocket подписка на `movement.position_changed` для обновления координат
- ✅ Обработка событий `character.level_up`, `character.died`, `character.revived`
- ✅ Визуальные эффекты:
  - `stat-flash-heal` - зелёная вспышка при восстановлении
  - `stat-flash-damage` - красная вспышка при получении урона
  - `level-up-effect` - анимация при повышении уровня
  - `character-dead` - grayscale фильтр при смерти
  - `highlight` - подсветка изменившихся значений

### Quick Actions (оживлены)
- ✅ Кнопки управления подключением с loading состоянием
- ✅ Toggle-режим для Attack (Start/Stop с иконкой)
- ✅ Toggle-режим для Sit/Stand с визуальной индикацией
- ✅ Pickup с поиском ближайших предметов
- ✅ Chat с улучшенным модальным окном (выбор канала + ввод сообщения)
- ✅ Target Attack и Target Skill
- ✅ Автоматическое отключение кнопок при отсутствии подключения

### Server-side улучшения
- ✅ Обновлён `UserInfoPacket` - теперь декодирует HP/MP/CP/XP/Stats
- ✅ `UserInfoPacket` теперь отправляет события `character.stats_changed` и `movement.position_changed`
- ✅ Полная интеграция с `GameStateStore` и `EventBus`

## 🐛 Типичные проблемы и решения

| Проблема                        | Причина                               | Решение                                         |
| ------------------------------- | ------------------------------------- | ----------------------------------------------- |
| Scalar не загружается           | CSP блокирует CDN                     | Добавить `cdn.jsdelivr.net` в `helmet` CSP      |
| `Cannot GET /`                  | `express.static` не подключён         | Добавить `app.use(express.static('public'))`    |
| WS `ERR_CONNECTION_REFUSED`     | Путь `/ws` неверный или WS не запущен | Проверить `server.ts` — WS upgrade на `/ws`     |
| JS модули не грузятся           | `<script>` без `type="module"`        | Добавить `type="module"` в `index.html`         |
| Статика не обновляется          | В `dev` режиме кешируется             | Добавить `Cache-Control: no-store` в dev-режиме |
| `public/` не попадает в `dist/` | TS не копирует не-TS файлы            | Запустить `scripts/copy-dashboard.ts`           |

---

## 🎨 Дизайн: тёмная тема (рекомендуется)

```css
/* public/css/dashboard.css */
:root {
  --pico-color-scheme: dark;
  --l2-hp: #e74c3c;
  --l2-mp: #3498db;
  --l2-xp: #f39c12;
  --l2-bg: #1a1a2e;
  --l2-card: #16213e;
  --l2-border: #0f3460;
  --l2-text: #e0e0e0;
  --l2-accent: #e94560;

  /* Цвета каналов событий */
  --ch-system: #95a5a6;
  --ch-character: #2ecc71;
  --ch-combat: #e74c3c;
  --ch-world: #3498db;
}

[data-channel="system"] {
  color: var(--ch-system);
}
[data-channel="character"] {
  color: var(--ch-character);
}
[data-channel="combat"] {
  color: var(--ch-combat);
}
[data-channel="world"] {
  color: var(--ch-world);
}
```

---

## 📚 Связанные документы

- [`L2TS_API_DOCUMENTATION.md`](./L2TS_API_DOCUMENTATION.md) — Спецификация API (источник для `openapi.json`)
- [`CLAUDE.md`](./CLAUDE.md) — Архитектура проекта
- [`DOCUMENTATION.md`](./DOCUMENTATION.md) — Общая документация
- [`src/api/server.ts`](./src/api/server.ts) — Express сервер (изменить!)
- [`src/config.ts`](./src/config.ts) — Конфиг (добавить `dashboard.token`)
