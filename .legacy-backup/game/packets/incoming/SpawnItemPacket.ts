import { PacketReader } from '../../../network/PacketReader';
import { IncomingGamePacket } from './IncomingGamePacket';
import { GameStateStore } from '../../../core/GameStateStore';

/**
 * SpawnItem (0x0B) - Item spawned on ground
 * 
 * Structure:
 * - objectId (int32)
 * - itemId (int32) - display ID
 * - x (int32)
 * - y (int32)
 * - z (int32)
 * - isStackable (int32)
 * - count (int32)
 * - unknown (int32) - 0
 */
export class SpawnItemPacket implements IncomingGamePacket {
    public objectId: number = 0;
    public itemId: number = 0;
    public x: number = 0;
    public y: number = 0;
    public z: number = 0;
    public isStackable: boolean = false;
    public count: number = 1;

    decode(reader: PacketReader): this {
        reader.readUInt8(); // opcode 0x0B
        
        this.objectId = reader.readInt32LE();
        this.itemId = reader.readInt32LE();
        this.x = reader.readInt32LE();
        this.y = reader.readInt32LE();
        this.z = reader.readInt32LE();
        this.isStackable = reader.readInt32LE() !== 0;
        this.count = reader.readInt32LE();
        reader.readInt32LE(); // unknown (0)

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
