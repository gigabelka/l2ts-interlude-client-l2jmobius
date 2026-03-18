import { PacketReader } from '../../../network/PacketReader';
import { IncomingGamePacket } from './IncomingGamePacket';
import { GameStateStore } from '../../../core/GameStateStore';
import { EventBus } from '../../../core/EventBus';

/**
 * StatusUpdate (0x0E) - Status update (HP/MP/CP changes)
 * 
 * Structure:
 * - objectId (int32)
 * - attributes count (int32)
 * - [attributes...] (each: id (int32), value (int32))
 * 
 * Attribute IDs:
 * 9 = HP
 * 10 = Max HP
 * 11 = MP
 * 12 = Max MP
 * 13 = CP
 * 14 = Max CP
 */
export class StatusUpdatePacket implements IncomingGamePacket {
    public objectId: number = 0;
    public attributes: Map<number, number> = new Map();

    decode(reader: PacketReader): this {
        try {
            reader.readUInt8(); // opcode 0x0E
            
            this.objectId = reader.readInt32LE();
            const count = reader.readInt32LE();
            
            for (let i = 0; i < count && reader.remaining() >= 8; i++) {
                const attrId = reader.readInt32LE();
                const value = reader.readInt32LE();
                this.attributes.set(attrId, value);
            }

            // Check if this is our character
            const character = GameStateStore.getCharacter();
            if (character.objectId === this.objectId) {
                const hp = this.attributes.get(9);
                const maxHp = this.attributes.get(10);
                const mp = this.attributes.get(11);
                const maxMp = this.attributes.get(12);
                const cp = this.attributes.get(13);
                const maxCp = this.attributes.get(14);

                const eventData: any = {};
                if (hp !== undefined) eventData.hp = { current: hp, max: maxHp || character.hp?.max || hp };
                if (mp !== undefined) eventData.mp = { current: mp, max: maxMp || character.mp?.max || mp };
                if (cp !== undefined) eventData.cp = { current: cp, max: maxCp || character.cp?.max || cp };

                if (Object.keys(eventData).length > 0) {
                    GameStateStore.updateCharacter(eventData);
                    
                    EventBus.emitEvent({
                        type: 'character.stats_changed',
                        channel: 'character',
                        data: eventData,
                        timestamp: new Date().toISOString()
                    });
                }
            }

        } catch (error) {
            // Ignore decode errors
        }

        return this;
    }
}
