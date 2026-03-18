# Рефакторинг сетевого слоя — Шаг 3

## Обзор изменений

Сетевой слой полностью переработан с применением принципов **SOLID** и **чистой архитектуры**:

- **S**ingle Responsibility — каждый класс отвечает только за свою задачу
- **O**pen/Closed — расширение через композицию, а не наследование
- **I**nterface Segregation — узкие интерфейсы для криптографии

## Структура

```
src/network/
├── types.ts                    # Общие типы и интерфейсы
├── NetworkConnection.ts        # Высокоуровневое API (композиция)
├── transport/
│   └── TcpTransport.ts         # Чистый TCP (без шифрования)
├── buffer/
│   └── PacketBuffer.ts         # Реассемблирование L2 пакетов
├── protocol/
│   ├── BinaryReader.ts         # Чтение бинарных данных
│   └── BinaryWriter.ts         # Запись бинарных данных
└── legacy/
    ├── LoginConnection.ts      # Адаптер для Login Server
    └── GameConnection.ts       # Адаптер для Game Server
```

## Разделение ответственности

### 1. TcpTransport — Транспортный уровень

**Отвечает за:**
- Установку TCP соединения
- Отправку/получение сырых байтов
- Управление состоянием соединения

**НЕ делает:**
- НЕ шифрует/расшифровывает данные
- НЕ собирает фрагментированные пакеты
- НЕ парсит протокол

```typescript
const transport = new TcpTransport({
    host: '192.168.0.33',
    port: 2106,
    connectTimeout: 30000,
    keepAlive: true,
    noDelay: true,
});

transport.on('data', (chunk: Buffer) => {
    // Получен чанк от ОС (может быть частью пакета или несколько пакетов)
});

transport.connect();
```

### 2. PacketBuffer — Буферизация

**Отвечает за:**
- Реассемблирование L2 пакетов из TCP потока
- Обработку фрагментации
- Защиту от переполнения (OOM protection)

**Алгоритм реассемблирования:**

```
TCP чанки: [часть пакета 1][пакет 2][часть пакета 3]
                ↓
PacketBuffer накапливает данные
                ↓
Когда достаточно данных для полного пакета:
- Читаем uint16LE length (первые 2 байта)
- Проверяем: если buffer.length >= length → пакет готов
- Извлекаем пакет, остаток оставляем в буфере
                ↓
Возвращаем массив готовых пакетов
```

```typescript
const buffer = new PacketBuffer(maxSize);

// При получении данных от TCP
const packets = buffer.append(chunk);
for (const packet of packets) {
    // packet = [uint16LE length][opcode][payload...]
    processPacket(packet);
}
```

### 3. ICipher — Интерфейс шифрования

```typescript
interface ICipher {
    encrypt(data: Buffer): Buffer;
    decrypt(data: Buffer): Buffer;
    isInitialized(): boolean;
}
```

**Реализации:**
- `LoginCipher` — Blowfish ECB + XOR + контрольная сумма
- `XorCipher` — XOR для Game Server
- `BlowfishEngine` — чистый Blowfish ECB

### 4. NetworkConnection — Композиция всего

Объединяет все компоненты в единое целое:

```typescript
const connection = new NetworkConnection({
    transport: { host, port },
    cipher: new XorCipher(),  // или undefined для нешифрованного
    maxBufferSize: 1024 * 1024,
});

connection.on('packet', (opcode, body) => {
    // body уже расшифрован
});

connection.connect();
connection.send(bodyBuffer);  // Автоматически шифрует и добавляет length header
```

## Обработка фрагментации TCP

### Проблема

TCP — потоковый протокол без границ сообщений. Пример:

```
Отправлено сервером: [Пакет A: 20 байт][Пакет B: 15 байт]

Получено клиентом может быть:
1. [20 байт][15 байт] — идеально
2. [35 байт] — два пакета в одном чанке (coalescing)
3. [10 байт] → [25 байт] — пакет разделился
4. [15 байт] → [5 байт][15 байт] — комбинация
```

### Решение

`PacketBuffer` использует length-prefix framing:

```typescript
// L2 Protocol:
// [uint16LE: total_length][byte[total_length - 2]: body]
// 
// total_length включает 2 байта заголовка!

private extractPacketsFromBuffer(buffer: Buffer): Buffer[] {
    const packets: Buffer[] = [];
    let offset = 0;

    while (offset < buffer.length) {
        // 1. Нужно минимум 2 байта для заголовка
        if (offset + 2 > buffer.length) break;

        // 2. Читаем длину пакета
        const packetLength = buffer.readUInt16LE(offset);

        // 3. Проверяем, весь ли пакет у нас есть
        if (offset + packetLength > buffer.length) break;

        // 4. Извлекаем полный пакет
        const packet = buffer.subarray(offset, offset + packetLength);
        packets.push(Buffer.from(packet));
        
        offset += packetLength;
    }

    // Сохраняем остаток для следующего раза
    this.buffer = buffer.subarray(offset);
    return packets;
}
```

## Улучшения криптографии

### 1. Убрано дублирование

**Было:**
```typescript
// NewCrypt.ts — дублирование кода в verifyChecksum и appendChecksum
static verifyChecksum(raw, offset, size) {
    // цикл for для XOR
}
static appendChecksum(raw, offset, size) {
    // тот же цикл for для XOR
}
```

**Стало:**
```typescript
// ByteUtils.ts — единая реализация
export function calculateChecksum(data, offset, size): number {
    // единый алгоритм
}

export function verifyChecksum(data, offset, size): boolean {
    return calculateChecksum(...) === storedChecksum;
}

export function appendChecksumInPlace(data, offset, size): void {
    const checksum = calculateChecksum(...);
    // записать в конец
}
```

### 2. Типизация

- Все криптографические классы реализуют `ICipher`
- Явные типы для ключей (`Uint8Array`, `Buffer`)
- Защита от неинициализированного состояния

### 3. Инкапсуляция байтовых операций

```typescript
// utils/ByteUtils.ts
export function bytesToUint32LE(bytes, offset): number;
export function uint32ToBytesLE(value, bytes, offset): void;
export function xor32(a, b): number;
export function toUnsigned32(value): number;
```

## Комментарии к неочевидным манипуляциям

### 1. Выравнивание буферов (LoginCipher)

```typescript
// Выравнивание до 4 байт для контрольной суммы
// (чексумма работает с 32-битными словами)
let result = alignBuffer(data, 4);

// Добавляем 8 байт: 4 для чексуммы + 4 padding
// Padding нужен чтобы следующий шаг дал кратность 8
result = Buffer.concat([result, Buffer.alloc(8, 0)]);

// Выравнивание до 8 байт для Blowfish ECB
// (Blowfish работает с 64-битными блоками)
result = alignBuffer(result, 8);
```

### 2. Rolling XOR для Init пакета

```typescript
// XOR seed находится в определённой позиции расшифрованного пакета
// Определяется форматом Init пакета сервера
const xorSeed = (
    (data[size - 16] & 0xFF) |
    ((data[size - 15] & 0xFF) << 8) |
    ((data[size - 14] & 0xFF) << 16) |
    ((data[size - 13] & 0xFF) << 24)
);

// Обратное XOR (дешифровка) идёт с конца к началу
// это обратная операция от шифрования сервера
rollingXorDecrypt(raw, 0, size - 8, xorSeed);
```

### 3. Scrambled RSA Key

```typescript
// L2J сервер "перемешивает" RSA модуль операциями: D -> A -> B -> C
// Клиент должен выполнить обратные операции в обратном порядке:

// C^-1: верхняя половина XOR с нижней
for (let i = 0; i < 0x40; i++) {
    result[0x40 + i] ^= result[i];
}

// B^-1: XOR 4 байт по смещению 0x0D с байтами по 0x34
for (let i = 0; i < 4; i++) {
    result[0x0D + i] ^= result[0x34 + i];
}

// A^-1: нижняя половина XOR с верхней
for (let i = 0; i < 0x40; i++) {
    result[i] ^= result[0x40 + i];
}

// D^-1: swap первых 4 байт с байтами по смещению 0x4D
for (let i = 0; i < 4; i++) {
    swap(result[0x00 + i], result[0x4D + i]);
}
```

## Миграция существующего кода

### Старый подход (наследование):
```typescript
class LoginClient extends Connection {
    protected onRawPacket(packet) { ... }
}
```

### Новый подход (композиция):
```typescript
class LoginClient {
    private connection = new LoginConnection(config);
    
    constructor() {
        this.connection.on('packet', (opcode, body) => {
            this.handlePacket(opcode, body);
        });
    }
}
```

## Тестирование

Ключевые сценарии для проверки:

1. **Фрагментация:** Проверить, что пакеты корректно собираются из частей
2. **Coalescing:** Проверить, что несколько пакетов в одном чанке разделяются
3. **Шифрование:** Проверить round-trip (encrypt → decrypt)
4. **Контрольная сумма:** Проверить verifyChecksum после decrypt
5. **RSA:** Проверить unscramble → encrypt → (server decrypt)

## Безопасность

- **Защита от OOM:** `maxBufferSize` ограничивает накопительный буфер
- **Валидация размеров:** Проверка `packetLength` перед выделением памяти
- **Таймауты:** TCP connect timeout, keep-alive
