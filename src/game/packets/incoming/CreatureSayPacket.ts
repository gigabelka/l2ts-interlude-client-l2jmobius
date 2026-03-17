import { PacketReader } from '../../../network/PacketReader';
import { IncomingGamePacket } from './IncomingGamePacket';
import { GameStateStore } from '../../../core/GameStateStore';
import { EventBus } from '../../../core/EventBus';

/**
 * CreatureSay (0x4A) - Chat message
 * 
 * Structure:
 * - objectId (int32)
 * - chatType (int32)
 * - speakerName (string)
 * - message (string)
 */
export class CreatureSayPacket implements IncomingGamePacket {
    public objectId: number = 0;
    public chatType: number = 0;
    public speakerName: string = '';
    public message: string = '';

    decode(reader: PacketReader): this {
        try {
            reader.readUInt8(); // opcode 0x4A
            
            this.objectId = reader.readInt32LE();
            this.chatType = reader.readInt32LE();
            this.speakerName = reader.readStringUTF16();
            this.message = reader.readStringUTF16();

            // Emit chat event
            EventBus.emitEvent({
                type: 'chat.message',
                channel: 'chat',
                data: {
                    objectId: this.objectId,
                    senderName: this.speakerName,
                    channel: this.getChannelName(this.chatType),
                    message: this.message,
                    receivedAt: new Date().toISOString()
                },
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            // Ignore decode errors
        }

        return this;
    }

    private getChannelName(type: number): string {
        const channels: Record<number, string> = {
            0: 'ALL',
            1: 'SHOUT',
            2: 'TELL',
            3: 'PARTY',
            4: 'CLAN',
            5: 'GM',
            8: 'TRADE',
            9: 'ALLIANCE',
            17: 'HERO'
        };
        return channels[type] || `TYPE_${type}`;
    }
}
