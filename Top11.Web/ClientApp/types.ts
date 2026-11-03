export const fieldPlayerSkills1 = ['TACKLING', 'MARKING', 'POSITIONING', 'HEADING', 'BRAVERY'] as const;
type FieldPlayerSkill1 = (typeof fieldPlayerSkills1)[number];

export const fieldPlayerSkills2 = ['PASSING', 'DRIBBLING', 'CROSSING', 'SHOOTING', 'FINISHING'] as const;
type FieldPlayerSkill2 = (typeof fieldPlayerSkills2)[number];

export const goalkeeperSkills1 = ['REFLEXES', 'AGILITY', 'ANTICIPATION', 'RUSHING_OUT', 'COMMUNICATION'] as const;
export type GoalkeeperSkills1 = (typeof goalkeeperSkills2)[number];

export const goalkeeperSkills2 = ['THROWING', 'KICKING', 'PUNCHING', 'AERIAL_REACH', 'CONCENTRATION'] as const;
export type GoalkeeperSkills2 = (typeof goalkeeperSkills1)[number];

export const physicalSkills = ['FITNESS', 'STRENGTH', 'AGGRESSION', 'SPEED', 'CREATIVITY'] as const;
export type PhysicalSkill = (typeof physicalSkills)[number];

export type Skill = FieldPlayerSkill1 | FieldPlayerSkill2 | GoalkeeperSkills1 | GoalkeeperSkills2 | PhysicalSkill;

export type Player = {
  id: number;
  name: string;
  tierUp: number;
  position: 'FIELD_PLAYER' | 'GOOLKEEPER';
  skills: Array<{ playerId: number, skillType: Skill, value: number, isMain: boolean, isTierUp: boolean }>;
  trainings: Array<TrainingType>;
  sortOrder: number;
};

export type Training = {
  trainingGroup: TrainingGroup
  trainingType: TrainingType;
  skills: Array<Skill>;  
}

export const trainingGroups = ['ATTACK', 'MIDFIELD', 'DEFENCE', 'PHYSICAL'] as const;
export type TrainingGroup = (typeof trainingGroups)[number];
export type TrainingType =
  'ONE_ON_ONE_FINISING' |
  'PASS_GO_AND_SHOOT' |
  'SET_PIECE_DELIVERY' |
  'SHOOTING_TECHNIQUE' |
  'SLALOM_DRIBLE' |
  'WING_PLAY' |
  'FAST_COUNTER_ATTACKS' |

  'BALL_CONTROL' |
  'PIGGY_IN_THE_MIDDLE' |
  'FIRST_TOUCH_PLAY' |
  'RAPID_SIDE_SWITCH' |
  'STAY_IN_LINE' |
  'CONTACT_PLAY' |
  'PASSES_BEFORE_SHOT' |

  'VIDEO_ANALYSIS' |
  'USE_YOU_HEAD' |
  'ONE_LINE_OF_DEFENSE' |
  'STOP_THE_ATTACKER' |
  'DEFENDING_CROSSES' |
  'PRESS_THE_PLAY' |
  'GOALKEPER_TRAINING' |

  'WARM_UP' |
  'STRETCH' |
  'CARIOCA_WITH_LADDERS' |
  'LONG_RUN' |
  'SHUTTLE_JUMPS' |
  'HURDLE_JUMPS' |
  'GYM' |
  'SPRINT';

export const trainings: Array<Training> = [
  { trainingGroup: 'ATTACK', trainingType: 'ONE_ON_ONE_FINISING', skills: ['TACKLING', 'RUSHING_OUT', 'ANTICIPATION', 'DRIBBLING', 'FINISHING'] },
  { trainingGroup: 'ATTACK', trainingType: 'PASS_GO_AND_SHOOT', skills: ['ANTICIPATION', 'SPEED', 'SHOOTING', 'PASSING'] },
  { trainingGroup: 'ATTACK', trainingType: 'SET_PIECE_DELIVERY', skills: ['RUSHING_OUT', 'SHOOTING', 'HEADING', 'CROSSING', 'MARKING'] },
  { trainingGroup: 'ATTACK', trainingType: 'SHOOTING_TECHNIQUE', skills: ['SHOOTING', 'REFLEXES', 'STRENGTH', 'AGILITY', 'FINISHING'] },
  { trainingGroup: 'ATTACK', trainingType: 'SLALOM_DRIBLE', skills: ['SPEED', 'FITNESS', 'DRIBBLING', 'PASSING'] },
  { trainingGroup: 'ATTACK', trainingType: 'WING_PLAY', skills: ['PUNCHING', 'SHOOTING', 'HEADING', 'FINISHING', 'CROSSING'] },
  { trainingGroup: 'ATTACK', trainingType: 'FAST_COUNTER_ATTACKS', skills: ['CREATIVITY', 'PASSING', 'COMMUNICATION', 'FINISHING', 'CROSSING'] },

  { trainingGroup: 'MIDFIELD', trainingType: 'BALL_CONTROL', skills: ['CREATIVITY', 'HEADING', 'CONCENTRATION', 'DRIBBLING'] },
  { trainingGroup: 'MIDFIELD', trainingType: 'PIGGY_IN_THE_MIDDLE', skills: ['AGGRESSION', 'POSITIONING', 'PASSING', 'TACKLING', 'FITNESS'] },
  { trainingGroup: 'MIDFIELD', trainingType: 'FIRST_TOUCH_PLAY', skills: ['FITNESS', 'PASSING', 'THROWING', 'DRIBBLING'] },
  { trainingGroup: 'MIDFIELD', trainingType: 'RAPID_SIDE_SWITCH', skills: ['POSITIONING', 'SPEED', 'PASSING', 'COMMUNICATION', 'CREATIVITY', 'CROSSING'] },
  { trainingGroup: 'MIDFIELD', trainingType: 'STAY_IN_LINE', skills: ['POSITIONING', 'SPEED', 'FITNESS', 'AERIAL_REACH'] },
  { trainingGroup: 'MIDFIELD', trainingType: 'CONTACT_PLAY', skills: ['STRENGTH', 'MARKING', 'AGGRESSION', 'DRIBBLING', 'BRAVERY'] },
  { trainingGroup: 'MIDFIELD', trainingType: 'PASSES_BEFORE_SHOT', skills: ['ANTICIPATION', 'POSITIONING', 'PASSING', 'CREATIVITY', 'FINISHING'] },

  { trainingGroup: 'DEFENCE', trainingType: 'VIDEO_ANALYSIS', skills: ['CREATIVITY', 'BRAVERY', 'POSITIONING', 'COMMUNICATION'] },
  { trainingGroup: 'DEFENCE', trainingType: 'USE_YOU_HEAD', skills: ['CREATIVITY', 'HEADING', 'POSITIONING', 'PASSING'] },
  { trainingGroup: 'DEFENCE', trainingType: 'ONE_LINE_OF_DEFENSE', skills: ['POSITIONING', 'CONCENTRATION', 'COMMUNICATION', 'MARKING'] },
  { trainingGroup: 'DEFENCE', trainingType: 'STOP_THE_ATTACKER', skills: ['STRENGTH', 'MARKING', 'DRIBBLING', 'TACKLING', 'BRAVERY'] },
  { trainingGroup: 'DEFENCE', trainingType: 'DEFENDING_CROSSES', skills: ['MARKING', 'CROSSING', 'AERIAL_REACH', 'BRAVERY', 'HEADING'] },
  { trainingGroup: 'DEFENCE', trainingType: 'PRESS_THE_PLAY', skills: ['POSITIONING', 'MARKING', 'AGGRESSION', 'TACKLING', 'BRAVERY'] },
  { trainingGroup: 'DEFENCE', trainingType: 'GOALKEPER_TRAINING', skills: ['AGILITY', 'THROWING', 'KICKING', 'REFLEXES', 'AERIAL_REACH'] },

  { trainingGroup: 'PHYSICAL', trainingType: 'WARM_UP', skills: ['HEADING', 'REFLEXES', 'AGGRESSION', 'FITNESS'] },
  { trainingGroup: 'PHYSICAL', trainingType: 'STRETCH', skills: ['AGILITY', 'STRENGTH', 'SPEED', 'FITNESS'] },
  { trainingGroup: 'PHYSICAL', trainingType: 'CARIOCA_WITH_LADDERS', skills: ['AGILITY', 'AGGRESSION', 'SPEED', 'CONCENTRATION'] },
  { trainingGroup: 'PHYSICAL', trainingType: 'LONG_RUN', skills: ['FITNESS', 'CONCENTRATION', 'SPEED'] },
  { trainingGroup: 'PHYSICAL', trainingType: 'SHUTTLE_JUMPS', skills: ['AGILITY', 'BRAVERY', 'STRENGTH', 'SPEED'] },
  { trainingGroup: 'PHYSICAL', trainingType: 'HURDLE_JUMPS', skills: ['BRAVERY', 'AGGRESSION', 'SPEED', 'KICKING'] },
  { trainingGroup: 'PHYSICAL', trainingType: 'GYM', skills: ['STRENGTH', 'FITNESS', 'KICKING', 'THROWING'] },
  { trainingGroup: 'PHYSICAL', trainingType: 'SPRINT', skills: ['RUSHING_OUT', 'SPEED', 'FITNESS', 'DRIBBLING'] },
];

export type Team = {
  id: number;
  name: string;
  players: Array<Player>;
  recoveryDateTime: string;
  recoveryBonus: number;
};

// defence

//      'tackling'    |  'tackling'    |  '--------'
//      'marking'     |  'marking'     |  '--------'
//      'positioning' |  'positioning' |  'positioning'
//      'heading'     |  '--------'    |  'heading'
//      'bravery'     |  'bravery'     |  '--------'

//      'passing'     |  'passing'     |  'passing'
//      '--------'    |  'dribbling'   |  'dribbling'
//      'crossing'    |  'crossing'    |  'crossing'
//      '--------'    |  'shooting'    |  'shooting'
//      '--------'    |  '--------'    |  'finishing'

//      'fitness'     |  'fitness'     |  'fitness'
//      'strength'    |  '--------'    |  'strength'
//      'aggression'  |  '--------'    |  '--------'
//      'speed'       |  'speed'       |  'speed'
//      '--------'    |  'creativity'  |  'creativity'
