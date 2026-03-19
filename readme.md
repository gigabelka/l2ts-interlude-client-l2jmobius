# L2 Headless Client for L2J_Mobius_CT_0_Interlude

[![Node.js Version](https://img.shields.io/badge/node-%3E%3D24.14.0-brightgreen)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/typescript-5.9.3-blue)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

Headless Lineage 2 клиент с **REST + WebSocket API** на TypeScript. Подключается к Login Server, аутентифицируется, выбирает персонажа и предоставляет API для управления и мониторинга.

Целевой сервер: [L2J_Mobius CT_0_Interlude](https://gitlab.com/MobiusDevelopment/L2J_Mobius) (Protocol 746).

---

## Быстрый старт

```bash
# Установка
npm install

# Настройка конфигурации
cp .env.example .env
# Отредактируй .env с вашими данными

# Запуск в режиме разработки
npm run dev

# Или сборка и запуск
npm run build
npm start
```

Открой дашборд: http://localhost:3000

---

## Конфигурация

Переменные окружения в `.env`:

```bash
L2_LOGIN_IP=192.168.0.33         # IP логин-сервера
L2_LOGIN_PORT=2106               # Порт логин-сервера
L2_GAME_PORT=7777                # Порт игрового сервера
L2_USERNAME=your_login           # Логин аккаунта
L2_PASSWORD=your_password        # Пароль
L2_SERVER_ID=2                   # ID сервера
L2_CHAR_SLOT=0                   # Слот персонажа
API_PORT=3000                    # Порт API
API_KEY=                         # API ключ (пусто = без авторизации)
LOG_LEVEL=ERROR                  # Уровень логирования
```

---

## API

### REST Endpoints

```bash
# Статус
GET  /api/v1/status

# Персонаж
GET  /api/v1/character
GET  /api/v1/character/stats
POST /api/v1/move/to             # { x, y, z }

# Бой
POST /api/v1/target/set          # { objectId }
POST /api/v1/combat/attack
POST /api/v1/combat/use-skill    # { skillId, level }

# Мир
GET  /api/v1/nearby/npcs
GET  /api/v1/nearby/items

# Чат
POST /api/v1/chat/send           # { channel, message }
```

### WebSocket

```javascript
const ws = new WebSocket('ws://localhost:3000/ws?token=API_KEY');

ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'subscribe',
    channels: ['character', 'combat', 'world']
  }));
};
```

---

## Команды

```bash
npm run dev              # Разработка
npm run debug            # Подробное логирование пакетов
npm run build            # Сборка
npm start                # Запуск
npm test                 # Тесты
npm run lint             # Линтинг
npm run export:data      # Экспорт данных из L2J
```

---

## Документация

- **[docs/DOCUMENTATION.md](docs/DOCUMENTATION.md)** — Полная техническая документация (API, архитектура, примеры)
- **[docs/client_server_protocol.md](docs/client_server_protocol.md)** — Спецификация протокола
- **[AGENTS.md](AGENTS.md)** — Руководство для AI-агентов

---

## Архитектура

```
src/
├── api/              # REST API + WebSocket
├── domain/           # Сущности, события, репозитории
├── application/      # Порты (интерфейсы)
├── infrastructure/   # Реализации (DB, EventBus, протокол)
├── network/          # TCP соединение
├── crypto/           # Blowfish, RSA, XOR
├── login/            # Login Server клиент
└── game/             # Game Server клиент
```

Clean Architecture + Dependency Injection + Result<T,E>.

---

## Лицензия

MIT — см. [LICENSE](LICENSE)
