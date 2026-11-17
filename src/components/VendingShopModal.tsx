import React, { useState } from 'react';
import { HeartPulse, ShoppingBag, X } from 'lucide-react';
import { HudSnapshot, VENDING_SHOP_OFFERS, VendingShopOffer } from '../game/types';
import {
  IconCoinSvg,
  IconGlooSvg,
  IconGrenadeSvg,
  IconHelmetSvg,
  IconMedkitSvg,
  IconScopeSvg,
  IconVestSvg,
} from './HudIcons';
import { WeaponIcon } from './WeaponIcon';

interface VendingShopModalProps {
  ffCoins: number;
  teamMembers: HudSnapshot['teamMembers'];
  onBuyOffer: (offerId: string, reviveAllyId?: string) => boolean;
  onClose: () => void;
}

type ShopCategoryFilter = 'all' | 'utility' | 'gear' | 'weapon';

export const VendingShopModal: React.FC<VendingShopModalProps> = ({
  ffCoins,
  teamMembers,
  onBuyOffer,
  onClose,
}) => {
  const [filter, setFilter] = useState<ShopCategoryFilter>('all');
  const [feedback, setFeedback] = useState<string | null>(null);

  const deadOrDownedAllies = teamMembers.filter(
    (m) => m.slotNumber > 1 && (m.eliminated || m.isDowned),
  );

  const filteredOffers = VENDING_SHOP_OFFERS.filter((o) =>
    filter === 'all' ? true : o.category === filter,
  );

  const handlePurchase = (offer: VendingShopOffer) => {
    const ok = onBuyOffer(offer.id);
    if (ok) {
      setFeedback(`Comprado: ${offer.label}`);
    } else {
      setFeedback('Moedas FF insuficientes!');
    }
  };

  const handleRevivePurchase = (allyId: string, nick: string) => {
    const ok = onBuyOffer('revive_ally', allyId);
    if (ok) {
      setFeedback(`${nick} redesdobrado de paraquedas!`);
    } else {
      setFeedback('Precisa de 400 Moedas FF para salvar!');
    }
  };

  const renderOfferIcon = (offer: VendingShopOffer) => {
    if (offer.weaponId) {
      return <WeaponIcon weaponId={offer.weaponId} className="w-16 h-6" />;
    }
    if (offer.id === 'medkit') return <IconMedkitSvg className="w-6 h-6 text-emerald-400" />;
    if (offer.id === 'gloo2') return <IconGlooSvg className="w-6 h-6 text-cyan-400" />;
    if (offer.id === 'grenade2') return <IconGrenadeSvg className="w-6 h-6 text-red-400" />;
    if (offer.id === 'vest2' || offer.id === 'vest3') {
      return <IconVestSvg className="w-6 h-6 text-amber-400" />;
    }
    if (offer.id === 'helmet3') return <IconHelmetSvg className="w-6 h-6 text-amber-400" />;
    if (offer.id === 'scope4x') return <IconScopeSvg className="w-6 h-6 text-sky-400" />;
    return <ShoppingBag className="w-5 h-5 text-amber-300" />;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 sm:p-4 text-white"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-[#14181e] border-2 border-cyan-400 shadow-2xl flex flex-col max-h-[88vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#1a222d] border-b border-neutral-700">
          <div className="flex items-center gap-2.5">
            <ShoppingBag className="w-5 h-5 text-cyan-400" />
            <div>
              <h2 className="font-black text-sm tracking-widest uppercase text-cyan-300 leading-none">
                LOJINHA DE SUPRIMENTOS
              </h2>
              <p className="text-[10px] font-mono text-neutral-400 mt-0.5">
                Compre armas, coletes e reviva aliados
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 bg-black/65 border border-amber-400/60 px-2.5 py-1">
              <IconCoinSvg className="w-4 h-4 shrink-0" />
              <span className="font-mono font-black text-sm text-amber-300 tabular-nums">
                {ffCoins}
              </span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 bg-black/50 hover:bg-neutral-700 border border-neutral-600 cursor-pointer"
              aria-label="Fechar Lojinha"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          {feedback && (
            <div className="px-3 py-1.5 bg-cyan-950/90 border border-cyan-400 text-cyan-200 text-xs font-mono font-bold text-center">
              {feedback}
            </div>
          )}

          {/* Revive Squadmates Card (400 Coins) */}
          {teamMembers.length > 1 && (
            <div className="bg-[#0e1319] border border-emerald-500/50 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-emerald-300">
                  <HeartPulse className="w-4 h-4" />
                  <span>SALVAR AMIGO NA LOJINHA</span>
                </div>
                <span className="flex items-center gap-1 text-[11px] font-mono font-black text-amber-300">
                  <IconCoinSvg className="w-3.5 h-3.5" />
                  400 MOEDAS
                </span>
              </div>

              {deadOrDownedAllies.length === 0 ? (
                <div className="text-[11px] font-mono text-neutral-400">
                  Todos os seus aliados estão ativos no campo de batalha.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {deadOrDownedAllies.map((ally) => {
                    const canAfford = ffCoins >= 400;
                    return (
                      <button
                        key={ally.id}
                        type="button"
                        disabled={!canAfford}
                        onClick={() => handleRevivePurchase(ally.id, ally.nick)}
                        className={`flex items-center justify-between px-3 py-2 border text-left transition-colors ${
                          canAfford
                            ? 'bg-emerald-950/60 hover:bg-emerald-900/70 border-emerald-400 cursor-pointer'
                            : 'bg-neutral-900/60 border-neutral-700 opacity-50 cursor-not-allowed'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-black text-white truncate">
                            #{ally.slotNumber} {ally.nick}
                          </div>
                          <div className="text-[10px] font-mono text-red-300 uppercase">
                            {ally.eliminated ? 'Eliminado · Voltar de Paraquedas' : 'Caído · Curar Agora'}
                          </div>
                        </div>
                        <span className="px-2 py-1 bg-emerald-500 text-black font-black text-[10px] uppercase whitespace-nowrap shrink-0 ml-2">
                          REVIVER
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Category Filter Tabs */}
          <div className="grid grid-cols-4 gap-1.5 text-[11px] font-black uppercase">
            {(
              [
                { id: 'all', label: 'Todos' },
                { id: 'utility', label: 'Kits & Gelo' },
                { id: 'gear', label: 'Equipamentos' },
                { id: 'weapon', label: 'Armas' },
              ] as Array<{ id: ShopCategoryFilter; label: string }>
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setFilter(t.id)}
                className={`py-1.5 border cursor-pointer whitespace-nowrap ${
                  filter === t.id
                    ? 'bg-cyan-400 text-black border-cyan-200'
                    : 'bg-[#1a222d] text-neutral-300 border-neutral-700 hover:border-neutral-500'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Item Catalog Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {filteredOffers.map((offer) => {
              const canAfford = ffCoins >= offer.cost;
              return (
                <button
                  key={offer.id}
                  type="button"
                  disabled={!canAfford}
                  onClick={() => handlePurchase(offer)}
                  className={`flex items-center justify-between gap-2 p-2.5 border text-left transition-colors ${
                    canAfford
                      ? 'bg-[#1a212b] hover:bg-[#232d3b] border-neutral-600 hover:border-cyan-400 cursor-pointer'
                      : 'bg-[#12161c] border-neutral-800 opacity-50 cursor-not-allowed'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-16 h-10 bg-black/50 border border-white/10 flex items-center justify-center shrink-0">
                      {renderOfferIcon(offer)}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-black text-white truncate">
                        {offer.label}
                      </div>
                      <div className="text-[10px] font-mono text-neutral-400">
                        {offer.sub}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 px-2 py-1 bg-black/70 border border-amber-400/50 text-amber-300 font-mono font-black text-xs tabular-nums whitespace-nowrap shrink-0">
                    <IconCoinSvg className="w-3.5 h-3.5" />
                    <span>{offer.cost}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 bg-[#1a222d] border-t border-neutral-700 flex items-center justify-between text-[11px] font-mono text-neutral-400">
          <span>Ganhe moedas pelo mapa, abates (+100) e AirDrops (+200)</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-black font-black uppercase tracking-wider cursor-pointer whitespace-nowrap"
          >
            FECHAR
          </button>
        </div>
      </div>
    </div>
  );
};
