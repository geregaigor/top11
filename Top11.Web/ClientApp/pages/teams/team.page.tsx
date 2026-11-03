import { computed, defineComponent, reactive, ref, type PropType } from "vue";
import { onBeforeRouteUpdate, useRoute, useRouter } from "vue-router";
import { VBtn, VCard, VCardActions, VCardTitle, VContainer, VForm, VTextField } from "vuetify/components";
import { useTeamsStore } from "../../stores/teams.store";
import { fieldPlayerSkills1, fieldPlayerSkills2, goalkeeperSkills1, goalkeeperSkills2, physicalSkills, type Player, type Team } from "../../types";
import { PlayerComponent } from "../../components/player.component";
import { ImportSquadButton } from "../../components/import.squad.component";
import { MdiIcon } from "../../components/mdi.icon";
import { mdiAccountPlus, mdiBatteryCharging, mdiDeleteOutline, mdiMonitor } from "@mdi/js";
import styles from "./team.page.module.css";
import { NButton, NButtonGroup, NPopconfirm, NCard, NDatePicker, NInputGroup, NInputGroupLabel, NSelect, NSpace, NText, NTime, NTimePicker } from "naive-ui";

export const TeamPage = defineComponent({
  setup() {
    const route = useRoute();
    const router = useRouter();
    const teamStore = useTeamsStore();

    const teamId = +route.params.id;
    const team = teamStore.teams.find(t => t.id == teamId);

    if (!team) {
      router.push("/");
      return;
    }

    const onDeleteTeamHandler = () => {
      teamStore.deleteTeam(teamId);
      router.push("/");
    }

    const showIframe = ref(false);
    const showRecoveries = ref(false);

    const TeamAllSkillsAdd = (val: number) => { team.players.forEach(p => { p.skills.forEach(s => s.value += val) }); };

    return () => <VContainer class="pa-0 pa-sm-4">
      <div class={styles.toolbar}>
        <div class={styles.group}>
          <AddPlayer teamId={team.id} />
          <AddGoolkeeper teamId={team.id} />
          <ImportSquadButton team={team} />
        </div>

        <div class={styles.divider} />

        <NButtonGroup size="small">
          <NButton secondary onClick={() => TeamAllSkillsAdd(-20)}>
            Команда −20
          </NButton>
          <NButton secondary onClick={() => TeamAllSkillsAdd(20)}>
            Команда +20
          </NButton>
        </NButtonGroup>

        <div class={styles.group}>
          <NButton size="small" type={showRecoveries.value ? "primary" : "default"} secondary={!showRecoveries.value}
            onClick={() => showRecoveries.value = !showRecoveries.value}>
            {{ icon: () => <MdiIcon path={mdiBatteryCharging} />, default: () => 'Відновлення' }}
          </NButton>
          <NButton size="small" type={showIframe.value ? "primary" : "default"} secondary={!showIframe.value}
            onClick={() => showIframe.value = !showIframe.value}>
            {{ icon: () => <MdiIcon path={mdiMonitor} />, default: () => 'Гра' }}
          </NButton>
        </div>

        <NPopconfirm onPositiveClick={onDeleteTeamHandler} positiveText="Видалити" negativeText="Скасувати">
          {{
            trigger: () => <NButton size="small" type="error" ghost>
              {{ icon: () => <MdiIcon path={mdiDeleteOutline} />, default: () => 'Видалити команду' }}
            </NButton>,
            default: () => `Видалити команду «${team.name}»?`,
          }}
        </NPopconfirm>
      </div>

      {showIframe.value && <div style="width: 100%; height: 500px; overflow: hidden; position: relative;">
        <iframe
          src="https://www.topeleven.com"
          width="200%"
          height="200%"
          style="border: none; transform: scale(0.5); transform-origin: top left;">
        </iframe>
      </div>}

      {showRecoveries.value && <RecoveryComponent team={team} />}      
      {team.players.map(p => <PlayerComponent key={p.id} player={p} />)}

    </VContainer>
  },
});

const AddPlayer = defineComponent({
  props: {
    teamId: { type: Number, required: true },
  },
  setup(props) {
    const teamStore = useTeamsStore();
    const onAddPlayerHandler = () => {
      const sortOrder = teamStore.teams.find(t => t.id == props.teamId)?.players.length || 0;
      const player: Player = { id: 0, name: "New Player", position: "FIELD_PLAYER", skills: [], tierUp: 0, trainings: [], sortOrder };
      fieldPlayerSkills1.forEach(skillType => player.skills.push({ playerId: 0, skillType, value: 100, isMain: false, isTierUp: false }));
      fieldPlayerSkills2.forEach(skillType => player.skills.push({ playerId: 0, skillType, value: 100, isMain: false, isTierUp: false }));
      physicalSkills.forEach(skillType => player.skills.push({ playerId: 0, skillType, value: 100, isMain: false, isTierUp: false }));
      teamStore.teams.find(t => t.id == props.teamId)?.players.push(player);
    }
    return () => <NButton size="small" type="primary" secondary onClick={onAddPlayerHandler}>
      {{ icon: () => <MdiIcon path={mdiAccountPlus} />, default: () => 'Гравець' }}
    </NButton>
  },
});

const AddGoolkeeper = defineComponent({
  props: {
    teamId: { type: Number, required: true },
  },
  setup(props) {
    const teamStore = useTeamsStore();
    const onAddPlayerHandler = () => {
      const sortOrder = teamStore.teams.find(t => t.id == props.teamId)?.players.length || 0;
      const player: Player = { id: 0, name: "New Player", position: "GOOLKEEPER", skills: [], tierUp: 0, trainings: [], sortOrder };
      goalkeeperSkills1.forEach(skillType => player.skills.push({ playerId: 0, skillType, value: 100, isMain: false, isTierUp: false }));
      goalkeeperSkills2.forEach(skillType => player.skills.push({ playerId: 0, skillType, value: 100, isMain: false, isTierUp: false }));
      physicalSkills.forEach(skillType => player.skills.push({ playerId: 0, skillType, value: 100, isMain: false, isTierUp: false }));
      teamStore.teams.find(t => t.id == props.teamId)?.players.push(player);
    }
    return () => <NButton size="small" type="primary" secondary onClick={onAddPlayerHandler}>
      {{ icon: () => <MdiIcon path={mdiAccountPlus} />, default: () => 'Воротар' }}
    </NButton>
  },
});

const RecoveryComponent = defineComponent({
  props: {
    team: { type: Object as PropType<Team>, required: true },
  },
  setup(props) {
    const recoveryDiff = computed(() => {
      const val = 180 * 60 * 1000;
      if (props.team.recoveryBonus == 0) return val;
      return val - (val * props.team.recoveryBonus / 100);
    });
    const nextRecoveryTime = computed({
      get: () => new Date(props.team.recoveryDateTime).getTime(),
      set: (ts) => props.team.recoveryDateTime = new Date(ts).toISOString(),
    });
    while (nextRecoveryTime.value < Date.now()) {
      nextRecoveryTime.value = nextRecoveryTime.value + recoveryDiff.value
    }

    const _nextGemeTime = ref(nextRecoveryTime.value + recoveryDiff.value);
    const nextGemeTime = computed({
      get: () => _nextGemeTime.value,
      set: (ts) => {
        const now = Date.now();
        const twentyFourHoursInMs = 24 * 60 * 60 * 1000;

        const start = now;
        const end = start + twentyFourHoursInMs;
        let adjustedTs = ts;

        adjustedTs = start + ((adjustedTs - start) % twentyFourHoursInMs);
        if (adjustedTs < start) {
          adjustedTs += twentyFourHoursInMs;
        }

        _nextGemeTime.value = adjustedTs;
      }
    });

    const recoveries = computed(() => {
      const recoveries = [];
      let time = nextRecoveryTime.value;
      while (time < nextGemeTime.value) {
        recoveries.push(time);
        time = time + recoveryDiff.value;
      }
      return recoveries;
    });

    const nextRecoveryTimer = ref(0);
    const getNextRecoveryTimerTs = (): number => Math.max(0, nextRecoveryTime.value - Date.now());
    const nextGameTimer = ref(0);
    const getNextGameTimerTs = (): number => Math.max(0, nextGemeTime.value - Date.now());
    setInterval(() => {
      nextRecoveryTimer.value = getNextRecoveryTimerTs();
      nextGameTimer.value = getNextGameTimerTs();
    }, 500);

    const options = [
      { value: 0, label: "0" },
      { value: 10, label: "10", },
      { value: 20, label: "20", },
      { value: 30, label: "30" },
    ];

    return () =>
      <NCard>
        <NSpace vertical>
          <NInputGroup style="width: 400px">
            <NInputGroupLabel>Recovery bonus</NInputGroupLabel>
            <NSelect v-model:value={props.team.recoveryBonus} options={options} />
            <NInputGroupLabel>
              recovery time <NTime time={recoveryDiff.value} format="HH:mm:ss" timeZone="UTC" />
            </NInputGroupLabel>
          </NInputGroup>

          <NInputGroup>
            <NInputGroupLabel>Next Recovery</NInputGroupLabel>
            <NTimePicker v-model:value={nextRecoveryTime.value} />
            <NInputGroupLabel>
              in <NTime time={nextRecoveryTimer.value} format="HH:mm:ss" timeZone="UTC" />
            </NInputGroupLabel>
          </NInputGroup>

          <NInputGroup>
            <NInputGroupLabel>Next Game</NInputGroupLabel>
            <NTimePicker v-model:value={nextGemeTime.value} />
            <NInputGroupLabel>
              in <NTime time={nextGameTimer.value} format="HH:mm:ss" timeZone="UTC" />
            </NInputGroupLabel>
          </NInputGroup>
          
          <NText>Повних відновлень: {recoveries.value.length}, відсоток гравців для повного відновлення: {99 - (recoveries.value.length * 6)} </NText>
          {recoveries.value.length > 0 &&
            <NText style="color: red">
              next-next recovery  : <NTime time={recoveries.value[recoveries.value.length - 1] + recoveryDiff.value} format="HH:mm:ss" />
            </NText>}
          {recoveries.value.map((r, i) =>
            <NText key={i} code>
              {i+1} - <NTime time={r} format="HH:mm:ss" />
            </NText>
          )}

        </NSpace>
      </NCard>
  }
});

