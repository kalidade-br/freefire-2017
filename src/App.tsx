import { useEffect, useRef, useState } from 'react';
import { soundEngine } from './game/audio';
import { BattleRoyaleEngine } from './game/gameEngine';
import {
  loadCharacterConfig,
  loadProfile,
  loadSettings,
  saveCharacterConfig,
  saveProfile,
  saveSettings,
} from './game/storage';
import {
  CharacterConfig,
  GameSettings,
  GameState,
  HudSnapshot,
  MatchMode,
  MinimapBuilding,
  MinimapRoad,
  PlayerProfile,
  PoiMarker,
} from './game/types';
import { BootAndLoadingScreen } from './components/BootAndLoadingScreen';
import { MainMenuScreen } from './components/MainMenuScreen';
import { LobbyScreen } from './components/LobbyScreen';
import {
  CharacterModal,
  CreditsModal,
  SettingsModal,
} from './components/Modals';
import { MatchmakingOverlay } from './components/MatchmakingOverlay';
import { GameHud } from './components/GameHud';
import { EndMatchModal } from './components/EndMatchModal';
import { HudEditorModal } from './components/HudEditorModal';
import { BackpackModal } from './components/BackpackModal';

const INITIAL_HUD: HudSnapshot = {
  hp: 200,
  maxHp: 200,
  vestLevel: 0,
  vestHp: 0,
  vestMaxHp: 0,
  helmetLevel: 0,
  helmetHp: 0,
  helmetMaxHp: 0,
  backpackLevel: 1,
  backpackUsed: 12,
  backpackCapacity: 80,
  medkitCount: 1,
  glooCount: 2,
  grenadeCount: 2,
  isPlacingGloo: false,
  isHoldingGrenade: false,
  usingMedkit: false,
  medkitProgress: 0,
  stance: 'stand',
  isSprinting: false,
  isAiming: false,
  isGrounded: true,
  isReloading: false,
  reloadProgress: 0,
  isDead: false,
  activeSlot: 3,
  activeScope: 'none',
  ownedScopes: ['none'],
  weapons: {
    1: null,
    2: null,
    3: {
      weaponId: 'g18',
      ammoInMag: 15,
      reserveAmmo: 60,
      scope: 'none',
      attachments: { muzzle: null, foregrip: null, magazine: null, stock: null },
    },
  },
  backpackItems: [],
  yawDeg: 0,
  playerX: 0,
  playerZ: 0,
  playerY: 0,
  altitude: 0,
  aliveCount: 51,
  kills: 0,
  damageDealt: 0,
  zoneTimerSec: 90,
  safeZone: {
    phase: 1,
    totalPhases: 5,
    isShrinking: false,
    timerSec: 90,
    currentX: 0,
    currentZ: 0,
    currentRadius: 510,
    nextX: 0,
    nextZ: 0,
    nextRadius: 320,
    damagePerSec: 2,
    playerOutside: false,
  },
  waitingTimerSec: 10,
  matchmakingCount: 1,
  canJumpFromPlane: false,
  canOpenParachute: false,
  canVaultWindow: false,
  nearbyLootLabel: null,
  hitmarkerActive: false,
  headshotFlashActive: false,
  aimLockedTarget: false,
  aimAssistActive: false,
  damageFlashActive: false,
  damagePopups: [],
  damageIndicators: [],
  killFeed: [],
  fps: 60,
  pointerLocked: false,
  currentPoi: null,
  matchMode: 'solo',
  reviveTarget: null,
  reviveProgress: 0,
  teamMembers: [],
};

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<BattleRoyaleEngine | null>(null);

  const [gameState, setGameState] = useState<GameState>(GameState.BOOT);
  const [loadProgress, setLoadProgress] = useState(0);
  const [loadText, setLoadText] = useState('Inicializando...');
  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const [mapMeta, setMapMeta] = useState<{
    buildings: MinimapBuilding[];
    roads: MinimapRoad[];
    pois: PoiMarker[];
  }>({ buildings: [], roads: [], pois: [] });

  const [settings, setSettings] = useState<GameSettings>(() => loadSettings());
  const [character, setCharacter] = useState<CharacterConfig>(() =>
    loadCharacterConfig(),
  );
  const [profile, setProfile] = useState<PlayerProfile>(() => loadProfile());

  const [showCharModal, setShowCharModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showHudEditor, setShowHudEditor] = useState(false);
  const [showCreditsModal, setShowCreditsModal] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isBackpackOpen, setIsBackpackOpen] = useState(false);
  const [matchMode, setMatchMode] = useState<MatchMode>('solo');

  const prevBackpackOpenRef = useRef(false);

  // Release pointer lock when Backpack / Pause modal opens & allow closing Backpack with Tab/B/Esc
  useEffect(() => {
    if (isBackpackOpen && !prevBackpackOpenRef.current) {
      soundEngine.playBackpackOpen();
    }
    prevBackpackOpenRef.current = isBackpackOpen;

    if (isBackpackOpen || isPaused) {
      soundEngine.stopRunAudio();
      if (document.pointerLockElement) {
        document.exitPointerLock?.();
      }
      engineRef.current?.input.setGameplayActive(false);
    } else if (
      gameState === GameState.WAITING ||
      gameState === GameState.DROPPING ||
      gameState === GameState.PARACHUTE ||
      gameState === GameState.PLAYING
    ) {
      engineRef.current?.input.setGameplayActive(true);
    }

    if (!isBackpackOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Tab' || e.code === 'KeyB' || e.code === 'Escape') {
        e.preventDefault();
        setIsBackpackOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isBackpackOpen, isPaused, gameState]);

  // Mount WebGLRenderer once inside isolated container
  useEffect(() => {
    const container = canvasMountRef.current;
    if (!container) return;

    const engine = new BattleRoyaleEngine(
      container,
      settings,
      character,
      (snap) => setHud(snap),
      () => {
        setIsBackpackOpen(false);
        setIsPaused((p) => !p);
      },
      () => setIsBackpackOpen((b) => !b),
    );
    engineRef.current = engine;
    engine.setPlayerNickname(profile.nickname);
    setMapMeta(engine.getMapMetadata());

    const unsub = engine.stateMachine.subscribe((next) => {
      setGameState(next);
      setIsPaused(false);
      setIsBackpackOpen(false);
      if (next === GameState.WIN || next === GameState.GAMEOVER) {
        setProfile((prev) => {
          const updated: PlayerProfile = {
            ...prev,
            matchesPlayed: prev.matchesPlayed + 1,
            wins: next === GameState.WIN ? prev.wins + 1 : prev.wins,
            gold: prev.gold + (next === GameState.WIN ? 250 : 60),
          };
          saveProfile(updated);
          return updated;
        });
      }
    });

    engine.startBootSequence((pct, label) => {
      setLoadProgress(pct);
      setLoadText(label);
    });

    return () => {
      unsub();
      engine.dispose();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleUpdateSettings = (next: GameSettings) => {
    setSettings(next);
    saveSettings(next);
    engineRef.current?.applyQualitySettings(next);
  };

  const handleToggleMute = () => {
    soundEngine.unlock();
    const next = { ...settings, muted: !settings.muted };
    handleUpdateSettings(next);
  };

  const handleUpdateCharacter = (next: CharacterConfig) => {
    soundEngine.playUiClick(620);
    setCharacter(next);
    saveCharacterConfig(next);
    engineRef.current?.updateCharacterConfig(next);
  };

  const handleUpdateNickname = (name: string) => {
    const next = { ...profile, nickname: name || 'Sobrevivente_17' };
    setProfile(next);
    saveProfile(next);
    engineRef.current?.setPlayerNickname(next.nickname);
  };

  const inGameplayHud =
    gameState === GameState.WAITING ||
    gameState === GameState.AIRPLANE ||
    gameState === GameState.DROPPING ||
    gameState === GameState.PARACHUTE ||
    gameState === GameState.PLAYING;

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black">
      {/* Nostalgic Bermuda Lobby Image behind transparent 3D character canvas */}
      {gameState === GameState.LOBBY && (
        <div className="fixed inset-0 z-0 flex items-center justify-center bg-black pointer-events-none">
          <div className="relative w-full h-full max-w-[177.78vh] max-h-[56.25vw] overflow-hidden">
            <img
              src="/assets/lobby_bg_clean.jpg"
              alt="Lobby Free Fire Bermuda"
              className="w-full h-full object-cover object-center"
            />
          </div>
        </div>
      )}

      {/* Isolated WebGL Canvas Mount (transparent in LOBBY so character stands on the beach path) */}
      <div
        ref={canvasMountRef}
        className="absolute inset-0 z-10 w-full h-full"
      />

      {/* 1. BOOT & 2. LOADING */}
      {(gameState === GameState.BOOT || gameState === GameState.LOADING) && (
        <BootAndLoadingScreen
          state={gameState}
          progress={loadProgress}
          statusText={loadText}
        />
      )}

      {/* 3. MENU */}
      {gameState === GameState.MENU && (
        <MainMenuScreen
          nickname={profile.nickname}
          muted={settings.muted}
          onToggleMute={handleToggleMute}
          onPlay={() => {
            soundEngine.playUiConfirm();
            engineRef.current?.stateMachine.transition(GameState.LOBBY);
          }}
          onOpenCharacter={() => {
            soundEngine.playUiClick();
            engineRef.current?.stateMachine.transition(GameState.LOBBY);
            setShowCharModal(true);
          }}
          onOpenSettings={() => {
            soundEngine.playUiClick();
            setShowSettingsModal(true);
          }}
          onOpenCredits={() => {
            soundEngine.playUiClick();
            setShowCreditsModal(true);
          }}
        />
      )}

      {/* 4. LOBBY */}
      {gameState === GameState.LOBBY && (
        <LobbyScreen
          profile={profile}
          character={character}
          matchMode={matchMode}
          onChangeMatchMode={(mode) => {
            setMatchMode(mode);
            engineRef.current?.setMatchMode(mode);
          }}
          muted={settings.muted}
          onToggleMute={handleToggleMute}
          onStartMatch={() => engineRef.current?.startMatchmaking()}
          onQuickTraining={() => engineRef.current?.startQuickTraining()}
          onOpenCharacter={() => {
            soundEngine.playUiClick();
            setShowCharModal(true);
          }}
          onOpenSettings={() => {
            soundEngine.playUiClick();
            setShowSettingsModal(true);
          }}
          onOpenCredits={() => {
            soundEngine.playUiClick();
            setShowCreditsModal(true);
          }}
          onBackToMenu={() => {
            soundEngine.playUiClick(480);
            engineRef.current?.stateMachine.transition(GameState.MENU);
          }}
        />
      )}

      {/* 5. MATCHMAKING */}
      {gameState === GameState.MATCHMAKING && (
        <MatchmakingOverlay
          playerCount={hud.matchmakingCount}
          matchMode={matchMode}
          onCancel={() => engineRef.current?.cancelMatchmaking()}
        />
      )}

      {/* 6. WAITING, 7. AIRPLANE, 8. DROPPING, 9. PARACHUTE, 10. PLAYING */}
      {inGameplayHud && engineRef.current && (
        <GameHud
          gameState={gameState}
          hud={hud}
          buildings={mapMeta.buildings}
          roads={mapMeta.roads}
          pois={mapMeta.pois}
          input={engineRef.current.input}
          controlMode={settings.controlMode}
          hudLayout={settings.hudLayout}
          showFps={settings.showFps}
          isPaused={isPaused}
          isBackpackOpen={isBackpackOpen}
          onTogglePause={() => {
            soundEngine.playUiClick();
            setIsBackpackOpen(false);
            setIsPaused((p) => !p);
          }}
          onToggleBackpack={() => {
            setIsBackpackOpen((b) => !b);
          }}
          onUseMedkit={() => engineRef.current?.useMedkit()}
          onOpenSettings={() => {
            soundEngine.playUiClick();
            setShowSettingsModal(true);
          }}
          onOpenHudEditor={() => {
            soundEngine.playUiClick();
            setShowHudEditor(true);
          }}
          onSelectScope={(sc) => engineRef.current?.setActiveWeaponScope(sc)}
          onSkipWaiting={() => engineRef.current?.skipWaitingToPlane()}
          onJumpFromPlane={() => engineRef.current?.jumpFromPlane()}
          onOpenParachute={() => engineRef.current?.openParachute()}
          onReturnLobby={() => {
            setIsPaused(false);
            setIsBackpackOpen(false);
            engineRef.current?.returnToLobby();
          }}
          onTestDamage={() => engineRef.current?.applyTestDamage(55)}
          onTestVictory={() => engineRef.current?.triggerVictory()}
        />
      )}

      {inGameplayHud && isBackpackOpen && !isPaused && engineRef.current && (
        <BackpackModal
          hud={hud}
          onClose={() => setIsBackpackOpen(false)}
          onUseMedkit={() => engineRef.current?.useMedkit()}
          onDropMedkit={() => engineRef.current?.dropMedkit()}
          onEquipItem={(id, slot) => engineRef.current?.equipBackpackItem(id, slot)}
          onDropItem={(id) => engineRef.current?.dropBackpackItem(id)}
          onUnequipAttachment={(slot, key) =>
            engineRef.current?.unequipWeaponAttachment(slot, key)
          }
          onUnequipScope={(slot) => engineRef.current?.unequipWeaponScope(slot)}
          onDropWeaponSlot={(slot) => engineRef.current?.dropWeaponSlot(slot)}
        />
      )}

      {/* 11. WIN & 12. GAMEOVER */}
      {(gameState === GameState.WIN || gameState === GameState.GAMEOVER) && (
        <EndMatchModal
          state={gameState}
          hud={hud}
          onPlayAgain={() => engineRef.current?.startMatchmaking()}
          onReturnLobby={() => engineRef.current?.returnToLobby()}
        />
      )}

      {/* MODALS */}
      {showCharModal && (
        <CharacterModal
          config={character}
          onChange={handleUpdateCharacter}
          onClose={() => {
            soundEngine.playUiClick();
            setShowCharModal(false);
          }}
        />
      )}

      {showSettingsModal && (
        <SettingsModal
          settings={settings}
          nickname={profile.nickname}
          onChangeNickname={handleUpdateNickname}
          onChangeSettings={handleUpdateSettings}
          onOpenHudEditor={() => {
            soundEngine.playUiClick();
            setShowSettingsModal(false);
            setShowHudEditor(true);
          }}
          onClose={() => {
            soundEngine.playUiClick();
            setShowSettingsModal(false);
          }}
        />
      )}

      {showHudEditor && (
        <HudEditorModal
          layout={settings.hudLayout}
          onSave={(nextLayout) => {
            soundEngine.playUiConfirm();
            handleUpdateSettings({ ...settings, hudLayout: nextLayout });
            setShowHudEditor(false);
          }}
          onClose={() => {
            soundEngine.playUiClick();
            setShowHudEditor(false);
          }}
        />
      )}

      {showCreditsModal && (
        <CreditsModal
          onClose={() => {
            soundEngine.playUiClick();
            setShowCreditsModal(false);
          }}
        />
      )}
    </div>
  );
}
