export {
    Container,
    ContainerBuilder,
    DIError,
    DI_TOKENS,
} from './Container';
export type {
    Constructor,
    Factory,
    Registration,
    IContainer,
} from './Container';

// Composition Root - настройка DI контейнера
export { createContainer } from './composition';

import { architectureBridge } from '../../infrastructure/integration/NewArchitectureBridge';

/**
 * Получить глобальный DI контейнер
 */
export function getContainer() {
    return architectureBridge.getContainer();
}
