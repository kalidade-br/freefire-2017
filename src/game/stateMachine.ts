import { GameState } from './types';

export type StateChangeListener = (
  next: GameState,
  prev: GameState,
) => void;

const ALLOWED_TRANSITIONS: Record<GameState, GameState[]> = {
  [GameState.BOOT]: [GameState.LOADING],
  [GameState.LOADING]: [GameState.MENU, GameState.WAITING, GameState.PLAYING],
  [GameState.MENU]: [GameState.LOBBY, GameState.MATCHMAKING, GameState.LOADING],
  [GameState.LOBBY]: [GameState.MENU, GameState.MATCHMAKING, GameState.LOADING, GameState.WAITING],
  [GameState.MATCHMAKING]: [GameState.LOBBY, GameState.LOADING, GameState.WAITING],
  [GameState.WAITING]: [GameState.LOBBY, GameState.AIRPLANE],
  [GameState.AIRPLANE]: [GameState.DROPPING, GameState.LOBBY],
  [GameState.DROPPING]: [GameState.PARACHUTE, GameState.PLAYING, GameState.LOBBY],
  [GameState.PARACHUTE]: [GameState.PLAYING, GameState.LOBBY],
  [GameState.PLAYING]: [GameState.WIN, GameState.GAMEOVER, GameState.LOBBY, GameState.MENU],
  [GameState.WIN]: [GameState.LOBBY, GameState.MATCHMAKING, GameState.LOADING, GameState.MENU],
  [GameState.GAMEOVER]: [GameState.LOBBY, GameState.MATCHMAKING, GameState.LOADING, GameState.MENU],
};

export class GameStateMachine {
  private current: GameState = GameState.BOOT;
  private listeners = new Set<StateChangeListener>();

  public getState(): GameState {
    return this.current;
  }

  public canTransition(target: GameState): boolean {
    if (this.current === target) return false;
    return ALLOWED_TRANSITIONS[this.current]?.includes(target) ?? false;
  }

  public transition(target: GameState): boolean {
    if (!this.canTransition(target)) {
      return false;
    }
    const prev = this.current;
    this.current = target;
    this.listeners.forEach((cb) => cb(target, prev));
    return true;
  }

  public forceState(target: GameState): void {
    if (this.current === target) return;
    const prev = this.current;
    this.current = target;
    this.listeners.forEach((cb) => cb(target, prev));
  }

  public subscribe(cb: StateChangeListener): () => void {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }
}
