import React, { useState } from 'react';
import { Backpack, Shield, Heart, Trash2, X, Wrench } from 'lucide-react';
import {
  ATTACHMENT_LABELS,
  AttachmentSlotKey,
  HudSnapshot,
  SCOPE_META,
  WEAPONS,
} from '../game/types';
import { WeaponIcon } from './WeaponIcon';

interface BackpackModalProps {
  hud: HudSnapshot;
  onClose: () => void;
  onUseMedkit: () => void;
  onDropMedkit: () => void;
  onEquipItem: (itemId: string, targetSlot: 1 | 2 | 3) => void;
  onDropItem: (itemId: string) => void;
  onUnequipAttachment: (slot: 1 | 2 | 3, key: AttachmentSlotKey) => void;
  onUnequipScope: (slot: 1 | 2 | 3) => void;
  onDropWeaponSlot: (slot: 1 | 2 | 3) => void;
}

const ATT_SLOT_LABELS: { key: AttachmentSlotKey; title: string }[] = [
  { key: 'muzzle', title: 'Boca' },
  { key: 'foregrip', title: 'Empunh.' },
  { key: 'magazine', title: 'Carreg.' },
  { key: 'stock', title: 'Coronha' },
];

export const BackpackModal: React.FC<BackpackModalProps> = ({
  hud,
  onClose,
  onUseMedkit,
  onDropMedkit,
  onEquipItem,
  onDropItem,
  onUnequipAttachment,
  onUnequipScope,
  onDropWeaponSlot,
}) => {
  const [selectedWeaponSlot, setSelectedWeaponSlot] = useState<1 | 2 | 3>(hud.activeSlot);
  const occupiedCount = ([1, 2, 3] as const).filter((s) => hud.weapons[s] !== null).length;
  const capPct = Math.min(100, Math.round((hud.backpackUsed / Math.max(1, hud.backpackCapacity)) * 100));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/78 p-3 sm:p-6 pointer-events-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-[#12161d] border-2 border-amber-500 shadow-2xl text-white flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#191f29] border-b border-neutral-700">
          <div className="flex items-center gap-2.5">
            <Backpack className="w-5 h-5 text-amber-400" />
            <div>
              <h2 className="text-sm sm:text-base font-black tracking-widest uppercase text-amber-400">
                MOCHILA TÁTICA · NÍVEL {hud.backpackLevel}
              </h2>
              <div className="text-[10px] font-mono text-neutral-400">
                CAPACIDADE: {hud.backpackUsed} / {hud.backpackCapacity} ({capPct}%) · [TAB] OU [B] FECHAR
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 bg-[#242c39] hover:bg-red-700 border border-neutral-600 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 p-4">
          {/* LEFT: Equipment, Medkits & Backpack Items */}
          <div className="md:col-span-5 flex flex-col gap-3">
            {/* Armor Status */}
            <div className="bg-[#181e27] border border-neutral-700 p-3 space-y-2">
              <div className="text-[11px] font-black uppercase tracking-wider text-neutral-300 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-sky-400" />
                <span>EQUIPAMENTO DE PROTEÇÃO</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div className="bg-[#10141a] border border-neutral-700 p-2">
                  <div className="text-[10px] text-neutral-400">CAPACETE</div>
                  <div className="font-black text-sky-300">
                    {hud.helmetLevel > 0 ? `NV. ${hud.helmetLevel}` : 'NENHUM'}
                  </div>
                  {hud.helmetLevel > 0 && (
                    <div className="text-[10px] text-neutral-400">
                      {hud.helmetHp}/{hud.helmetMaxHp}
                    </div>
                  )}
                </div>
                <div className="bg-[#10141a] border border-neutral-700 p-2">
                  <div className="text-[10px] text-neutral-400">COLETE</div>
                  <div className="font-black text-emerald-300">
                    {hud.vestLevel > 0 ? `NV. ${hud.vestLevel}` : 'NENHUM'}
                  </div>
                  {hud.vestLevel > 0 && (
                    <div className="text-[10px] text-neutral-400">
                      {hud.vestHp}/{hud.vestMaxHp}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Medkit quick row */}
            <div className="bg-[#181e27] border border-neutral-700 p-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Heart className="w-5 h-5 text-red-400 shrink-0" />
                <div>
                  <div className="text-xs font-black uppercase">KIT MÉDICO (+75 HP)</div>
                  <div className="text-[10px] font-mono text-neutral-400">
                    QUANTIDADE: <strong className="text-white">{hud.medkitCount}</strong> · TECLA [H]
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={hud.medkitCount <= 0 || hud.hp >= hud.maxHp}
                  onClick={() => {
                    onUseMedkit();
                    onClose();
                  }}
                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-black font-black text-[10px] uppercase cursor-pointer"
                >
                  USAR
                </button>
                <button
                  type="button"
                  disabled={hud.medkitCount <= 0}
                  onClick={onDropMedkit}
                  className="p-1.5 bg-red-950/80 hover:bg-red-800 disabled:opacity-40 border border-red-700 text-red-200 cursor-pointer"
                  title="Dropar Kit Médico"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Backpack Stored Scopes & Attachments */}
            <div className="bg-[#181e27] border border-neutral-700 p-3 flex-1 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase tracking-wider text-neutral-300 flex items-center gap-1.5">
                  <Wrench className="w-3.5 h-3.5 text-amber-400" />
                  <span>ACESSÓRIOS &amp; MIRAS NA MOCHILA</span>
                </span>
                <span className="text-[10px] font-mono text-amber-300">
                  ALVO: SLOT [{selectedWeaponSlot}]
                </span>
              </div>

              {hud.backpackItems.length === 0 ? (
                <div className="py-6 text-center text-xs font-mono text-neutral-500 border border-dashed border-neutral-700">
                  Mochila sem acessórios extras. Vasculhe casas para encontrar miras, silenciadores, carregadores e coronhas!
                </div>
              ) : (
                <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                  {hud.backpackItems.map((item) => {
                    const targetWeapon = hud.weapons[selectedWeaponSlot];
                    const targetDef = targetWeapon ? WEAPONS[targetWeapon.weaponId] : null;
                    const canEquip =
                      (item.kind === 'scope' && Boolean(targetDef?.allowsCustomScope)) ||
                      (item.kind === 'attachment' && Boolean(targetDef?.allowsAttachments));

                    return (
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-2 bg-[#10141a] border border-neutral-700 px-2.5 py-2"
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-neutral-100 truncate">
                            {item.label}{' '}
                            {item.quantity > 1 && (
                              <span className="text-amber-400 font-mono">x{item.quantity}</span>
                            )}
                          </div>
                          {item.attachmentKind && (
                            <div className="text-[9px] font-mono text-neutral-400">
                              {ATTACHMENT_LABELS[item.attachmentKind].bonus}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {(item.kind === 'scope' || item.kind === 'attachment') && (
                            <button
                              type="button"
                              disabled={!canEquip}
                              onClick={() => onEquipItem(item.id, selectedWeaponSlot)}
                              className="px-2 py-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-35 text-black font-black text-[10px] uppercase cursor-pointer"
                            >
                              EQUIPAR
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => onDropItem(item.id)}
                            className="p-1.5 bg-red-950/80 hover:bg-red-800 border border-red-700 text-red-200 cursor-pointer"
                            title="Dropar no chão"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: Weapons & Attachment Slots */}
          <div className="md:col-span-7 flex flex-col gap-2.5">
            <div className="text-[11px] font-black uppercase tracking-wider text-neutral-300">
              ARMAS EQUIPADAS (CLIQUE NO SLOT PARA SELECIONAR DESTINO)
            </div>

            {([1, 2, 3] as const).map((slot) => {
              const w = hud.weapons[slot];
              const def = w ? WEAPONS[w.weaponId] : null;
              const isSelected = selectedWeaponSlot === slot;

              if (!w || !def) {
                return (
                  <div
                    key={slot}
                    onClick={() => setSelectedWeaponSlot(slot)}
                    className={`p-3 border cursor-pointer font-mono text-xs flex items-center justify-between ${
                      isSelected
                        ? 'bg-[#1a2230] border-amber-400 text-amber-300'
                        : 'bg-[#10141a]/70 border-neutral-800 text-neutral-500'
                    }`}
                  >
                    <span>SLOT [{slot}] · VAZIO</span>
                    <span className="text-[10px]">
                      {slot === 3 ? 'PISTOLA' : 'ARMA PRIMÁRIA'}
                    </span>
                  </div>
                );
              }

              return (
                <div
                  key={slot}
                  onClick={() => setSelectedWeaponSlot(slot)}
                  className={`p-3 border transition-colors cursor-pointer space-y-2 ${
                    isSelected
                      ? 'bg-[#1b222e] border-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.2)]'
                      : 'bg-[#161b24] border-neutral-700 hover:border-neutral-500'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`text-xs font-mono font-black px-1.5 py-0.5 ${
                          isSelected
                            ? 'bg-amber-400 text-black'
                            : 'bg-neutral-800 text-neutral-300'
                        }`}
                      >
                        {slot}
                      </span>
                      <WeaponIcon weaponId={w.weaponId} className="w-24 h-8 shrink-0" />
                      <div>
                        <div className="text-xs font-black text-white">{def.name}</div>
                        <div className="text-[10px] font-mono text-neutral-400">
                          MUNIÇÃO: {w.ammoInMag}/{w.reserveAmmo} · CADÊNCIA:{' '}
                          {Math.round(1000 / def.fireRateMs * 60)} RPM
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={occupiedCount <= 1}
                      onClick={(e) => {
                        e.stopPropagation();
                        onDropWeaponSlot(slot);
                      }}
                      className="px-2 py-1 bg-red-950/80 hover:bg-red-800 disabled:opacity-35 border border-red-700 text-red-200 text-[10px] font-mono uppercase flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>DROPAR</span>
                    </button>
                  </div>

                  {/* Scope & Attachment Slots */}
                  <div className="grid grid-cols-5 gap-1.5 text-[10px] font-mono">
                    <button
                      type="button"
                      disabled={!def.allowsCustomScope || w.scope === 'none'}
                      onClick={(e) => {
                        e.stopPropagation();
                        onUnequipScope(slot);
                      }}
                      className={`p-1.5 border text-left ${
                        w.scope !== 'none'
                          ? 'bg-emerald-950/60 border-emerald-500/70 text-emerald-200 hover:bg-red-950/60 cursor-pointer'
                          : 'bg-[#10141a] border-neutral-800 text-neutral-500'
                      }`}
                      title={
                        w.scope !== 'none' && def.allowsCustomScope
                          ? 'Clique para remover para a mochila'
                          : undefined
                      }
                    >
                      <div className="text-[8px] text-neutral-400">MIRA</div>
                      <div className="font-bold truncate">{SCOPE_META[w.scope].short}</div>
                    </button>

                    {ATT_SLOT_LABELS.map(({ key, title }) => {
                      const att = w.attachments[key];
                      return (
                        <button
                          key={key}
                          type="button"
                          disabled={!att}
                          onClick={(e) => {
                            e.stopPropagation();
                            onUnequipAttachment(slot, key);
                          }}
                          className={`p-1.5 border text-left ${
                            att
                              ? 'bg-amber-950/60 border-amber-500/70 text-amber-200 hover:bg-red-950/60 cursor-pointer'
                              : 'bg-[#10141a] border-neutral-800 text-neutral-500'
                          }`}
                          title={att ? 'Clique para remover para a mochila' : undefined}
                        >
                          <div className="text-[8px] text-neutral-400">{title}</div>
                          <div className="font-bold truncate">
                            {att ? ATTACHMENT_LABELS[att].short : '---'}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
