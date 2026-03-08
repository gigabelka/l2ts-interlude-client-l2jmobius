export enum GameState {
    IDLE               = 'IDLE',
    CONNECTING         = 'CONNECTING',
    WAIT_CRYPT_INIT    = 'WAIT_CRYPT_INIT',
    WAIT_CHAR_LIST     = 'WAIT_CHAR_LIST',
    WAIT_CHAR_SELECTED = 'WAIT_CHAR_SELECTED',
    WAIT_USER_INFO     = 'WAIT_USER_INFO',
    IN_GAME            = 'IN_GAME',
    ERROR              = 'ERROR',
}
