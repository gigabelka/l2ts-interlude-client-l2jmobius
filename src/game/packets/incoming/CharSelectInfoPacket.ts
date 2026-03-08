import { PacketReader } from '../../../network/PacketReader';
import { Logger } from '../../../logger/Logger';
import { IncomingGamePacket } from './IncomingGamePacket';

export interface CharInfo {
    name: string;
    charId: number;
    loginName: string;
    sessionId: number;
    clanId: number;
    sex: number;
    race: number;
    classId: number;
    isActive: number;
    x: number;
    y: number;
    z: number;
    currentHp: number;
    currentMp: number;
    sp: number;
    exp: bigint;
    level: number;
    karma: number;
    itemObjectIds: number[];
    itemIds: number[];
    hairStyle: number;
    hairColor: number;
    face: number;
    maxHp: number;
    maxMp: number;
    deleteTimeSec: number;
    classId2: number;
    isLastUsed: number;
    enchantEffect: number;
    augmentationId: number;
}

/**
 * CharSelectionInfo (OpCode=0x13) — server sends the list of characters on the account.
 *
 * L2J Mobius CT0 Interlude format per character:
 *   S(name) D(objectId) S(loginName) D(sessionId) D(clanId) D(builderLevel)
 *   D(sex) D(race) D(classId) D(active) D(x) D(y) D(z)
 *   F(hp) F(mp) D(sp) Q(exp) D(level) D(karma) D(pkKills) D(pvpKills)
 *   10xD(paperdollObjectIds) 10xD(paperdollItemIds)
 *   D(hairStyle) D(hairColor) D(face) F(maxHp) F(maxMp)
 *   D(deleteTimer) D(classId) D(isLastUsed) C(enchantEffect) D(augmentationId)
 */
export class CharSelectInfoPacket implements IncomingGamePacket {
    public charCount: number = 0;
    public chars: CharInfo[] = [];

    decode(reader: PacketReader): this {
        reader.readUInt8();  // opcode 0x13

        this.charCount = reader.readInt32LE();

        for (let i = 0; i < this.charCount; i++) {
            const char: CharInfo = {
                name: '', charId: 0, loginName: '', sessionId: 0, clanId: 0,
                sex: 0, race: 0, classId: 0, isActive: 0,
                x: 0, y: 0, z: 0,
                currentHp: 0, currentMp: 0, sp: 0, exp: BigInt(0),
                level: 0, karma: 0,
                itemObjectIds: [], itemIds: [],
                hairStyle: 0, hairColor: 0, face: 0,
                maxHp: 0, maxMp: 0,
                deleteTimeSec: 0, classId2: 0, isLastUsed: 0,
                enchantEffect: 0, augmentationId: 0,
            };

            char.name = reader.readStringUTF16();
            char.charId = reader.readInt32LE();
            char.loginName = reader.readStringUTF16();
            char.sessionId = reader.readInt32LE();
            char.clanId = reader.readInt32LE();
            reader.skip(4);  // builder level
            char.sex = reader.readInt32LE();
            char.race = reader.readInt32LE();
            char.classId = reader.readInt32LE();
            char.isActive = reader.readInt32LE();
            char.x = reader.readInt32LE();
            char.y = reader.readInt32LE();
            char.z = reader.readInt32LE();
            char.currentHp = reader.readDouble();
            char.currentMp = reader.readDouble();
            char.sp = reader.readInt32LE();
            char.exp = reader.readInt64LE();
            char.level = reader.readInt32LE();
            char.karma = reader.readInt32LE();

            // 2 unused int32 fields (pkKills, pvpKills)
            for (let j = 0; j < 2; j++) {
                reader.skip(4);
            }

            // 10 paperdoll object IDs (CT0 format)
            char.itemObjectIds = [];
            for (let j = 0; j < 10; j++) {
                char.itemObjectIds.push(reader.readInt32LE());
            }

            // 10 paperdoll item IDs (CT0 format)
            char.itemIds = [];
            for (let j = 0; j < 10; j++) {
                char.itemIds.push(reader.readInt32LE());
            }

            char.hairStyle = reader.readInt32LE();
            char.hairColor = reader.readInt32LE();
            char.face = reader.readInt32LE();
            char.maxHp = reader.readDouble();
            char.maxMp = reader.readDouble();
            char.deleteTimeSec = reader.readInt32LE();
            char.classId2 = reader.readInt32LE();
            char.isLastUsed = reader.readInt32LE();
            char.enchantEffect = reader.readUInt8();
            char.augmentationId = reader.readInt32LE();

            this.chars.push(char);

            Logger.info('CharSelectInfoPacket',
                `[CHAR ${i}] name=${char.name}  classId=${char.classId}  level=${char.level}  hp=${char.currentHp}/${char.maxHp}  pos=(${char.x},${char.y},${char.z})  lastUsed=${char.isLastUsed === 1}`);
        }

        if (reader.remaining() > 0) {
            Logger.debug('CharSelectInfoPacket', `remaining: ${reader.remaining()}`);
        }

        return this;
    }
}
