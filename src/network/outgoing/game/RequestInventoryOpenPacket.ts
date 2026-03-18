/**
 * src/network/outgoing/game/RequestInventoryOpenPacket.ts
 * Исходящий пакет запроса открытия инвентаря
 * Опкод: 0x15
 * Протокол: L2J_Mobius CT_0_Interlude (Protocol 746)
 */

import { PacketWriter } from '../../PacketWriter';

/**
 * Опкод пакета запроса инвентаря
 */
const REQUEST_INVENTORY_OPEN_OPCODE = 0x15;

/**
 * Создает пакет запроса открытия инвентаря
 * Этот пакет не содержит тела, только опкод
 * @returns Buffer с готовым пакетом
 */
export function createRequestInventoryOpenPacket(): Buffer {
    const writer = new PacketWriter();
    writer.writeUInt8(REQUEST_INVENTORY_OPEN_OPCODE);
    return writer.toBuffer();
}

/**
 * Класс-обертка для пакета запроса инвентаря (если нужна ООП реализация)
 */
export class RequestInventoryOpenPacket {
    /**
     * Опкод пакета
     */
    public static readonly OPCODE = REQUEST_INVENTORY_OPEN_OPCODE;

    /**
     * Сериализует пакет в Buffer
     */
    public static serialize(): Buffer {
        return createRequestInventoryOpenPacket();
    }

    /**
     * Создает экземпляр пакета
     */
    public static create(): RequestInventoryOpenPacket {
        return new RequestInventoryOpenPacket();
    }

    /**
     * Сериализует пакет в Buffer
     */
    public serialize(): Buffer {
        return createRequestInventoryOpenPacket();
    }
}
