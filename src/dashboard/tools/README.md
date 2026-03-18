# Dashboard Tools

Инструменты для разработки и мониторинга L2 клиента.

## 📁 Содержимое

| Файл | Описание |
|------|----------|
| `packet-sniffer.html` | 🔥 Профессиональный анализатор пакетов с фильтрами |
| `websocket-client.html` | Простой WebSocket клиент для мониторинга |

---

## WebSocket Integration Example

Этот пример демонстрирует интеграцию `GameSession` с `WsServer` для трансляции L2 пакетов в реальном времени через WebSocket.

## 📦 Установленные зависимости

В проекте уже установлены необходимые пакеты:

```bash
# Основная библиотека WebSocket
npm install ws

# Типы для TypeScript
npm install --save-dev @types/ws
```

## 🚀 Быстрый старт

### 1. Запусти WebSocket сервер

```bash
# Вариант A: Через основное приложение (WebSocket на порту 3000, shared mode)
npm run dev

# Вариант B: Standalone WebSocket сервер на порту 8080
# Отредактируй tools/websocket-integration.ts с настройками своего сервера
# и запусти:
npx ts-node tools/websocket-integration.ts
```

### 2. Открой WebSocket клиент

Просто открой файл `tools/websocket-client.html` в браузере:

```bash
# Windows
start tools/websocket-client.html

# macOS
open tools/websocket-client.html

# Linux
xdg-open tools/websocket-client.html
```

Или запусти простой HTTP сервер:

```bash
npx serve examples -p 8081
# Открой http://localhost:8081/websocket-client.html
```

### 3. Подключись

Нажми кнопку **"🔗 Connect"** в интерфейсе и наблюдай за пакетами в реальном времени!

## 📡 API WebSocket

### Подключение

```javascript
const ws = new WebSocket('ws://localhost:8080');
// или shared mode: ws://localhost:3000/ws
```

### Формат сообщений от сервера

```json
{
  "type": "packet.received",
  "timestamp": "2024-01-15T10:30:45.123Z",
  "opcode": 4,
  "opcodeHex": "0x04",
  "packetName": "UserInfoPacket",
  "data": {
    "name": "PlayerName",
    "level": 80,
    "hp": 5000,
    "maxHp": 5000
  }
}
```

### Формат сообщений об ошибках

```json
{
  "type": "packet.error",
  "timestamp": "2024-01-15T10:30:45.123Z",
  "opcode": 255,
  "opcodeHex": "0xFF",
  "error": "Unknown packet opcode: 0xFF (255)",
  "hexDump": "0000:  FF 00 01 02 03 04 05 06 07 08 09 0A 0B 0C 0D 0E  |................|"
}
```

## 🔧 Как это работает

### Архитектура

```
┌─────────────────┐     TCP      ┌──────────────┐     JSON      ┌─────────────────┐
│   L2 Server     │ ◄──────────► │  GameSession │ ────────────► │   PacketHandler │
└─────────────────┘              └──────────────┘               └─────────────────┘
                                                                          │
                                                                          ▼
┌─────────────────┐     WS       ┌──────────────┐               ┌─────────────────┐
│  Browser (HTML) │ ◄──────────► │   WsServer   │ ◄──────────── │   onPacketArrival
└─────────────────┘   (port 8080) └──────────────┘    broadcast() └─────────────────┘
```

### Код интеграции

```typescript
import { createGameSession } from './network/GameSession';
import { WsServer } from './api/ws/WsServer';

// 1. Создаем WebSocket сервер
const wsServer = new WsServer();
wsServer.start(undefined, { port: 8080 }); // standalone mode

// 2. Создаем GameSession
const session = createGameSession({
    onPacketArrival: (result) => {
        if (result.success) {
            // Получаем JSON из пакета
            const packetJson = result.packet.toJSON();
            
            // Отправляем всем WebSocket клиентам
            wsServer.broadcast({
                type: 'packet.received',
                timestamp: new Date().toISOString(),
                packetName: result.packet.constructor.name,
                opcode: result.opcode,
                data: packetJson
            });
        }
    }
});

// 3. Подключаемся к серверу
session.connectTo('127.0.0.1', 7777);
```

## 🎨 Возможности HTML клиента

- ✅ Автоматическое подключение/отключение
- ✅ Подсчет пакетов в секунду
- ✅ Фильтрация по имени пакета
- ✅ Цветовая кодировка типов пакетов
- ✅ Подсветка JSON синтаксиса
- ✅ Автопрокрутка новых пакетов

## 📂 Структура файлов

```
tools/
├── websocket-integration.ts    # Пример интеграции (backend)
├── websocket-client.html       # Простой HTML клиент (frontend)
├── packet-sniffer.html         # 🔥 Профессиональный Packet Analyzer
└── README.md                   # Этот файл
```

## 🔥 Packet Sniffer / Analyzer

**`packet-sniffer.html`** — профессиональный инструмент для разработчиков с функциями фильтрации и анализа пакетов.

### Особенности:

- 🎨 **Темная тема** — стиль как в Chrome DevTools
- 🔍 **Фильтрация по категориям**:
  - Chat (Say2, Tell, Shout...)
  - Movement (MoveToLocation, ValidatePosition...)
  - Status (UserInfo, CharInfo, StatusUpdate...)
  - Inventory (ItemList, InventoryUpdate...)
  - Combat (Attack, MagicSkillUse...)
  - System (Auth, Crypt...)
  - Other
- 🔎 **Быстрый фильтр** — по opcode (0x04) или имени пакета
- ⏸️ **Pause mode** — пауза отображения (пакеты буферизуются)
- 📊 **Статистика** — total, rate/sec, shown/hidden
- 📥 **Export** — сохранение в JSON
- 📋 **Copy** — копирование в буфер обмена
- 📜 **Auto-scroll** — автопрокрутка логов

### Запуск:

```bash
# Открой файл в браузере
start tools/packet-sniffer.html

# Или через HTTP сервер
npx serve examples -p 8081
# http://localhost:8081/packet-sniffer.html
```

### Использование:

1. Запусти WebSocket сервер (standalone mode на порту 8080)
2. Открой `packet-sniffer.html`
3. Нажми **Connect**
4. Используй чекбоксы для фильтрации спама от movement пакетов
5. Используй поле фильтра для поиска конкретного пакета

## 🔍 Отладка

### Проверка WebSocket сервера

```bash
# Проверь, что сервер слушает порт
netstat -an | findstr 8080        # Windows
# или
lsof -i :8080                     # macOS/Linux
```

### Тестирование через curl

WebSocket не работает через curl, но можно проверить HTTP часть:

```bash
curl http://localhost:3000/health  # API health check
```

### Тестирование через wscat

```bash
npm install -g wscat
wscat -c ws://localhost:8080
```

## 📝 Примечания

1. **Порт 8080** — стандартный порт для standalone WebSocket сервера
2. **Порт 3000/ws** — путь для shared mode (вместе с API)
3. Автоматически отправляется ping/pong каждые 30 секунд для поддержания соединения
4. Максимальное количество пакетов в UI ограничено 100 (старые удаляются)

## 🆘 Troubleshooting

### "WebSocket connection failed"
- Убедись, что сервер запущен на порту 8080
- Проверь, что порт не занят другим приложением

### "No packets received"
- Убедись, что GameSession подключен к L2 серверу
- Проверь, что в `initPacketHandlers` зарегистрированы нужные пакеты

### "CORS error"
- Если открываешь HTML напрямую через `file://`, используй HTTP сервер
- Запусти: `npx serve examples`
