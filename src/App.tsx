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
  computeRankedPointDelta,
} from './game/types';
import { BootAndLoadingScreen } from './components/BootAndLoadingScreen';
import { MainMenuScreen } from './components/MainMenuScreen';
import { LobbyScreen } from './components/LobbyScreen';
import {
  ArsenalModal,
  CharacterModal,
  CreditsModal,
  SettingsModal,
} from './components/Modals';
import { MatchmakingOverlay } from './components/MatchmakingOverlay';
import { GameHud } from './components/GameHud';
import { EndMatchModal } from './components/EndMatchModal';
import { HudEditorModal } from './components/HudEditorModal';
import { BackpackModal } from './components/BackpackModal';
import { VendingShopModal } from './components/VendingShopModal';
import { RankModal } from './components/RankModal';

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
  ffCoins: 100,
  isRanked: false,
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
  nearbyLoots: [],
  nearbyVending: null,
  nearbyVehicle: null,
  inVehicle: null,
  vendingLocations: [],
  vehicleLocations: [],
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
  airDrops: [],
  airDropNotice: null,
};

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<BattleRoyaleEngine | null>(null);

  const [gameState, setGameState] = useState<GameState>(GameState.BOOT);
  const [loadProgress, setLoadProgress] = useState(0);
  const [loadText, setLoadText] = useState('Inicializando...');
  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const hudRef = useRef<HudSnapshot>(INITIAL_HUD);
  hudRef.current = hud;

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
  const [showArsenalModal, setShowArsenalModal] = useState(false);
  const [showRankModal, setShowRankModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showHudEditor, setShowHudEditor] = useState(false);
  const [showCreditsModal, setShowCreditsModal] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isBackpackOpen, setIsBackpackOpen] = useState(false);
  const [isShopOpen, setIsShopOpen] = useState(false);
  const [matchMode, setMatchMode] = useState<MatchMode>('solo');
  const [isRanked, setIsRanked] = useState(false);
  const [lastRankDelta, setLastRankDelta] = useState<number | null>(null);

  const prevBackpackOpenRef = useRef(false);

  // Release pointer lock when Backpack / Shop / Pause opens & handle keyboard shortcuts to close
  useEffect(() => {
    if (isBackpackOpen && !prevBackpackOpenRef.current) {
      soundEngine.playBackpackOpen();
    }
    prevBackpackOpenRef.current = isBackpackOpen;

    if (isBackpackOpen || isPaused || isShopOpen) {
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

    if (!isBackpackOpen && !isShopOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (isShopOpen && e.code === 'Escape') {
        e.preventDefault();
        setIsShopOpen(false);
        return;
      }
      if (isBackpackOpen && (e.code === 'Tab' || e.code === 'KeyB' || e.code === 'Escape')) {
        e.preventDefault();
        setIsBackpackOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isBackpackOpen, isPaused, isShopOpen, gameState]);

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
        setIsShopOpen(false);
        setIsPaused((p) => !p);
      },
      () => {
        setIsShopOpen(false);
        setIsBackpackOpen((b) => !b);
      },
      () => {
        setIsBackpackOpen(false);
        setIsShopOpen(true);
      },
    );
    engineRef.current = engine;
    engine.setPlayerNickname(profile.nickname);
    setMapMeta(engine.getMapMetadata());

    const unsub = engine.stateMachine.subscribe((next) => {
      setGameState(next);
      setIsPaused(false);
      setIsBackpackOpen(false);
      setIsShopOpen(false);

      if (next === GameState.LOBBY || next === GameState.MATCHMAKING) {
        setLastRankDelta(null);
      }

      if (next === GameState.WIN || next === GameState.GAMEOVER) {
        const snap = hudRef.current;
        const rankedActive = engine.getRankedMode();
        const isWin = next === GameState.WIN;
        const placement = isWin ? 1 : Math.max(2, snap.aliveCount);

        setProfile((prev) => {
          let delta = 0;
          if (rankedActive) {
            delta = computeRankedPointDelta({
              isWin,
              placement,
              kills: snap.kills,
              damageDealt: snap.damageDealt,
              currentPoints: prev.rankPoints,
            });
            setLastRankDelta(delta);
          } else {
            setLastRankDelta(null);
          }

          const updated: PlayerProfile = {
            ...prev,
            matchesPlayed: prev.matchesPlayed + 1,
            wins: isWin ? prev.wins + 1 : prev.wins,
            gold: prev.gold + (isWin ? 250 : 60),
            rankPoints: rankedActive ? Math.max(0, prev.rankPoints + delta) : prev.rankPoints,
            rankedMatches: rankedActive ? prev.rankedMatches + 1 : prev.rankedMatches,
            rankedWins: rankedActive && isWin ? prev.rankedWins + 1 : prev.rankedWins,
            totalKills: prev.totalKills + snap.kills,
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
      {/* Fullscreen Nostalgic Bermuda Lobby Backdrop behind transparent 3D character canvas */}
      {gameState === GameState.LOBBY && (
        <div className="fixed inset-0 z-0 pointer-events-none">
          <img
            src="/assets/lobby_bg_clean.jpg"
            alt="Lobby Free Fire Bermuda"
            className="w-full h-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-transparent to-black/45" />
        </div>
      )}

      {/* Isolated WebGL Canvas Mount */}
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
          isRanked={isRanked}
          onChangeMatchMode={(mode) => {
            setMatchMode(mode);
            engineRef.current?.setMatchMode(mode);
          }}
          onChangeRanked={(ranked) => {
            setIsRanked(ranked);
            engineRef.current?.setRankedMode(ranked);
          }}
          onChangeNickname={handleUpdateNickname}
          muted={settings.muted}
          onToggleMute={handleToggleMute}
          onStartMatch={() => engineRef.current?.startMatchmaking()}
          onQuickTraining={() => engineRef.current?.startQuickTraining()}
          onOpenCharacter={() => {
            soundEngine.playUiClick();
            setShowCharModal(true);
          }}
          onOpenArsenal={() => {
            soundEngine.playUiClick();
            setShowArsenalModal(true);
          }}
          onOpenRankModal={() => {
            soundEngine.playUiClick();
            setShowRankModal(true);
          }}
          onOpenSettings={() => {
            soundEngine.playUiClick();
            setShowSettingsModal(true);
          }}
          onOpenHudEditor={() => {
            soundEngine.playUiClick();
            setShowHudEditor(true);
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
            setIsShopOpen(false);
            setIsPaused((p) => !p);
          }}
          onToggleBackpack={() => {
            setIsShopOpen(false);
            setIsBackpackOpen((b) => !b);
          }}
          onUseMedkit={() => engineRef.current?.useMedkit()}
          onCollectLoot={(id) => engineRef.current?.collectLootById(id)}
          onOpenVending={() => engineRef.current?.openNearbyVending()}
          onToggleVehicle={() => engineRef.current?.toggleVehicle()}
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
            setIsShopOpen(false);
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
          onDropGloo={() => engineRef.current?.dropGloo()}
          onDropGrenade={() => engineRef.current?.dropGrenade()}
          onDropAmmo={(slot, amt) => engineRef.current?.dropAmmo(slot, amt)}
          onEquipItem={(id, slot) => engineRef.current?.equipBackpackItem(id, slot)}
          onDropItem={(id) => engineRef.current?.dropBackpackItem(id)}
          onUnequipAttachment={(slot, key) =>
            engineRef.current?.unequipWeaponAttachment(slot, key)
          }
          onDropEquippedAttachment={(slot, key) =>
            engineRef.current?.dropEquippedAttachment(slot, key)
          }
          onUnequipScope={(slot) => engineRef.current?.unequipWeaponScope(slot)}
          onDropEquippedScope={(slot) => engineRef.current?.dropEquippedScope(slot)}
          onTransferScope={(from, to) =>
            engineRef.current?.transferScopeBetweenSlots(from, to)
          }
          onTransferAttachment={(from, key, to) =>
            engineRef.current?.transferAttachmentBetweenSlots(from, key, to)
          }
          onDropWeaponSlot={(slot) => engineRef.current?.dropWeaponSlot(slot)}
          onSelectSlot={(slot) => engineRef.current?.selectWeaponSlot(slot)}
        />
      )}

      {inGameplayHud && isShopOpen && !isPaused && engineRef.current && (
        <VendingShopModal
          ffCoins={hud.ffCoins}
          teamMembers={hud.teamMembers}
          onBuyOffer={(offerId, reviveAllyId) =>
            engineRef.current?.buyVendingOffer(offerId, reviveAllyId) ?? false
          }
          onClose={() => setIsShopOpen(false)}
        />
      )}

      {/* 11. WIN & 12. GAMEOVER */}
      {(gameState === GameState.WIN || gameState === GameState.GAMEOVER) && (
        <EndMatchModal
          state={gameState}
          hud={hud}
          isRanked={isRanked || hud.isRanked}
          rankPoints={profile.rankPoints}
          rankDelta={lastRankDelta}
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

      {showArsenalModal && (
        <ArsenalModal
          onClose={() => {
            soundEngine.playUiClick();
            setShowArsenalModal(false);
          }}
        />
      )}

      {showRankModal && (
        <RankModal
          profile={profile}
          onClose={() => {
            soundEngine.playUiClick();
            setShowRankModal(false);
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
