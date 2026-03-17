import { PacketReader } from '../../../network/PacketReader';
import { IncomingGamePacket } from './IncomingGamePacket';
import { GameStateStore } from '../../../core/GameStateStore';
import { EventBus } from '../../../core/EventBus';

/**
 * DropItem (0x0C) - Item dropped by player/mob
 * 
 * Structure:
 * - playerObjectId (int32) - who dropped
 * - objectId (int32)
 * - itemId (int32) - display ID
 * - x (int32)
 * - y (int32)
 * - z (int32)
 * - isStackable (int32)
 * - count (int32)
 * - unknown (int32) - 1
 */
export class DropItemPacket implements IncomingGamePacket {
    public playerObjectId: number = 0;
    public objectId: number = 0;
    public itemId: number = 0;
    public x: number = 0;
    public y: number = 0;
    public z: number = 0;
    public isStackable: boolean = false;
    public count: number = 1;

    decode(reader: PacketReader): this {
        reader.readUInt8(); // opcode 0x0C
        
        this.playerObjectId = reader.readInt32LE();
        this.objectId = reader.readInt32LE();
        this.itemId = reader.readInt32LE();
        this.x = reader.readInt32LE();
        this.y = reader.readInt32LE();
        this.z = reader.readInt32LE();
        this.isStackable = reader.readInt32LE() !== 0;
        this.count = reader.readInt32LE();
        reader.readInt32LE(); // unknown (1)

        // Add to GameStateStore
        GameStateStore.addItemDrop({
            objectId: this.objectId,
            itemId: this.itemId,
            name: `Item ${this.itemId}`, // TODO: Get item name from item database
            count: this.count,
            position: { x: this.x, y: this.y, z: this.z }
        });

        return this;
    }
}
