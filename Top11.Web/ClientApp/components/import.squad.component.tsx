import { computed, defineComponent, ref, type PropType } from "vue";
import { NAlert, NButton, NInput, NModal, NSelect, NSpace, NTag, NText } from "naive-ui";
import { mdiDatabaseImportOutline } from "@mdi/js";
import { MdiIcon } from "./mdi.icon";
import type { Player, Skill, Team } from "../types";

/** Формат, який копіює Chrome-розширення Top11 («Моя команда» → «Експорт для Top11») */
interface ExportSkill { skillType: Skill; value: number; raw: number; isMain: boolean; isTierUp: boolean }
interface ExportPlayer {
  gameId: number;
  name: string;
  firstName: string;
  lastName: string;
  age: number;
  position: Player['position'];
  positions: string[];
  rank: number;
  tierUp: number;
  /** false — світлі визначені не для всіх амплуа (тоді перевір галочки вручну) */
  keysComplete?: boolean;
  skills: ExportSkill[];
}
interface ExportPayload { format: string; version: number; exportedAt: string; players: ExportPlayer[] }

const NEW = 'new';
const SKIP = 'skip';
type Target = number | typeof NEW | typeof SKIP;

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[.'’]/g, ' ').replace(/\s+/g, ' ').trim();

/** Наскільки ім'я гравця на сайті схоже на гравця з гри: 3 — повне ім'я, 2 — прізвище / «І. Прізвище», 1 — прізвище як слово в імені, 0 — ні */
function matchScore(siteName: string, p: ExportPlayer): number {
  const site = norm(siteName);
  const full = norm(p.name);
  const last = norm(p.lastName);
  const initial = norm(`${p.firstName.slice(0, 1)} ${p.lastName}`);
  if (!site || !last) return 0;
  if (site === full) return 3;
  if (site === last || site === initial) return 2;
  if (` ${site} `.includes(` ${last} `)) return 1;
  return 0;
}

/** Найкращий унікальний збіг по імені; якщо двоє однаково схожі — не вгадуємо */
function autoMatch(players: Player[], p: ExportPlayer): number | undefined {
  const scored = players.map(sp => ({ id: sp.id, score: matchScore(sp.name, p) })).filter(x => x.score > 0);
  const best = Math.max(0, ...scored.map(x => x.score));
  const top = scored.filter(x => x.score === best);
  return top.length === 1 ? top[0]!.id : undefined;
}

function parse(text: string): ExportPayload {
  let data: ExportPayload;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Це не JSON. Скопіюй експорт з розширення ще раз.');
  }
  if (data?.format !== 'top11-squad' || !Array.isArray(data.players)) {
    throw new Error('Невідомий формат. Потрібен експорт з розширення Top11 («Моя команда» → «Експорт для Top11»).');
  }
  return data;
}

const toSkills = (p: ExportPlayer, playerId: number): Player['skills'] =>
  p.skills.map(s => ({ playerId, skillType: s.skillType, value: s.value, isMain: s.isMain, isTierUp: s.isTierUp }));

export const ImportSquadButton = defineComponent({
  props: {
    team: { type: Object as PropType<Team>, required: true },
  },
  setup(props) {
    const show = ref(false);
    const text = ref('');
    const error = ref('');
    const payload = ref<ExportPayload>();
    const targets = ref<Target[]>([]);

    const open = () => {
      text.value = '';
      error.value = '';
      payload.value = undefined;
      show.value = true;
    };

    const onParse = () => {
      error.value = '';
      try {
        const data = parse(text.value);
        payload.value = data;
        targets.value = data.players.map(p => autoMatch(props.team.players, p) ?? NEW);
      } catch (e) {
        error.value = (e as Error).message;
      }
    };

    const options = computed(() => [
      { label: '➕ Додати як нового', value: NEW },
      { label: '— Пропустити', value: SKIP },
      ...props.team.players.map(p => ({ label: p.name, value: p.id })),
    ]);

    /** Один гравець сайту не може отримати двох гравців з гри */
    const duplicates = computed(() => {
      const ids = targets.value.filter((t): t is number => typeof t === 'number');
      return new Set(ids.filter((id, i) => ids.indexOf(id) !== i));
    });

    const summary = computed(() => {
      const t = targets.value;
      return {
        update: t.filter(x => typeof x === 'number').length,
        add: t.filter(x => x === NEW).length,
        skip: t.filter(x => x === SKIP).length,
      };
    });

    const onApply = () => {
      const data = payload.value;
      if (!data || duplicates.value.size) return;
      data.players.forEach((p, i) => {
        const target = targets.value[i];
        if (target === SKIP) return;
        if (target === NEW) {
          props.team.players.push({
            id: 0,
            name: p.name,
            position: p.position,
            tierUp: p.tierUp,
            trainings: [],
            sortOrder: props.team.players.length,
            skills: toSkills(p, 0),
          });
          return;
        }
        const sp = props.team.players.find(x => x.id === target);
        if (!sp) return;
        // ім'я, вибрані тренування і порядок лишаємо як на сайті
        sp.position = p.position;
        sp.tierUp = p.tierUp;
        sp.skills = toSkills(p, sp.id);
      });
      show.value = false;
    };

    const rankLabel = (p: ExportPlayer) => p.tierUp ? `+${p.tierUp}` : 'без рангу';
    const mainCount = (p: ExportPlayer) => p.skills.filter(s => s.isMain).length;

    return () => <>
      <NButton size="small" secondary onClick={open}>
        {{ icon: () => <MdiIcon path={mdiDatabaseImportOutline} />, default: () => 'Імпорт з гри' }}
      </NButton>

      <NModal v-model:show={show.value} preset="card" title={`Імпорт з гри → ${props.team.name}`} style="width: min(760px, 96vw)">
        {!payload.value
          ? <NSpace vertical>
              <NText depth={3}>
                У розширенні: «Моя команда» → відміть гравців → «Експорт для Top11». Встав скопійоване сюди.
              </NText>
              <NInput v-model:value={text.value} type="textarea" rows={10} placeholder='{"format":"top11-squad", ...}' />
              {error.value && <NAlert type="error">{error.value}</NAlert>}
              <NSpace justify="end">
                <NButton onClick={() => show.value = false}>Скасувати</NButton>
                <NButton type="primary" disabled={!text.value.trim()} onClick={onParse}>Далі</NButton>
              </NSpace>
            </NSpace>
          : <NSpace vertical>
              <NText depth={3}>
                Зіставлено по імені. Перевір і, якщо треба, вибери гравця вручну. Оновлюються навички (разом із галочками світлих), ранг і позиція;
                ім'я, тренування та порядок на сайті не змінюються. Після імпорту натисни «Зберегти».
              </NText>
              <table style="width: 100%; border-collapse: collapse">
                <thead>
                  <tr style="text-align: left; opacity: .6">
                    <th style="padding: 4px">З гри</th><th style="padding: 4px">Вік</th><th style="padding: 4px">Ранг</th><th style="padding: 4px" title="Світлі (ключові) навички">Світлі</th><th style="padding: 4px; width: 280px">На сайті</th>
                  </tr>
                </thead>
                <tbody>
                  {payload.value.players.map((p, i) => {
                    const t = targets.value[i];
                    const dup = typeof t === 'number' && duplicates.value.has(t);
                    return <tr key={p.gameId} style="border-top: 1px solid rgba(128,128,128,.2)">
                      <td style="padding: 4px">
                        {p.name} {p.position === 'GOOLKEEPER' && <NTag size="small" type="info">GK</NTag>}
                        <NText depth={3} style="font-size: 12px"> {p.positions.join(' ')}</NText>
                      </td>
                      <td style="padding: 4px">{p.age}</td>
                      <td style="padding: 4px">{rankLabel(p)}</td>
                      <td style="padding: 4px">
                        {mainCount(p)}
                        {p.keysComplete === false && <span title="Для частини амплуа світлі ще невідомі — перевір галочки після імпорту"><NTag size="small" type="warning" style="margin-left: 4px">перевір</NTag></span>}
                      </td>
                      <td style="padding: 4px">
                        <NSelect size="small" filterable options={options.value} status={dup ? 'error' : undefined}
                          value={t} onUpdateValue={(v: Target) => { targets.value[i] = v; }} />
                      </td>
                    </tr>;
                  })}
                </tbody>
              </table>
              {duplicates.value.size > 0 && <NAlert type="error">Один гравець сайту вибраний для кількох гравців з гри.</NAlert>}
              <NSpace justify="space-between" align="center">
                <NText>Оновити: {summary.value.update} · додати: {summary.value.add} · пропустити: {summary.value.skip}</NText>
                <NSpace>
                  <NButton onClick={() => payload.value = undefined}>Назад</NButton>
                  <NButton type="primary" disabled={duplicates.value.size > 0} onClick={onApply}>Імпортувати</NButton>
                </NSpace>
              </NSpace>
            </NSpace>}
      </NModal>
    </>;
  },
});
