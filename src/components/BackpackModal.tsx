import React, { useEffect, useRef, useState } from 'react';
import { Wrench, X } from 'lucide-react';
import {
  ATTACHMENT_LABELS,
  AttachmentSlotKey,
  HudSnapshot,
  SCOPE_META,
  WEAPONS,
  WeaponSlotId,
} from '../game/types';
import {
  IconAmmoSvg,
  IconBackpackSvg,
  IconDiscardDragSvg,
  IconFistSvg,
  IconGlooSvg,
  IconGrenadeSvg,
  IconHelmetSvg,
  IconScopeSvg,
  IconVestSvg,
} from './HudIcons';
import { WeaponIcon } from './WeaponIcon';

interface BackpackModalProps {
  hud: HudSnapshot;
  onClose: () => void;
  onUseMedkit: () => void;
  onDropMedkit: () => void;
  onUseSmallKit?: () => void;
  onDropSmallKit?: () => void;
  onDropGloo: () => void;
  onDropGrenade: () => void;
  onDropAmmo: (slot: 1 | 2 | 3, amount: number) => void;
  onEquipItem: (itemId: string, targetSlot: 1 | 2 | 3) => void;
  onDropItem: (itemId: string) => void;
  onUnequipAttachment: (slot: 1 | 2 | 3, key: AttachmentSlotKey) => void;
  onDropEquippedAttachment: (slot: 1 | 2 | 3, key: AttachmentSlotKey) => void;
  onUnequipScope: (slot: 1 | 2 | 3) => void;
  onDropEquippedScope: (slot: 1 | 2 | 3) => void;
  onTransferScope: (fromSlot: 1 | 2 | 3, toSlot: 1 | 2 | 3) => void;
  onTransferAttachment: (
    fromSlot: 1 | 2 | 3,
    key: AttachmentSlotKey,
    toSlot: 1 | 2 | 3,
  ) => void;
  onDropWeaponSlot: (slot: 1 | 2 | 3) => void;
  onSwapWeaponSlots: (slotA: 1 | 2 | 3, slotB: 1 | 2 | 3) => void;
  onSelectSlot: (slot: WeaponSlotId) => void;
}

type DragPayload =
  | { kind: 'weapon'; slot: 1 | 2 | 3; label: string }
  | { kind: 'equipped-scope'; slot: 1 | 2 | 3; label: string }
  | {
      kind: 'equipped-attachment';
      slot: 1 | 2 | 3;
      attKey: AttachmentSlotKey;
      label: string;
    }
  | { kind: 'backpack-item'; itemId: string; itemKind: string; label: string }
  | { kind: 'medkit'; label: string }
  | { kind: 'smallkit'; label: string }
  | { kind: 'gloo'; label: string }
  | { kind: 'grenade'; label: string }
  | { kind: 'ammo'; slot: 1 | 2 | 3; amount: number; label: string };

type DropZoneId = 'discard' | 'slot-1' | 'slot-2' | 'slot-3' | null;

const ATT_SLOT_LABELS: { key: AttachmentSlotKey; title: string }[] = [
  { key: 'muzzle', title: 'Boca' },
  { key: 'foregrip', title: 'Emp.' },
  { key: 'magazine', title: 'Carg.' },
  { key: 'stock', title: 'Cor.' },
];

function findDropZoneAt(x: number, y: number): DropZoneId {
  const els = document.elementsFromPoint(x, y);
  for (let i = 0; i < els.length; i++) {
    const zone = (els[i] as HTMLElement).dataset?.dropZone;
    if (
      zone === 'discard' ||
      zone === 'slot-1' ||
      zone === 'slot-2' ||
      zone === 'slot-3'
    ) {
      return zone;
    }
  }
  return null;
}

export const BackpackModal: React.FC<BackpackModalProps> = ({
  hud,
  onClose,
  onUseMedkit,
  onDropMedkit,
  onUseSmallKit,
  onDropSmallKit,
  onDropGloo,
  onDropGrenade,
  onDropAmmo,
  onEquipItem,
  onDropItem,
  onUnequipAttachment,
  onDropEquippedAttachment,
  onUnequipScope,
  onDropEquippedScope,
  onTransferScope,
  onTransferAttachment,
  onDropWeaponSlot,
  onSwapWeaponSlots,
  onSelectSlot,
}) => {
  const defaultTargetSlot: 1 | 2 | 3 =
    hud.activeSlot === 4
      ? hud.weapons[1]
        ? 1
        : hud.weapons[2]
          ? 2
          : 3
      : hud.activeSlot;
  const [selectedWeaponSlot, setSelectedWeaponSlot] =
    useState<1 | 2 | 3>(defaultTargetSlot);
  const [activeDrag, setActiveDrag] = useState<{
    payload: DragPayload;
    x: number;
    y: number;
  } | null>(null);
  const [hoverZone, setHoverZone] = useState<DropZoneId>(null);

  const slot1Ref = useRef<HTMLDivElement | null>(null);
  const slot2Ref = useRef<HTMLDivElement | null>(null);
  const slot3Ref = useRef<HTMLDivElement | null>(null);
  const discardRef = useRef<HTMLDivElement | null>(null);

  const dragSessionRef = useRef<{
    payload: DragPayload;
    startX: number;
    startY: number;
    lastX: number;
    lastY: number;
    dragging: boolean;
  } | null>(null);
  const suppressClickUntilRef = useRef(0);
  const handlersRef = useRef({
    onDropMedkit,
    onDropSmallKit,
    onDropGloo,
    onDropGrenade,
    onDropAmmo,
    onEquipItem,
    onDropItem,
    onDropEquippedAttachment,
    onDropEquippedScope,
    onTransferScope,
    onTransferAttachment,
    onDropWeaponSlot,
    onSwapWeaponSlots,
  });
  handlersRef.current = {
    onDropMedkit,
    onDropSmallKit,
    onDropGloo,
    onDropGrenade,
    onDropAmmo,
    onEquipItem,
    onDropItem,
    onDropEquippedAttachment,
    onDropEquippedScope,
    onTransferScope,
    onTransferAttachment,
    onDropWeaponSlot,
    onSwapWeaponSlots,
  };

  const resolveDropZone = (x: number, y: number): DropZoneId => {
    const inside = (el: HTMLElement | null) => {
      if (!el) return false;
      const r = el.getBoundingClientRect();
      return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
    };
    if (inside(slot1Ref.current)) return 'slot-1';
    if (inside(slot2Ref.current)) return 'slot-2';
    if (inside(slot3Ref.current)) return 'slot-3';
    if (inside(discardRef.current)) return 'discard';
    return findDropZoneAt(x, y);
  };

  useEffect(() => {
    const onPointerMove = (e: PointerEvent) => {
      const sess = dragSessionRef.current;
      if (!sess) return;
      if (e.clientX !== 0 || e.clientY !== 0) {
        sess.lastX = e.clientX;
        sess.lastY = e.clientY;
      }
      if (!sess.dragging) {
        if (Math.hypot(sess.lastX - sess.startX, sess.lastY - sess.startY) < 4) {
          return;
        }
        sess.dragging = true;
      }
      setActiveDrag({ payload: sess.payload, x: sess.lastX, y: sess.lastY });
      setHoverZone(resolveDropZone(sess.lastX, sess.lastY));
    };

    const finishDrag = (e: PointerEvent) => {
      const sess = dragSessionRef.current;
      dragSessionRef.current = null;
      if (!sess) return;

      const endX = e.clientX !== 0 || e.clientY !== 0 ? e.clientX : sess.lastX;
      const endY = e.clientX !== 0 || e.clientY !== 0 ? e.clientY : sess.lastY;

      if (sess.dragging) {
        suppressClickUntilRef.current = performance.now() + 200;
        const zone = resolveDropZone(endX, endY);
        const h = handlersRef.current;
        const p = sess.payload;

        if (zone === 'discard') {
          if (p.kind === 'weapon') h.onDropWeaponSlot(p.slot);
          else if (p.kind === 'equipped-scope') h.onDropEquippedScope(p.slot);
          else if (p.kind === 'equipped-attachment')
            h.onDropEquippedAttachment(p.slot, p.attKey);
          else if (p.kind === 'backpack-item') h.onDropItem(p.itemId);
          else if (p.kind === 'medkit') h.onDropMedkit();
          else if (p.kind === 'smallkit') h.onDropSmallKit?.();
          else if (p.kind === 'gloo') h.onDropGloo();
          else if (p.kind === 'grenade') h.onDropGrenade();
          else if (p.kind === 'ammo') h.onDropAmmo(p.slot, p.amount);
        } else if (
          zone === 'slot-1' ||
          zone === 'slot-2' ||
          zone === 'slot-3'
        ) {
          const targetSlot = Number(zone.slice(-1)) as 1 | 2 | 3;
          if (p.kind === 'weapon') {
            if (targetSlot !== 3 && p.slot !== 3 && p.slot !== targetSlot) {
              h.onSwapWeaponSlots(p.slot, targetSlot);
            }
          } else if (p.kind === 'backpack-item') {
            h.onEquipItem(p.itemId, targetSlot);
          } else if (p.kind === 'equipped-scope') {
            h.onTransferScope(p.slot, targetSlot);
          } else if (p.kind === 'equipped-attachment') {
            h.onTransferAttachment(p.slot, p.attKey, targetSlot);
          }
        }
      }

      setActiveDrag(null);
      setHoverZone(null);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', finishDrag);
    window.addEventListener('pointercancel', finishDrag);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', finishDrag);
      window.removeEventListener('pointercancel', finishDrag);
    };
  }, []);

  const beginDrag = (e: React.PointerEvent, payload: DragPayload) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.stopPropagation();
    e.preventDefault();
    dragSessionRef.current = {
      payload,
      startX: e.clientX,
      startY: e.clientY,
      lastX: e.clientX,
      lastY: e.clientY,
      dragging: false,
    };
  };

  const canClickNow = () => performance.now() > suppressClickUntilRef.current;

  const isDraggingForSlot =
    activeDrag &&
    (activeDrag.payload.kind === 'weapon' ||
      activeDrag.payload.kind === 'backpack-item' ||
      activeDrag.payload.kind === 'equipped-scope' ||
      activeDrag.payload.kind === 'equipped-attachment');

  const slot1 = hud.weapons[1];
  const slot2 = hud.weapons[2];
  const slot3 = hud.weapons[3];

  const ammoEntries = ([1, 2, 3] as const)
    .map((slot) => {
      const w = hud.weapons[slot];
      if (!w || w.reserveAmmo <= 0) return null;
      const def = WEAPONS[w.weaponId];
      const dropChunk =
        w.weaponId === 'awm' ? 10 : w.weaponId === 'm1014' ? 12 : 30;
      const ammoTitle =
        def.category === 'SR'
          ? 'munição de AWM'
          : def.category === 'SG'
            ? 'munição de SG'
            : def.category === 'HG'
              ? 'munição de HG'
              : def.category === 'SMG'
                ? 'munição de SMG'
                : 'munição de AR';
      const ammoIcon =
        def.category === 'SR'
          ? '/icons/rifle.png'
          : def.category === 'SG'
            ? '/icons/doze.png'
            : def.category === 'SMG'
              ? '/icons/smg.png'
              : def.category === 'AR'
                ? '/icons/ar.png'
                : undefined;
      return {
        slot,
        weaponId: w.weaponId,
        label: ammoTitle,
        ammoIcon,
        total: w.reserveAmmo,
        dropChunk,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  return (
    <div
      className="fixed inset-0 z-50 flex select-none pointer-events-auto bg-black/20 text-white"
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* LEFT ~69%: CLASSIC 3-COLUMN FREE FIRE BACKPACK PANEL (MATCHES 2SS.JPG) */}
      <div className="relative w-[70%] sm:w-[68%] lg:w-[66%] h-[92%] my-auto ml-2 sm:ml-4 bg-black/80 border border-white/55 shadow-2xl grid grid-cols-12 overflow-hidden">
        {/* COL 1: EQUIPAMENTO */}
        <div className="col-span-3 sm:col-span-2 border-r border-white/25 flex flex-col p-1.5 sm:p-2 overflow-y-auto">
          <div className="text-center text-[9px] sm:text-[11px] font-sans font-semibold tracking-wider text-white/80 pb-1.5 border-b border-white/15">
            EQUIPAMENTO
          </div>

          <div className="flex-1 flex flex-col justify-between gap-1.5 pt-2 text-center">
            {/* Colete */}
            <div className="flex flex-col items-center bg-black/40 border border-white/15 p-1.5 relative">
              {hud.vestLevel > 0 && (
                <span className="self-start text-[9px] font-mono font-bold text-white/90 leading-none">
                  {hud.vestHp}
                </span>
              )}
              <IconVestSvg
                className={`w-8 h-8 my-0.5 ${
                  hud.vestLevel > 0 ? 'text-sky-300' : 'text-white/20'
                }`}
              />
              <span className="text-[8px] sm:text-[9px] leading-tight text-white/85">
                {hud.vestLevel > 0
                  ? `Colete Nv.${hud.vestLevel}`
                  : 'Sem Colete'}
              </span>
            </div>

            {/* Capacete */}
            <div className="flex flex-col items-center bg-black/40 border border-white/15 p-1.5 relative">
              {hud.helmetLevel > 0 && (
                <span className="self-start text-[9px] font-mono font-bold text-white/90 leading-none">
                  {hud.helmetHp}
                </span>
              )}
              <IconHelmetSvg
                className={`w-8 h-8 my-0.5 ${
                  hud.helmetLevel > 0 ? 'text-amber-300' : 'text-white/20'
                }`}
              />
              <span className="text-[8px] sm:text-[9px] leading-tight text-white/85">
                {hud.helmetLevel > 0
                  ? `Capacete Nív.${hud.helmetLevel}`
                  : 'Sem Capacete'}
              </span>
            </div>

            {/* Mochila */}
            <div className="flex flex-col items-center bg-black/40 border border-white/15 p-1.5 relative">
              <span className="self-start text-[9px] font-mono font-bold text-white/90 leading-none">
                {hud.backpackCapacity}
              </span>
              <img
                src={`/icons/mochila-nv${hud.backpackLevel}.png`}
                alt={`Mochila Nível ${hud.backpackLevel}`}
                className="w-8 h-8 my-0.5 object-contain drop-shadow"
              />
              <span className="text-[8px] sm:text-[9px] leading-tight text-white/85">
                Mochila Lv{hud.backpackLevel}
              </span>
            </div>

            {/* Cobertura (Gelo + Granada, arrastáveis para descartar) */}
            <div className="grid grid-cols-2 gap-1">
              <div
                onPointerDown={(e) =>
                  hud.glooCount > 0 &&
                  beginDrag(e, { kind: 'gloo', label: 'Parede de Gelo' })
                }
                className={`touch-none select-none flex flex-col items-center justify-center bg-black/45 border p-1 ${
                  hud.glooCount > 0
                    ? 'border-cyan-400/50 cursor-grab active:cursor-grabbing hover:bg-cyan-950/35'
                    : 'border-white/15 opacity-45'
                }`}
                title="Arraste para a direita para descartar"
              >
                <IconGlooSvg className="w-5 h-5 text-cyan-300" />
                <span className="text-[8px] font-mono font-bold">
                  {hud.glooCount}
                </span>
              </div>
              <div
                onPointerDown={(e) =>
                  hud.grenadeCount > 0 &&
                  beginDrag(e, { kind: 'grenade', label: 'Granada' })
                }
                className={`touch-none select-none flex flex-col items-center justify-center bg-black/45 border p-1 ${
                  hud.grenadeCount > 0
                    ? 'border-red-400/50 cursor-grab active:cursor-grabbing hover:bg-red-950/35'
                    : 'border-white/15 opacity-45'
                }`}
                title="Arraste para a direita para descartar"
              >
                <IconGrenadeSvg className="w-5 h-5 text-red-400" />
                <span className="text-[8px] font-mono font-bold">
                  {hud.grenadeCount}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* COL 2: ARMAS (Slots 1, 2 + Sidearm + Melee) */}
        <div className="col-span-5 border-r border-white/25 flex flex-col p-1.5 sm:p-2.5 overflow-y-auto">
          <div className="text-center text-[9px] sm:text-[11px] font-sans font-semibold tracking-wider text-white/80 pb-1.5 border-b border-white/15">
            ARMAS
          </div>

          <div className="flex-1 flex flex-col justify-between gap-2 pt-2">
            {/* Primary Slots 1 & 2 */}
            {([1, 2] as const).map((slot) => {
              const w = slot === 1 ? slot1 : slot2;
              const def = w ? WEAPONS[w.weaponId] : null;
              const isSelected = selectedWeaponSlot === slot;
              const isDropHighlight =
                isDraggingForSlot && hoverZone === `slot-${slot}`;
              const slotRef = slot === 1 ? slot1Ref : slot2Ref;

              if (!w || !def) {
                return (
                  <div
                    key={slot}
                    ref={slotRef}
                    data-drop-zone={`slot-${slot}`}
                    onClick={() => canClickNow() && setSelectedWeaponSlot(slot)}
                    className={`flex-1 min-h-[104px] border flex flex-col items-center justify-center p-2 text-center cursor-pointer transition-colors ${
                      isDropHighlight
                        ? 'border-amber-300 bg-amber-500/20'
                        : isSelected
                          ? 'border-white/55 bg-white/5'
                          : 'border-white/20 bg-black/30'
                    }`}
                  >
                    <WeaponIcon
                      weaponId={slot === 1 ? 'm4a1' : 'awm'}
                      silhouette
                      className="w-24 h-8 opacity-20 mb-1"
                    />
                    <span className="text-[9px] font-mono text-white/40">
                      SLOT {slot} · VAZIO
                    </span>
                  </div>
                );
              }

              return (
                <div
                  key={slot}
                  ref={slotRef}
                  data-drop-zone={`slot-${slot}`}
                  onPointerDown={(e) =>
                    beginDrag(e, { kind: 'weapon', slot, label: def.name })
                  }
                  onClick={() => canClickNow() && setSelectedWeaponSlot(slot)}
                  className={`touch-none select-none flex-1 flex flex-col justify-between p-1.5 sm:p-2 border transition-colors cursor-grab active:cursor-grabbing ${
                    isDropHighlight
                      ? 'border-emerald-400 bg-emerald-500/20 ring-1 ring-emerald-300'
                      : isSelected
                        ? 'border-amber-400/90 bg-white/[0.08]'
                        : 'border-white/25 bg-black/35 hover:border-white/45'
                  }`}
                >
                  {/* Top row: Ammo count left + Scope Box right */}
                  <div className="flex items-start justify-between gap-1">
                    <div className="leading-none">
                      <div className="text-[11px] sm:text-xs font-mono font-bold text-white tabular-nums">
                        {w.ammoInMag} / {w.reserveAmmo}
                      </div>
                      <div className="text-[8px] font-mono text-amber-300/90 mt-0.5">
                        {def.shortName}
                      </div>
                    </div>

                    {/* Draggable Scope Slot */}
                    <button
                      type="button"
                      onPointerDown={(e) => {
                        if (def.allowsCustomScope && w.scope !== 'none') {
                          beginDrag(e, {
                            kind: 'equipped-scope',
                            slot,
                            label: SCOPE_META[w.scope].label,
                          });
                        }
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!canClickNow()) return;
                        if (def.allowsCustomScope && w.scope !== 'none') {
                          onUnequipScope(slot);
                        }
                      }}
                      disabled={!def.allowsCustomScope || w.scope === 'none'}
                      className={`touch-none select-none w-10 h-8 border flex flex-col items-center justify-center leading-none transition-colors ${
                        w.scope !== 'none'
                          ? 'bg-emerald-950/75 border-emerald-400/80 text-emerald-200 cursor-grab active:cursor-grabbing hover:bg-emerald-900/75'
                          : 'bg-black/45 border-white/25 text-white/35 cursor-default'
                      }`}
                      title={
                        def.allowsCustomScope && w.scope !== 'none'
                          ? 'Arraste para outra arma/descartar ou clique para guardar na mochila'
                          : 'Slot de Mira'
                      }
                    >
                      <IconScopeSvg className="w-3.5 h-3.5" />
                      <span className="text-[7px] font-mono font-bold">
                        {w.scope !== 'none' ? SCOPE_META[w.scope].short : 'MIRA'}
                      </span>
                    </button>
                  </div>

                  {/* Center Draggable Weapon Silhouette */}
                  <div
                    className="my-1 flex items-center justify-center py-0.5 hover:scale-[1.02] transition-transform"
                    title="Arraste para outro slot para trocar ou para a direita para dropar"
                  >
                    <WeaponIcon
                      weaponId={w.weaponId}
                      className="w-[92%] h-10 sm:h-12 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]"
                    />
                  </div>

                  {/* 4 Attachment Slots Row */}
                  <div className="grid grid-cols-4 gap-1">
                    {ATT_SLOT_LABELS.map(({ key, title }) => {
                      const att = w.attachments[key];
                      const allowed = def.allowsAttachments;
                      return (
                        <button
                          key={key}
                          type="button"
                          disabled={!allowed || !att}
                          onPointerDown={(e) => {
                            if (allowed && att) {
                              beginDrag(e, {
                                kind: 'equipped-attachment',
                                slot,
                                attKey: key,
                                label: ATTACHMENT_LABELS[att].name,
                              });
                            }
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!canClickNow()) return;
                            if (allowed && att) {
                              onUnequipAttachment(slot, key);
                            }
                          }}
                          className={`touch-none select-none h-8 border flex flex-col items-center justify-center px-0.5 leading-none transition-colors ${
                            !allowed
                              ? 'bg-black/25 border-white/10 text-white/20 cursor-default'
                              : att
                                ? 'bg-sky-950/75 border-sky-400/80 text-sky-200 cursor-grab active:cursor-grabbing hover:bg-sky-900/75'
                                : 'bg-black/45 border-white/25 text-white/40 cursor-default'
                          }`}
                          title={
                            att
                              ? `${ATTACHMENT_LABELS[att].name} — arraste para outra arma/descartar ou clique para guardar`
                              : title
                          }
                        >
                          <Wrench className="w-2.5 h-2.5 opacity-80" />
                          <span className="text-[7px] font-mono font-bold truncate max-w-full mt-0.5">
                            {att ? ATTACHMENT_LABELS[att].short : title}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* Bottom Row: Sidearm (Slot 3) | Melee (Slot 4 Punho) */}
            <div className="grid grid-cols-2 gap-1.5 pt-1 border-t border-white/15">
              {/* Sidearm */}
              <div
                ref={slot3Ref}
                data-drop-zone="slot-3"
                onClick={() => {
                  if (!canClickNow()) return;
                  setSelectedWeaponSlot(3);
                  if (slot3) onSelectSlot(3);
                }}
                onPointerDown={(e) => {
                  if (slot3) {
                    beginDrag(e, {
                      kind: 'weapon',
                      slot: 3,
                      label: WEAPONS[slot3.weaponId].name,
                    });
                  }
                }}
                className={`touch-none select-none h-16 border flex flex-col items-center justify-between p-1.5 transition-colors ${
                  slot3
                    ? 'cursor-grab active:cursor-grabbing'
                    : 'cursor-default opacity-45'
                } ${
                  hud.activeSlot === 3
                    ? 'border-amber-400 bg-white/10'
                    : 'border-white/25 bg-black/40'
                }`}
                title={
                  slot3
                    ? `${WEAPONS[slot3.weaponId].name} (Arraste para a direita para dropar)`
                    : 'Sem Pistola'
                }
              >
                {slot3 ? (
                  <>
                    <span className="self-start text-[8px] font-mono text-white/85 leading-none">
                      {slot3.ammoInMag}/{slot3.reserveAmmo}
                    </span>
                    <WeaponIcon
                      weaponId={slot3.weaponId}
                      className="w-14 h-7"
                    />
                  </>
                ) : (
                  <WeaponIcon
                    weaponId="g18"
                    silhouette
                    className="w-11 h-6 opacity-30 mt-2"
                  />
                )}
                <span className="text-[8px] text-white/75 leading-none">
                  Sidearm
                </span>
              </div>

              {/* Melee (Punho / Soco) */}
              <button
                type="button"
                onClick={() => {
                  if (!canClickNow()) return;
                  onSelectSlot(4);
                }}
                className={`h-16 border flex flex-col items-center justify-between p-1.5 cursor-pointer transition-colors ${
                  hud.activeSlot === 4
                    ? 'border-amber-400 bg-white/15'
                    : 'border-white/25 bg-black/40 hover:bg-white/10'
                }`}
                title="Equipar Soco / Punho (Slot 4)"
              >
                <span className="self-start text-[9px] font-mono text-white/75 leading-none">
                  ∞
                </span>
                <IconFistSvg className="w-7 h-7 text-white/95" />
                <span className="text-[8px] text-white/80 leading-none">
                  Melee
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* COL 3: CAPACIDADE X / Y (2-column grid of Ammo, Medkits, Gloos, Scopes & Attachments) */}
        <div className="col-span-4 sm:col-span-5 flex flex-col p-1.5 sm:p-2.5 overflow-hidden">
          <div className="flex items-center justify-between text-[9px] sm:text-[11px] font-sans font-semibold tracking-wider text-white/85 pb-1.5 border-b border-white/15">
            <span>CAPACIDADE</span>
            <span className="font-mono font-bold text-white tabular-nums">
              {hud.backpackUsed} / {hud.backpackCapacity}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto overscroll-contain touch-pan-y pt-2 pr-0.5">
            <div className="grid grid-cols-2 gap-2">
              {/* Kit Médico Grande */}
              {hud.medkitCount > 0 && (
                <div
                  onPointerDown={(e) =>
                    beginDrag(e, { kind: 'medkit', label: 'Kit Médico' })
                  }
                  onClick={() => {
                    if (!canClickNow()) return;
                    if (hud.hp < hud.maxHp) {
                      onUseMedkit();
                      onClose();
                    }
                  }}
                  className="touch-none select-none bg-black/55 hover:bg-white/10 border border-white/30 p-2 flex flex-col justify-between min-h-[90px] cursor-grab active:cursor-grabbing shadow"
                  title="Clique para usar ou arraste até a direita para dropar"
                >
                  <div className="text-[10px] font-bold text-white/95 leading-tight line-clamp-2">
                    Kit Médico (+75 HP)
                  </div>
                  <div className="flex items-end justify-between mt-1.5">
                    <span className="text-xs font-mono font-black text-white tabular-nums leading-none">
                      {hud.medkitCount}
                    </span>
                    <img
                      src="/icons/kit-grande.png"
                      alt="Kit Médico"
                      draggable={false}
                      className="w-10 h-10 object-contain drop-shadow pointer-events-none select-none"
                    />
                  </div>
                </div>
              )}

              {/* Kit Pequeno */}
              {hud.smallkitCount > 0 && (
                <div
                  onPointerDown={(e) =>
                    beginDrag(e, { kind: 'smallkit', label: 'Kit Pequeno' })
                  }
                  onClick={() => {
                    if (!canClickNow()) return;
                    if (hud.hp < hud.maxHp) {
                      onUseSmallKit?.();
                      onClose();
                    }
                  }}
                  className="touch-none select-none bg-black/55 hover:bg-white/10 border border-emerald-400/40 p-2 flex flex-col justify-between min-h-[90px] cursor-grab active:cursor-grabbing shadow"
                  title="Cura rápida +35 HP · Clique para usar ou arraste para dropar"
                >
                  <div className="text-[10px] font-bold text-emerald-200 leading-tight line-clamp-2">
                    Kit Pequeno (+35 HP)
                  </div>
                  <div className="flex items-end justify-between mt-1.5">
                    <span className="text-xs font-mono font-black text-white tabular-nums leading-none">
                      {hud.smallkitCount}
                    </span>
                    <img
                      src="/icons/kit.png"
                      alt="Kit Pequeno"
                      draggable={false}
                      className="w-9 h-9 object-contain drop-shadow pointer-events-none select-none"
                    />
                  </div>
                </div>
              )}

              {/* Parede de Gelo */}
              {hud.glooCount > 0 && (
                <div
                  onPointerDown={(e) =>
                    beginDrag(e, { kind: 'gloo', label: 'Parede de Gelo' })
                  }
                  className="touch-none select-none bg-black/55 hover:bg-white/10 border border-white/30 p-2 flex flex-col justify-between min-h-[90px] cursor-grab active:cursor-grabbing shadow"
                  title="Arraste até a direita para dropar"
                >
                  <div className="text-[10px] font-bold text-white/95 leading-tight">
                    Parede de Gelo
                  </div>
                  <div className="flex items-end justify-between mt-1.5">
                    <span className="text-xs font-mono font-black text-white tabular-nums leading-none">
                      {hud.glooCount}
                    </span>
                    <IconGlooSvg className="w-9 h-9 text-cyan-300 pointer-events-none select-none" />
                  </div>
                </div>
              )}

              {/* Granada */}
              {hud.grenadeCount > 0 && (
                <div
                  onPointerDown={(e) =>
                    beginDrag(e, { kind: 'grenade', label: 'Granada' })
                  }
                  className="touch-none select-none bg-black/55 hover:bg-white/10 border border-white/30 p-2 flex flex-col justify-between min-h-[90px] cursor-grab active:cursor-grabbing shadow"
                  title="Arraste até a direita para dropar"
                >
                  <div className="text-[10px] font-bold text-white/95 leading-tight">
                    Granada Explosiva
                  </div>
                  <div className="flex items-end justify-between mt-1.5">
                    <span className="text-xs font-mono font-black text-white tabular-nums leading-none">
                      {hud.grenadeCount}
                    </span>
                    <IconGrenadeSvg className="w-9 h-9 text-red-400 pointer-events-none select-none" />
                  </div>
                </div>
              )}

              {/* Reserve Ammo Stacks per equipped firearm */}
              {ammoEntries.map((ae) => (
                <div
                  key={`ammo_${ae.slot}`}
                  onPointerDown={(e) =>
                    beginDrag(e, {
                      kind: 'ammo',
                      slot: ae.slot,
                      amount: ae.dropChunk,
                      label: ae.label,
                    })
                  }
                  className="touch-none select-none bg-black/55 hover:bg-white/10 border border-white/30 p-2 flex flex-col justify-between min-h-[90px] cursor-grab active:cursor-grabbing shadow"
                  title={`Arraste até a direita para dropar ${ae.dropChunk} balas`}
                >
                  <div className="text-[10px] font-bold text-white/95 leading-tight">
                    {ae.label}
                  </div>
                  <div className="flex items-end justify-between mt-1.5">
                    <span className="text-xs font-mono font-black text-white tabular-nums leading-none">
                      {ae.total}
                    </span>
                    {ae.ammoIcon ? (
                      <img
                        src={ae.ammoIcon}
                        alt={ae.label}
                        draggable={false}
                        className="w-9 h-9 object-contain drop-shadow pointer-events-none select-none"
                      />
                    ) : (
                      <IconAmmoSvg className="w-10 h-8 pointer-events-none select-none" />
                    )}
                  </div>
                </div>
              ))}

              {/* Stored Scopes & Attachments (drag onto Weapon Slot 1/2 to equip, or Discard right) */}
              {hud.backpackItems.map((item) => {
                const targetWeapon = hud.weapons[selectedWeaponSlot];
                const targetDef = targetWeapon
                  ? WEAPONS[targetWeapon.weaponId]
                  : null;
                const canQuickEquip =
                  (item.kind === 'scope' &&
                    Boolean(targetDef?.allowsCustomScope)) ||
                  (item.kind === 'attachment' &&
                    Boolean(targetDef?.allowsAttachments));

                return (
                  <div
                    key={item.id}
                    onPointerDown={(e) =>
                      beginDrag(e, {
                        kind: 'backpack-item',
                        itemId: item.id,
                        itemKind: item.kind,
                        label: item.label,
                      })
                    }
                    onClick={() => {
                      if (!canClickNow()) return;
                      if (canQuickEquip) {
                        onEquipItem(item.id, selectedWeaponSlot);
                      }
                    }}
                    className="touch-none select-none bg-black/55 hover:bg-amber-500/15 border border-amber-400/50 p-2 flex flex-col justify-between min-h-[90px] cursor-grab active:cursor-grabbing shadow"
                    title="Arraste para uma Arma (equipar) ou para a Direita (descartar). Clique para equipar rápido."
                  >
                    <div className="text-[10px] font-bold text-amber-200 leading-tight line-clamp-2">
                      {item.label}
                    </div>
                    <div className="flex items-end justify-between mt-1.5">
                      <span className="text-xs font-mono font-black text-white tabular-nums leading-none">
                        {item.quantity}
                      </span>
                      {item.kind === 'scope' ? (
                        item.scopeType === '2x' ? (
                          <img src="/icons/mira-2x.png" alt="Mira 2x" draggable={false} className="w-8 h-8 object-contain pointer-events-none select-none" />
                        ) : item.scopeType === '4x' ? (
                          <img src="/icons/mira-4x.png" alt="Mira 4x" draggable={false} className="w-8 h-8 object-contain pointer-events-none select-none" />
                        ) : (
                          <IconScopeSvg className="w-8 h-8 text-emerald-300 pointer-events-none select-none" />
                        )
                      ) : (
                        <Wrench className="w-7 h-7 text-sky-300 pointer-events-none select-none" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT ~30%: OPEN 3D VIEW + DISCARD DROP ZONE + ORANGE X CLOSE BUTTON (MATCHES 2SS.JPG) */}
      <div
        ref={discardRef}
        data-drop-zone="discard"
        onClick={(e) => {
          if (e.target === e.currentTarget && canClickNow() && !activeDrag) {
            onClose();
          }
        }}
        className={`relative flex-1 h-[92%] my-auto mr-2 sm:mr-4 flex flex-col justify-end items-center transition-colors ${
          activeDrag
            ? hoverZone === 'discard'
              ? 'bg-red-700/35 border-2 border-dashed border-red-400'
              : 'bg-black/25 border-2 border-dashed border-white/45'
            : ''
        }`}
      >
        {/* Centered Bottom-Right Triangular Discard Prompt */}
        <div className="pointer-events-none mb-20 sm:mb-24 flex flex-col items-center gap-2 text-center px-3">
          <IconDiscardDragSvg
            className={`w-10 h-10 drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)] ${
              hoverZone === 'discard' ? 'text-red-300 scale-110' : 'text-white'
            } transition-transform`}
          />
          <span
            className={`text-xs sm:text-sm font-sans font-medium ${
              hoverZone === 'discard' ? 'text-red-200 font-bold' : 'text-white/95'
            }`}
            style={{ textShadow: '0 1px 4px rgba(0,0,0,0.95)' }}
          >
            {hoverZone === 'discard'
              ? 'Solte para descartar no chão!'
              : 'Arraste até aqui para descartar'}
          </span>
        </div>

        {/* Bottom-left Orange Close Button [X] matching screenshot */}
        <button
          type="button"
          onClick={onClose}
          className="absolute bottom-0 left-0 w-12 h-10 bg-[#d84a20] hover:bg-[#eb5b30] border border-white/40 flex items-center justify-center text-white shadow-lg cursor-pointer"
          title="Fechar Mochila (TAB / B / ESC)"
        >
          <X className="w-6 h-6 stroke-[2.5]" />
        </button>
      </div>

      {/* Floating Drag Ghost */}
      {activeDrag && (
        <div
          className="pointer-events-none fixed z-[80] -translate-x-1/2 -translate-y-1/2 px-3 py-1.5 bg-black/90 border-2 border-amber-400 text-xs font-bold text-white shadow-2xl whitespace-nowrap"
          style={{ left: activeDrag.x, top: activeDrag.y }}
        >
          {activeDrag.payload.label}
        </div>
      )}
    </div>
  );
};
