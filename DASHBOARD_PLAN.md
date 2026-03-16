# План: Web Dashboard для L2 API (порт 3000)

> **Статус:** ✅ Этап 1 и 2 завершены (Базовый каркас + OpenAPI/Scalar)
> **Дата обновления:** 2026-03-17  
> **Дата создания:** 2026-03-17  
> **Цель:** Создать веб-интерфейс типа Swagger + Live Dashboard для управления L2 ботом

---

## 🎯 Концепция: "L2 Bot Dashboard"

Вместо сухого Swagger — создадим **специализированный игровой dashboard**, который:
- Документирует API (как Swagger)
- Позволяет тестировать эндпоинты (Try It)
- Показывает real-time состояние игры (HP/MP, позиция, цель)
- Визуализирует WebSocket события в live-режиме

---

## 🏗️ Архитектура

```
┌─────────────────────────────────────────────────────────────┐
│                    Web Dashboard (порт 3000)                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ API Docs    │  │ Live Status │  │ WebSocket Monitor   │  │
│  │ (OpenAPI)   │  │ (HP/MP/Pos) │  │ (Events Log)        │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ API Tester  │  │ Inventory   │  │ Combat Controls     │  │
│  │ (Try It)    │  │ (Visual)    │  │ (Quick Actions)     │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│              Express Server (уже существует)                 │
│         /api/v1/*  ───  REST endpoints                       │
│         /ws        ───  WebSocket                            │
│         /          ───  Dashboard UI (новое)                 │
└─────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Технологический стек

| Компонент | Технология | Обоснование |
|-----------|-----------|-------------|
| **UI Framework** | Vanilla JS + Web Components | Легковесно, нет зависимостей от React/Vue |
| **CSS Framework** | Pico.css или Water.css | Чистый вид без кастомных стилей |
| **API Docs** | Scalar (OpenAPI) | Современная замена Swagger UI, встраивается |
| **Icons** | Lucide (CDN) | Легкие SVG иконки |
| **Charts** | Chart.js (CDN) | Для графиков HP/MP/XP |
| **Real-time** | Native WebSocket | Прямое подключение к `/ws` |

---

## 📁 Структура файлов

```
src/
├── api/
│   ├── server.ts              # Express сервер (обновить)
│   └── routes/
│       └── dashboard.ts       # Роуты для UI
├── dashboard/                 # 🆕 Web Dashboard
│   ├── index.html             # Главная страница
│   ├── css/
│   │   └── dashboard.css      # Стили
│   ├── js/
│   │   ├── app.js             # Инициализация
│   │   ├── api-client.js      # Клиент для REST API
│   │   ├── ws-client.js       # WebSocket клиент
│   │   ├── components/
│   │   │   ├── status-panel.js    # Панель статуса
│   │   │   ├── api-tester.js      # Тестировщик API
│   │   │   ├── inventory-grid.js  # Сетка инвентаря
│   │   │   ├── combat-controls.js # Боевые кнопки
│   │   │   └── event-log.js       # Лог событий
│   │   └── utils/
│   │       └── formatters.js  # Форматирование данных
│   └── openapi.json           # OpenAPI спецификация
```

---

## 🎨 Экраны интерфейса

### 1. Главная (Dashboard)

```
┌──────────────────────────────────────────────────────────────┐
│ 🎮 L2 Bot Dashboard              [Status: 🟢 IN_GAME] [Ping] │
├──────────────────────────────────────────────────────────────┤
│ ┌──────────────┐  ┌────────────────────────────────────────┐ │
│ │ Character    │  │         WebSocket Event Log            │ │
│ │ ┌──────────┐ │  │  [system] Connected to game world      │ │
│ │ │  Avatar  │ │  │  [character] HP: 1200/1500 (-100)      │ │
│ │ └──────────┘ │  │  [combat] Attacking Werewolf           │ │
│ │ Name: Test   │  │  [world] NPC spawned: Shopkeeper       │ │
│ │ Lv: 40 Warrior│  │                                        │ │
│ │              │  │                                        │ │
│ │ HP [████░░]  │  │                                        │ │
│ │ MP [█████░]  │  │                                        │ │
│ │ XP [██░░░░]  │  │                                        │ │
│ │              │  │                                        │ │
│ │ Position:    │  │                                        │ │
│ │ X: 82928     │  │                                        │ │
│ │ Y: 53600     │  │                                        │ │
│ │ Z: -1490     │  │                                        │ │
│ └──────────────┘  └────────────────────────────────────────┘ │
│ ┌──────────────┐  ┌────────────────────────────────────────┐ │
│ │ Quick Actions│  │         Target Info                    │ │
│ │ [Attack]     │  │  🎯 Werewolf Lv.38                     │ │
│ │ [Use Skill]  │  │  HP: 800/1200 [████░░░░░░]             │ │
│ │ [Pickup]     │  │  Distance: 145m                        │ │
│ │ [Sit/Stand]  │  │  [Set Target] [Attack] [Use Skill]     │ │
│ └──────────────┘  └────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

### 2. API Explorer (вкладка)
- Scalar UI для документации
- "Try It" кнопки для каждого эндпоинта
- Автозаполнение из текущего состояния (objectId и т.д.)

### 3. Inventory (вкладка)
- Визуальная сетка предметов
- Фильтры по типам
- Информация об экипировке

### 4. Combat Log (вкладка)
- История боёв
- Дамаг/хилл статистика
- Графики

---

## 📡 Интеграция API

### REST API клиент (в браузере)

```javascript
// api-client.js
class L2ApiClient {
  constructor(baseUrl = '/api/v1') {
    this.baseUrl = baseUrl;
  }
  
  async getStatus() {
    return fetch(`${this.baseUrl}/status`).then(r => r.json());
  }
  
  async moveTo(x, y, z) {
    return fetch(`${this.baseUrl}/move/to`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({x, y, z})
    });
  }
  // ... остальные методы
}
```

### WebSocket клиент

```javascript
// ws-client.js
class L2WsClient {
  connect() {
    this.ws = new WebSocket('ws://localhost:3000/ws?token=demo');
    this.ws.onmessage = (e) => {
      const event = JSON.parse(e.data);
      this.emit(event.type, event.data);
    };
  }
  
  subscribe(channels) {
    this.send({type: 'subscribe', channels});
  }
}
```

---

## 📋 План реализации (по этапам)

### Этап 1: Базовый каркас (2-3 часа)
- [ ] Создать `src/dashboard/` структуру
- [ ] Настроить Express на раздачу статики с `/`
- [ ] Создать `index.html` с базовой разметкой
- [ ] Подключить Pico.css

### Этап 2: OpenAPI + Scalar (2 часа)
- [ ] Создать `openapi.json` из L2TS_API_DOCUMENTATION.md
- [ ] Встроить Scalar UI на вкладку `/api-docs`
- [ ] Проверить отображение всех эндпоинтов

### Этап 3: Live Status Panel (2-3 часа)
- [ ] Компонент `status-panel.js`
- [ ] Polling `/api/v1/character` каждые 2 сек
- [ ] Отображение HP/MP/XP прогресс-барами
- [ ] Отображение позиции и цели

### Этап 4: WebSocket Monitor (2 часа)
- [ ] Компонент `event-log.js`
- [ ] Подключение к WebSocket
- [ ] Красивый лог событий с цветовой дифференциацией каналов
- [ ] Автоскролл, фильтры по каналам

### Этап 5: API Tester (2-3 часа)
- [ ] Формы для основных команд (move, attack, chat)
- [ ] Быстрые кнопки действий
- [ ] Отображение ответа сервера

### Этап 6: Инвентарь и улучшения (опционально)
- [ ] Визуальная сетка инвентаря
- [ ] Drag-and-drop (если нужно)
- [ ] Мобильная адаптация

---

## 🎨 Варианты дизайна

| Вариант | Описание |
|---------|----------|
| **Тёмная тема** | Классическая игровая, как в L2 интерфейсе |
| **Светлая тема** | Стандартная, для дневного использования |
| **L2 Classic** | Стилизация под оригинальный интерфейс Lineage 2 |

---

## 🚀 Следующие шаги

Для начала реализации:
1. Выбрать тему оформления (тёмная/светлая/L2 стиль)
2. Начать с Этапа 1 (базовый каркас)
3. Или выбрать альтернативу: чистый Swagger UI (проще и быстрее)

---

## 📚 Связанные документы

- [L2TS_API_DOCUMENTATION.md](./L2TS_API_DOCUMENTATION.md) — Спецификация API
- [CLAUDE.md](./CLAUDE.md) — Архитектура проекта
- [DOCUMENTATION.md](./DOCUMENTATION.md) — Общая документация
