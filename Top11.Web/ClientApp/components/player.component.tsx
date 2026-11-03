import { computed, defineComponent, reactive, ref, shallowRef, watch, onBeforeUnmount, type PropType } from "vue"
import { VCard, VCardText, VCardTitle, VCheckbox, VChip, VContainer, VExpandTransition, VSheet, VTextField } from "vuetify/components";
import { fieldPlayerSkills1, fieldPlayerSkills2, goalkeeperSkills1, goalkeeperSkills2, physicalSkills, trainingGroups, trainings, type Player, type Skill, type Training, type TrainingType } from "../types";
import { VSpacer } from "vuetify/components/VGrid";
import { VBtn } from "vuetify/components/VBtn";
import { VNumberInput } from "vuetify/labs/components";
import { useTeamsStore } from "../stores/teams.store";
import { mdiArrowDownBold, mdiArrowUpBold, mdiCheck, mdiDelete } from '@mdi/js';
import { NButton, NCard, NCheckbox, NEllipsis, NForm, NFormItem, NInput, NDropdown, NFlex, NFloatButton, NGrid, NGridItem, NIcon, NInputGroup, NInputGroupLabel, NInputNumber, NScrollbar, NSelect, NSpace, NText, NRadioGroup, NRadioButton, NCollapse, NCollapseItem, type SelectOption } from "naive-ui";
import type { prefix } from "naive-ui/es/_utils/cssr";
import { mdiPlus } from '@mdi/js';
import styles from "./player.component.module.css";
import { playerRanks } from "@/lib/ranks";
import { calculatePumping, type PumpingMode } from "@/lib/pumping";

type RankOption = SelectOption & { icon?: string; bonus: number };

const rankOptions: RankOption[] = [
  { value: 0, label: "Без рангу", bonus: 0 },
  ...Object.values(playerRanks).map(r => ({ value: r.bonus, label: r.name, icon: r.icon, bonus: r.bonus })),
];

const renderRankLabel = (option: SelectOption) => {
  const o = option as RankOption;
  return <span class={styles.rankOption}>
    {o.icon ? <img src={o.icon} alt="" class={styles.rankIcon} /> : <span class={styles.rankIcon} />}
    <span>{o.label as string}</span>
    {o.bonus > 0 && <span class={styles.rankBonus}>+{o.bonus}</span>}
  </span>;
};

export const PlayerComponent = defineComponent({
  props: {
    player: { type: Object as PropType<Player>, required: true },
    openSkills: { type: Boolean, default: false },
    openAllTrainings: { type: Boolean, default: false },
    orderedTrainings: { type: Boolean, default: false },
    pumping: { type: Boolean, default: false },
  },
  setup(props) {
    const teamStore = useTeamsStore();

    const player = reactive(props.player);
    const expand = reactive({
      overview: false,
      trainings: false,
      skills: props.openSkills,
      allTrainings: props.openAllTrainings,
      orderedTrainings: props.orderedTrainings,
      recommendations: false,
      pumping: props.pumping,
    });
    
    const trainingsByType = Object.fromEntries(trainings.map(t => [t.trainingType, t]));
    const onDeletePlayerHandler = () => { teamStore.deletePlayer(player.id); };    
    const avarageSkill = computed(() => (player.skills.reduce((acc, t) => acc + +t.value, 0) / player.skills.length).toFixed(1));

    type ExpandKey = keyof typeof expand;
    const menu: Array<{ key: ExpandKey, title: string }> = [
      { key: 'overview', title: 'Гравець' },
      { key: 'skills', title: 'Скіли' },
      { key: 'trainings', title: 'Обрані тренування' },
      { key: 'allTrainings', title: 'Всі тренування' },
      { key: 'orderedTrainings', title: 'Сортовані тренування' },
      { key: 'recommendations', title: 'Рекомендації' },
      { key: 'pumping', title: 'Прокачка' },
    ];

    return () => <VCard class="mt-2 pa-0">
      <div class={styles.playerHeader}>
        <div class={styles.playerTitle}>
          <NEllipsis class={styles.playerName}>{player.name}</NEllipsis>
          <VChip size="small" variant="tonal" class="ml-2">{avarageSkill.value} (+{player.tierUp})</VChip>
          <div class={styles.playerActions}>
            <VBtn icon={mdiArrowUpBold} variant="text" size="x-small" onClick={() => teamStore.reorderPlayer(player.id, 'up')} />
            <VBtn icon={mdiArrowDownBold} variant="text" size="x-small" onClick={() => teamStore.reorderPlayer(player.id, 'down')} />
            <VBtn icon={mdiDelete} variant="text" size="x-small" color="error" onClick={onDeletePlayerHandler} />
          </div>
        </div>
        <div class={styles.playerMenu}>
          {menu.map(m => {
            const on = expand[m.key];
            return <VChip key={m.key} size="small" label
              variant={on ? "flat" : "outlined"} color={on ? "primary" : undefined}
              prependIcon={on ? mdiCheck : undefined}
              onClick={() => expand[m.key] = !expand[m.key]}>{m.title}</VChip>;
          })}
        </div>
      </div>
      <VCardText class="pa-0">
        {expand.trainings && <VSheet class={styles.panelGrid}>
          {player.trainings.map(t => trainingsByType[t]).filter(Boolean).map(t => (
            <PlayerTrainingComponent key={t.trainingType} training={t} player={player}></PlayerTrainingComponent>
          ))}
        </VSheet>}

        {expand.overview && <div class={styles.overview}>
          <NForm inline size="small" labelPlacement="left" showFeedback={false} class={styles.overviewForm}>
            <NFormItem label="Ім'я" class={styles.overviewName}>
              <NInput v-model:value={player.name} placeholder="Ім'я гравця" clearable />
            </NFormItem>
            <NFormItem label="Ранг гравця" class={styles.overviewTier}>
              <NSelect
                v-model:value={player.tierUp}
                options={rankOptions}
                renderLabel={renderRankLabel}
                consistentMenuWidth={false}
                class={styles.overviewTierInput}
              />
            </NFormItem>
          </NForm>
        </div>}

        {expand.skills && <PlayerSkillsComponent player={player}></PlayerSkillsComponent>}

        {expand.allTrainings && <VSheet>
          {trainingGroups.map(group => <NFlex class={styles.panelGrid}>
            {trainings.filter(t => t.trainingGroup == group).map(training =>
              <PlayerTrainingComponent training={training} player={player}></PlayerTrainingComponent>)}
          </NFlex>)}
        </VSheet>}

        {expand.orderedTrainings && <OrderedTrainingsComponent player={player} />}
        {expand.recommendations && <RecommendationsComponent player={player} />}
        {expand.pumping && <PumpingComponent player={player} />}
      </VCardText>
    </VCard>
  }
});

const PlayerSkillComponent = defineComponent({
  name: 'SkillComponent',
  props: {
    player: { type: Object as PropType<Player>, required: true },
    skill: { type: String as PropType<Skill>, required: true },
    showTierUp: { type: Boolean, default: false }
  },
  setup(props, { emit }) {

    let playerSkill = props.player.skills.find(t => t.skillType == props.skill);
    if (!playerSkill) {
      playerSkill = reactive({ playerId: props.player.id, skillType: props.skill, value: 0, isMain: false, isTierUp: false });
      props.player.skills.push(playerSkill);
    }

    const rowClass = computed(() => [
      'px-1', styles.skillRow,
      playerSkill.value >= 340 ? styles.skillOverflow : playerSkill.isMain ? styles.skillMain : undefined,
    ]);

    const skillValue = computed({
      get() { return playerSkill.isTierUp ? playerSkill.value + +props.player.tierUp : playerSkill.value; },
      set(value) { playerSkill.value = playerSkill.isTierUp ? value - +props.player.tierUp : value; }
    });

    return () =>
      <NInputGroup class={rowClass.value}>
        <NCheckbox tabindex={-1} size="small" focusable={false} class={['n-checkbox--show-label', styles.skillMainCheck]} v-model:checked={playerSkill.isMain} />
        <NEllipsis class={['pl-1', styles.skillLabel]} onClick={() => playerSkill.isMain = !playerSkill.isMain}>{translateSkill(props.skill)}</NEllipsis>
        <NInputNumber class={styles.skillNum} v-model:value={skillValue.value} max={999} min={-999} size="tiny" inputProps={{ enterKeyHint: "done" }} />
        <NCheckbox v-show={props.showTierUp} tabindex={-1} size="small" class="pl-1 n-checkbox--show-label" focusable={false} v-model:checked={playerSkill.isTierUp} />
      </NInputGroup>
  }
});

const PlayerTrainingComponent = defineComponent({
  props: {
    training: { type: Object as PropType<Training>, required: true },
    player: { type: Object as PropType<Player>, required: true },
  },
  setup(props) {
    const training = props.training;
    const skills = computed(() => props.player.skills.filter(t => training.skills.includes(t.skillType)));
    const avg = computed(() => {
      return (skills.value.reduce((acc, t) => acc + +t.value, 0) / skills.value.length).toFixed(1);
    });

    const isSelectedTraining = computed({
      get() { return props.player.trainings.includes(training.trainingType); },
      set(value) { value ? props.player.trainings.push(training.trainingType) : props.player.trainings = props.player.trainings.filter(el => el != training.trainingType); }
    });

    const onAddClick = (value: number, event: MouseEvent) => {
      if (event.ctrlKey) { value = value * 10; }
      props.player.skills
        .filter(t => training.skills.includes(t.skillType))
        .forEach(t => t.value = t.isMain ? +t.value + value : +t.value + value / 2);
    };

    return () => <NCard class={styles.panelCard} bordered contentStyle="" contentClass="ma-1 pa-0" headerClass="pa-0 ma-0">
      <div class={[styles.cardHeader, styles.trainHeader]}>
        <NCheckbox v-model:checked={isSelectedTraining.value} size="small" class="pl-1 n-checkbox--show-label" tabindex={-1} focusable={false} />
        <NEllipsis class={styles.trainName}>
          {translateTrainingType(training.trainingType)}
        </NEllipsis>
        <div class={styles.trainCtrl}>
          <NButton size="tiny" onClick={(event) => onAddClick(-1, event)}>
            <i class="n-base-icon">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
                <line x1="400" y1="256" x2="112" y2="256" style="fill: none; stroke: currentcolor; stroke-linecap: round; stroke-linejoin: round; stroke-width: 32px;"></line>
              </svg>
            </i>
          </NButton>
          <NText>
            {avg.value}
          </NText>          
          <NButton size="tiny" onClick={(event) => onAddClick(1, event)}>
            <i class="n-base-icon">
              <svg width="512" height="512" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M256 112V400M400 256H112" stroke="currentColor" stroke-width="32" stroke-linecap="round" stroke-linejoin="round"></path>
              </svg>
            </i>
          </NButton>
        </div>
      </div>
      {skills.value.map(skill => <PlayerSkillComponent class="px-1" player={props.player} skill={skill.skillType}></PlayerSkillComponent>)}
    </NCard>
  }
});

const skillGroups = (position: Player['position']): Array<{ title: string; skills: readonly Skill[] }> =>
  position == 'FIELD_PLAYER'
    ? [{ title: "Defence", skills: fieldPlayerSkills1 },
    { title: "Attack", skills: fieldPlayerSkills2 },
    { title: "Physical", skills: physicalSkills }]
    : [{ title: "Goalkeeper1", skills: goalkeeperSkills1 },
    { title: "Goalkeeper2", skills: goalkeeperSkills2 },
    { title: "Physical", skills: physicalSkills }];

const PlayerSkillsComponent = defineComponent({
  props: {
    player: { type: Object as PropType<Player>, required: true },
  },
  setup: (props) => {
    const player = props.player;
    const skillsMap = computed(() => skillGroups(props.player.position));

    return () =>
      <NFlex class={styles.panelGrid}>
        {skillsMap.value.map(group =>
          <NCard class={styles.panelCard} bordered contentClass="ma-1 pa-0 " headerClass="pa-0 ma-0">
            <div class={[styles.cardHeader, 'text-center']}>{group.title}</div>
            {group.skills.map(skill =>
              <PlayerSkillComponent player={player} skill={skill} showTierUp={true}></PlayerSkillComponent>
            )}
          </NCard>
        )}
      </NFlex>
  },
});

const PumpingComponent = defineComponent({
  props: {
    player: { type: Object as PropType<Player>, required: true },
  },
  setup(props) {
    const target = ref(200);
    const avgCap = ref(179);
    const mode = ref<PumpingMode>('mainFocus');

    // чекбокс «в обрані тренування»
    const isSelected = (t: TrainingType) => props.player.trainings.includes(t);
    const toggleSelected = (t: TrainingType, on: boolean) => {
      if (on && !isSelected(t)) props.player.trainings.push(t);
      if (!on) props.player.trainings = props.player.trainings.filter(x => x !== t);
    };

    const effective = (s: Player['skills'][number]) => s.isTierUp ? s.value + +props.player.tierUp : s.value;

    const compute = () => {
      const relevantSkills = props.player.position == 'FIELD_PLAYER'
        ? [...fieldPlayerSkills1, ...fieldPlayerSkills2, ...physicalSkills]
        : [...goalkeeperSkills1, ...goalkeeperSkills2, ...physicalSkills];
      const skills = props.player.skills
        .filter(s => (relevantSkills as readonly Skill[]).includes(s.skillType))
        .map(s => ({ skillType: s.skillType, value: effective(s), rawValue: s.value, isMain: s.isMain, isTierUp: s.isTierUp }));
      return { skills, res: calculatePumping(skills, trainings, { target: target.value ?? 200, avgCap: avgCap.value ?? 179, mode: mode.value }) };
    };

    // розрахунок може тривати до ~0.3с — запускаємо із затримкою після останньої зміни
    const calc = shallowRef(compute());
    const calculating = ref(false);
    let timer: ReturnType<typeof setTimeout> | undefined;
    watch(
      () => [target.value, avgCap.value, mode.value, props.player.tierUp,
        props.player.skills.map(s => `${s.skillType}:${s.value}:${s.isMain}:${s.isTierUp}`).join()],
      () => {
        calculating.value = true;
        clearTimeout(timer);
        timer = setTimeout(() => { calc.value = compute(); calculating.value = false; }, 350);
      },
    );
    onBeforeUnmount(() => clearTimeout(timer));

    return () => {
      const { skills, res } = calc.value;
      const main = skills.filter(s => s.isMain);
      return <div class={styles.pumping}>
        <NCollapse>
          <NCollapseItem title="Як працює прокачка" name="help">
            <ul class={styles.pumpingHelp}>
              <li>Кожне тренування вправи дає <b>+1</b> кожному її скілу з <b>tier-up</b> (галочка справа у «Скілах») і <b>+0.5</b> — скілам без tier-up.</li>
              <li><b>Світлі</b> (головні) скіли — ті, що треба докачати до цілі. Позначаються галочкою зліва або тапом по назві. Решта — <b>сірі</b>.</li>
              <li>Розрахунок підбирає, які вправи і скільки разів зробити, щоб <b>усі світлі скіли</b> дійшли до цілі.</li>
              <li>Вправу можна качати, поки її <b>середнє</b> (середнє скілів гравця у вправі, без бонусу рангу) не перевищить ліміт. Якщо через ліміт до цілі не дотягнути — побачиш попередження.</li>
              <li>Вправи мають спільні скіли, тому кожна зроблена вправа піднімає середнє інших. План це враховує: робиться у вказаному порядку.</li>
              <li>Ціль рахується з урахуванням бонусу рангу (як значення в полях скілів).</li>
            </ul>
          </NCollapseItem>
        </NCollapse>

        <div class={styles.pumpingField}>
          <div class={styles.pumpingFieldLabel}>Алгоритм</div>
          <NRadioGroup v-model:value={mode.value} size="small">
            <NRadioButton value="mainFocus">Максимум у світлі</NRadioButton>
            <NRadioButton value="simpleFirst">Спочатку простіші</NRadioButton>
          </NRadioGroup>
          <NText depth={3} class={styles.pumpingHint}>
            {mode.value === 'mainFocus'
              ? 'Обирає вправи, де прокачка йде переважно у світлі скіли, — сірі майже не ростуть. Тренувань може бути трохи більше.'
              : 'Щоразу береться корисна вправа з найменшим поточним середнім (найпростіша), поки світлі не дійдуть до цілі. Сірі ростуть сильніше.'}
          </NText>
        </div>

        <div class={styles.pumpingHead}>
          <div class={styles.pumpingField}>
            <div class={styles.pumpingFieldLabel}>Ціль для світлих скілів</div>
            <NInputNumber v-model:value={target.value} min={1} max={999} size="small" class={styles.pumpingTarget} />
            <NText depth={3} class={styles.pumpingHint}>До якого значення докачати кожен світлий скіл</NText>
          </div>
          <div class={styles.pumpingField}>
            <div class={styles.pumpingFieldLabel}>Макс. середнє по вправі</div>
            <NInputNumber v-model:value={avgCap.value} min={1} max={999} size="small" class={styles.pumpingTarget} />
            <NText depth={3} class={styles.pumpingHint}>Вище цього середнього вправу більше не качають (у грі — 179)</NText>
          </div>
        </div>

        {!main.length && <NText type="warning">Немає світлих скілів — познач головні скіли у вкладці «Скіли», і тут з'явиться план.</NText>}
        {res.notReached.length > 0 && <NText type="warning">
          Не дотягнути до {target.value} через ліміт середнього {avgCap.value}: {res.notReached.map(s => `${translateSkill(s)} (макс. ${res.result.get(s)})`).join(', ')}
        </NText>}

        {main.length > 0 && (res.total === 0
          ? (res.notReached.length ? null : <NText type="success">Усі світлі скіли вже ≥ {target.value}</NText>)
          : <>
            <div class={styles.pumpingSectionTitle}>План тренувань</div>
            <div class={styles.pumpingTotal}>
              Всього тренувань: <b>{res.total}</b> · сірі скіли отримають разом: <b>+{res.greyGain}</b>
              {calculating.value && <NText depth={3}> · перераховую…</NText>}
            </div>
            <NText depth={3} class={styles.pumpingHint}>
              Роби вправи <b>по порядку номерів</b>, кожну повністю. Порядок важливий: вправи мають спільні скіли, і кожна
              піднімає середнє наступних. «сер.» уже враховує вправи, зроблені перед нею, — у такому порядку жодна не перевищить ліміт.
              «сер. 79.8 → 129.8» — середнє вправи на момент, коли до неї дійдеш, і після неї; «× 50» — скільки разів зробити.
              Галочка зліва додає вправу в «Обрані тренування».
            </NText>
            <div class={styles.pumpingPlan}>
              {res.plan.map((p, i) => <div class={styles.pumpingPlanRow} key={p.trainingType}>
                <NCheckbox size="small" focusable={false} checked={isSelected(p.trainingType)}
                  onUpdate:checked={(v: boolean) => toggleSelected(p.trainingType, v)} />
                <span class={styles.pumpingNum}>{i + 1}.</span>
                <span class={styles.pumpingName}>{translateTrainingType(p.trainingType)}</span>
                <NText depth={3} class={styles.pumpingAvg}>сер. {p.avgBefore} → {p.avgAfter}</NText>
                <b>× {p.count}</b>
              </div>)}
            </div>
            <div class={styles.pumpingSectionTitle}>Гравець після прокачки</div>
            <NText depth={3} class={styles.pumpingHint}>
              «154→<b>229</b>» — скільки було і скільки стане. Зеленим — світлі скіли. Значення з бонусом рангу.
            </NText>
            <div class={styles.panelGrid}>
              {skillGroups(props.player.position).map(group =>
                <div class={[styles.panelCard, styles.pumpingCard]} key={group.title}>
                  <div class={[styles.cardHeader, 'text-center']}>{group.title}</div>
                  {group.skills.map(skill => {
                    const sk = skills.find(x => x.skillType === skill);
                    const before = sk?.value ?? 0;
                    const after = res.result.get(skill) ?? before;
                    return <div key={skill} class={[styles.pumpingRow, sk?.isMain && styles.skillMain]}>
                      <span class={styles.skillLabel}>{translateSkill(skill)}</span>
                      <span class={styles.pumpingValues}>
                        {after !== before && <span class={styles.pumpingBefore}>{before}→</span>}
                        <b>{after}</b>
                      </span>
                    </div>;
                  })}
                </div>
              )}
            </div>
          </>)}
      </div>;
    };
  },
});


const OrderedTrainingsComponent = defineComponent({
  props: {
    player: { type: Object as PropType<Player>, required: true },
  },
  setup(props) {
    const player = props.player;
    const avgMax = ref(179);
    const isMainPriority = ref(true);
    
    const sortedTrainins = computed(() => trainings.map(t => {
      const trainingType = t.trainingType;
      const skills = props.player.skills.filter(s => t.skills.includes(s.skillType));
      const avarage = +(skills.reduce((acc, t) => acc + +t.value, 0) / skills.length).toFixed(1);
      const mainPercent = skills.filter(s => s.isMain).length / skills.length;
      const mainCount = skills.filter(s => s.isMain).length;
      const training = trainings.find(t => t.trainingType == trainingType)!;
      return { trainingType, avarage, mainPercent, mainCount, training }
    }).filter(el => {
      return el.avarage <= avgMax.value;
    }).sort((a, b) => {
      if (isMainPriority.value && b.mainPercent !== a.mainPercent) return b.mainPercent - a.mainPercent;
      if (isMainPriority.value && a.mainCount !== b.mainCount) return a.mainCount - b.mainCount;
      return b.avarage - a.avarage;
    }));

    return () =>
      <NSpace vertical>
        <NInputGroup>
          <NCheckbox v-model:checked={isMainPriority.value} >Приорітет % світлих</NCheckbox>
          <NInputNumber v-model:value={avgMax.value} max={999} min={0} size="tiny" step={20}>
            {{ prefix: () => 'Макс.Середнє:' }}
            </NInputNumber> 
        </NInputGroup>
        <NFlex class={styles.panelGrid}>
          {sortedTrainins.value.map((t) => <PlayerTrainingComponent key={t.training.trainingType} player={player} training={t.training} />)}
        </NFlex>
    </NSpace>
  },
});

const RecommendationsComponent = defineComponent({
  props: {
    player: { type: Object as PropType<Player>, required: true },
  },
  setup(props) {
    const selectedTrainingType = ref<string>("");
    const trainingGroups: Record<string, Array<TrainingType>> = {
      ST_AMC: ['PASS_GO_AND_SHOOT', 'SHOOTING_TECHNIQUE', 'USE_YOU_HEAD', 'SPRINT', 'WING_PLAY', 'SET_PIECE_DELIVERY', 'VIDEO_ANALYSIS',
        'ONE_ON_ONE_FINISING', 'SHUTTLE_JUMPS', 'ONE_LINE_OF_DEFENSE', 'CARIOCA_WITH_LADDERS', 'PIGGY_IN_THE_MIDDLE', 'STOP_THE_ATTACKER'],
      MC: ['VIDEO_ANALYSIS', 'USE_YOU_HEAD', 'PIGGY_IN_THE_MIDDLE', 'STOP_THE_ATTACKER', 'SHUTTLE_JUMPS', 'PASS_GO_AND_SHOOT',
        'SET_PIECE_DELIVERY', 'ONE_ON_ONE_FINISING', 'GYM', 'SHOOTING_TECHNIQUE', 'CARIOCA_WITH_LADDERS'],
      AML_AMR: ['PASS_GO_AND_SHOOT', 'FAST_COUNTER_ATTACKS', 'SHOOTING_TECHNIQUE', 'WING_PLAY', 'SPRINT', 'ONE_ON_ONE_FINISING',
        'BALL_CONTROL', 'SET_PIECE_DELIVERY', 'VIDEO_ANALYSIS', 'STRETCH', 'CARIOCA_WITH_LADDERS', 'GYM'],
      GK: ['SET_PIECE_DELIVERY', 'DEFENDING_CROSSES', 'ONE_ON_ONE_FINISING', 'ONE_LINE_OF_DEFENSE', 'GOALKEPER_TRAINING', 'FAST_COUNTER_ATTACKS',
        'SHOOTING_TECHNIQUE', 'PASS_GO_AND_SHOOT', 'BALL_CONTROL', 'GYM', 'WARM_UP', 'SHUTTLE_JUMPS', 'LONG_RUN', 'HURDLE_JUMPS', 'WING_PLAY'],
      DMC: ['WARM_UP', 'PRESS_THE_PLAY', 'VIDEO_ANALYSIS', 'PIGGY_IN_THE_MIDDLE', 'STOP_THE_ATTACKER', 'SHUTTLE_JUMPS', 'USE_YOU_HEAD',
        'SET_PIECE_DELIVERY', 'ONE_ON_ONE_FINISING', 'SLALOM_DRIBLE', 'FAST_COUNTER_ATTACKS', 'SHOOTING_TECHNIQUE']
    };
    const options = Object.keys(trainingGroups).map(type => ({ label: type, value: type }));

    const selectedTrainings = computed(() =>
      trainingGroups[selectedTrainingType.value]
        ? trainingGroups[selectedTrainingType.value]
          .map(trainingType => trainings.find(t => t.trainingType === trainingType))
          .filter(Boolean)
        : []
    );

    return () =>
      <NSpace vertical>
        <NInputGroup>
          <NInputGroupLabel>Виберіть рекомендацію зі списку:</NInputGroupLabel>
          <NSelect options={options} v-model:value={selectedTrainingType.value} clearable />
        </NInputGroup>        
        <NFlex class={styles.panelGrid}>
          {selectedTrainings.value.map((t) => <PlayerTrainingComponent key={t.trainingType} player={props.player} training={t} />)}
        </NFlex>
    </NSpace>
  }
});

const skillTranslations: Record<Skill, string> = {
  TACKLING: "Отбор мяча",
  MARKING: "Опека",
  POSITIONING: "Выбор поз.",
  HEADING: "Удар головой",
  BRAVERY: "Храбрость",

  PASSING: "Передача",
  DRIBBLING: "Дриблинг",
  CROSSING: "Навес",
  SHOOTING: "Удар",
  FINISHING: "Завершение",

  REFLEXES: "Рефлексы",
  AGILITY: "Ловкость",
  ANTICIPATION: "Чутье",
  RUSHING_OUT: "Спешка",
  COMMUNICATION: "Общение",

  THROWING: "Бросок",
  KICKING: "Нанесение удара",
  PUNCHING: "Игра кулаками",
  AERIAL_REACH: "Игра в воздухе",
  CONCENTRATION: "Концентрация",

  FITNESS: "Физ.форм",
  STRENGTH: "Сила",
  AGGRESSION: "Агрессивность",
  SPEED: "Скорость",
  CREATIVITY: "Креативность",
};

const translateSkill = (skill: Skill): string => {
  return skillTranslations[skill] || skill;
};

const trainingTranslations: Record<TrainingType, string> = {
  ONE_ON_ONE_FINISING: "Один на один",
  PASS_GO_AND_SHOOT: "Пас, рывок, удар!",
  SET_PIECE_DELIVERY: "Cтандарты",
  SHOOTING_TECHNIQUE: "Техника ударов",
  SLALOM_DRIBLE: "Салом",
  WING_PLAY: "Игра флангами",
  FAST_COUNTER_ATTACKS: "Быстрые контратаки",

  BALL_CONTROL: "Контроль мяча",
  PIGGY_IN_THE_MIDDLE: "Собачка",
  FIRST_TOUCH_PLAY: "Игра в касание",
  RAPID_SIDE_SWITCH: "Быстр. перевод на фланг",
  STAY_IN_LINE: "Держать линию",
  CONTACT_PLAY: "Контактная игра",
  PASSES_BEFORE_SHOT: "Пасы перед ударом",

  VIDEO_ANALYSIS: "Видеоанализ",
  USE_YOU_HEAD: "Работай головой",
  ONE_LINE_OF_DEFENSE: "Держать линию",
  STOP_THE_ATTACKER: "Остановить нападение",
  DEFENDING_CROSSES: "Защита от навесов",
  PRESS_THE_PLAY: "Прессинг",
  GOALKEPER_TRAINING: "Тренировка вратаря",

  WARM_UP: "Разминка",
  STRETCH: "Растяжка",
  CARIOCA_WITH_LADDERS: "Кариока",
  LONG_RUN: "Долгий забег",
  SHUTTLE_JUMPS: "Челночный бег",
  HURDLE_JUMPS: "Бег с препятствиями",
  GYM: "Спортивный зал",
  SPRINT: "Ускорение",
};

const translateTrainingType = (trainingType: TrainingType): string => {
  return trainingTranslations[trainingType] || trainingType;
};
