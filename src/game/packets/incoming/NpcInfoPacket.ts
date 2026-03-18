import { PacketReader } from '../../../network/PacketReader';
import { IncomingGamePacket } from './IncomingGamePacket';
import { GameStateStore } from '../../../core/GameStateStore';
import { EventBus } from '../../../core/EventBus';
import { getNpc } from '../../../data/loader';

/**
 * NpcInfo (0x16) - NPC information
 * 
 * Structure (simplified):
 * - objectId (int32)
 * - npcId (int32)
 * - isAttackable (int32)
 * - x, y, z (int32 each)
 * - heading (int32)
 * ... more fields
 */
export class NpcInfoPacket implements IncomingGamePacket {
    public objectId: number = 0;
    public npcId: number = 0;
    public isAttackable: boolean = false;
    public x: number = 0;
    public y: number = 0;
    public z: number = 0;
    public heading: number = 0;
    public level: number = 0;
    public name: string = '';
    public title: string = '';

    decode(reader: PacketReader): this {
        try {
            reader.readUInt8(); // opcode 0x16
            
            this.objectId = reader.readInt32LE();
            this.npcId = reader.readInt32LE();
            this.isAttackable = reader.readInt32LE() !== 0;
            this.x = reader.readInt32LE();
            this.y = reader.readInt32LE();
            this.z = reader.readInt32LE();
            this.heading = reader.readInt32LE();
            
            // Skip remaining data for now
            if (reader.remaining() > 0) {
                reader.skip(reader.remaining());
            }

            // Get NPC data from database
            const npcData = getNpc(this.npcId);
            const npcName = npcData?.name || `NPC ${this.npcId}`;
            const npcLevel = npcData?.level || this.level || 1;

            // Add to GameStateStore
            GameStateStore.addNpc({
                objectId: this.objectId,
                npcId: this.npcId,
                name: npcName,
                level: npcLevel,
                hp: { current: 100, max: 100 },
                isAttackable: this.isAttackable,
                isAggressive: false,
                position: { x: this.x, y: this.y, z: this.z }
            });

        } catch (error) {
            // Ignore decode errors
        }

        return this;
    }
}
