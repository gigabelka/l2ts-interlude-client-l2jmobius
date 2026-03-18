// src/data/index.ts
// Экспорт всех данных и типов L2J Mobius

export * from './types';
export * from './loader';

// Database singletons
export { SkillDatabase, SkillDatabaseInstance } from './SkillDatabase';
export { NpcDatabase, NpcDatabaseInstance } from './NpcDatabase';
export { ItemDatabase, ItemDatabaseInstance } from './ItemDatabase';

// Реэкспорт для удобного импорта
export { 
    armorSets, 
    items, 
    npcs, 
    skills, 
    skillTrees, 
    classTemplates, 
    pets, 
    fishing, 
    hennas, 
    augmentation 
} from './loader';
