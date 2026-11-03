import rare from '@/assets/ranks/rare.png';
import elite from '@/assets/ranks/elite.png';
import star from '@/assets/ranks/star.png';
import master from '@/assets/ranks/master.png';
import legend from '@/assets/ranks/legend.png';
import great from '@/assets/ranks/great.png';

export enum PlayerRank {
  Rare = 1,
  Elite = 2,
  Star = 3,
  Master = 4,
  Legend = 5,
  Great = 6,
}

export interface PlayerRankInfo {
  rank: PlayerRank;
  name: string;
  icon: string;
  /** Постійний бонус до ключових характеристик */
  bonus: number;
}

export const playerRanks: Record<PlayerRank, PlayerRankInfo> = {
  [PlayerRank.Rare]: { rank: PlayerRank.Rare, name: 'Рідкісний', icon: rare, bonus: 10 },
  [PlayerRank.Elite]: { rank: PlayerRank.Elite, name: 'Елітний', icon: elite, bonus: 30 },
  [PlayerRank.Star]: { rank: PlayerRank.Star, name: 'Зірковий', icon: star, bonus: 50 },
  [PlayerRank.Master]: { rank: PlayerRank.Master, name: 'Майстер', icon: master, bonus: 80 },
  [PlayerRank.Legend]: { rank: PlayerRank.Legend, name: 'Легенда', icon: legend, bonus: 120 },
  [PlayerRank.Great]: { rank: PlayerRank.Great, name: 'Великий', icon: great, bonus: 160 },
};

export const rankIcon = (rank: PlayerRank): string | undefined => playerRanks[rank]?.icon;
