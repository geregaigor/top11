import { computed, defineComponent, reactive } from "vue";
import { useAppStore } from "../stores/app.store";
import { PlayerComponent } from "../components/player.component";
import { VBtn } from "vuetify/components/VBtn";
import { useTeamsStore } from "../stores/teams.store";
import { fieldPlayerSkills1, fieldPlayerSkills2, physicalSkills, type Player, type Skill } from "../types";
import { NButton, NCard, NEmpty, NIcon, NSpace, NText } from "naive-ui";
import { RouterLink } from "vue-router";
import { mdiPlus } from "@mdi/js";
import styles from "./home.page.module.css";

export default defineComponent({
  setup() {
    // <=80   9~10
    // <=100  13 ?
    const teamStore = useTeamsStore();
    const authStore = useAppStore();    
    
    const player = reactive<Player>({ id: 0, name: "Cristiano Ronaldo", position: "FIELD_PLAYER", skills: [], tierUp: 0, trainings: [], sortOrder: 0 });
    fieldPlayerSkills1.forEach(skillType => player.skills.push({ playerId: 0, skillType, value: 50, isMain: false, isTierUp: false }));
    fieldPlayerSkills2.forEach(skillType => player.skills.push({ playerId: 0, skillType, value: 50, isMain: false, isTierUp: false }));
    physicalSkills.forEach(skillType => player.skills.push({ playerId: 0, skillType, value: 50, isMain: false, isTierUp: false }));

    const addPercent = (value: number) => player.skills.forEach(s => s.value = s.value + value);
    const reset = () => player.skills.forEach(s => s.value = s.isMain ? 60 : 40);

    const mainSkills: Array<Skill> = ["POSITIONING", "HEADING", "PASSING", "DRIBBLING", "SHOOTING", "FINISHING", "FITNESS", "STRENGTH", "SPEED", "CREATIVITY"];
    player.skills
      .filter(s => mainSkills.includes(s.skillType))
      .forEach(s => s.isMain = true);
    reset();     
    
    return () => authStore.isAuthenticated ? <TeamsPicker /> : <div>

      Щоб мати можливість зберігати зміни - авторизуйтесь &nbsp; <VBtn to="/login">Увійти</VBtn>
      <NSpace>
        <NButton onClick={() => addPercent(20)}>+20%</NButton>
        <NButton onClick={() => addPercent(-20)}>-20%</NButton>
        <NButton onClick={reset}>Reset</NButton>
      </NSpace>
      <PlayerComponent openSkills openAllTrainings player={player}></PlayerComponent>

    </div>
  },
});

const playersLabel = (n: number) => {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return `${n} гравець`;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return `${n} гравці`;
  return `${n} гравців`;
};

const TeamsPicker = defineComponent({
  setup() {
    const teamsStore = useTeamsStore();

    const createCard = () =>
      <RouterLink to="/teams/create" class={styles.link}>
        <NCard hoverable class={[styles.card, styles.createCard]}>
          <NIcon size={28}><svg viewBox="0 0 24 24"><path fill="currentColor" d={mdiPlus} /></svg></NIcon>
          <span>Створити команду</span>
        </NCard>
      </RouterLink>;

    return () => <div class={styles.page}>
      <h2 class={styles.title}>Мої команди</h2>

      {teamsStore.teams.length === 0
        ? <NEmpty description="У тебе ще немає команд" class={styles.empty}>
            {{ extra: () => <RouterLink to="/teams/create" class={styles.link}><NButton type="success">Створити команду</NButton></RouterLink> }}
          </NEmpty>
        : <div class={styles.grid}>
            {teamsStore.teams.map(team =>
              <RouterLink to={`/teams/${team.id}`} class={styles.link} key={team.id}>
                <NCard hoverable class={styles.card}>
                  <div class={styles.teamName}>{team.name}</div>
                  <NText depth={3}>{playersLabel(team.players.length)}</NText>
                </NCard>
              </RouterLink>
            )}
            {createCard()}
          </div>}
    </div>;
  }
});
