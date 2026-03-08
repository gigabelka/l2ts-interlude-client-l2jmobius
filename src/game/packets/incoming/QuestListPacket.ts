import { PacketReader } from '../../../network/PacketReader';
import { Logger } from '../../../logger/Logger';
import { IncomingGamePacket } from './IncomingGamePacket';

/**
 * QuestList (OpCode=0x80) — list of active quests.
 * Response to RequestQuestList; arrives after client enters IN_GAME state.
 */
export class QuestListPacket implements IncomingGamePacket {
    public questCount: number = 0;

    decode(reader: PacketReader): this {
        reader.readUInt8();  // opcode 0x80

        this.questCount = reader.readUInt16LE();

        for (let i = 0; i < this.questCount; i++) {
            reader.readInt32LE();  // questId
            reader.readInt32LE();  // stage
        }

        Logger.info('QuestListPacket', `[QUESTS] active quests: ${this.questCount}`);

        if (reader.remaining() > 0) {
            Logger.debug('QuestListPacket', `remaining: ${reader.remaining()}`);
        }

        return this;
    }
}
