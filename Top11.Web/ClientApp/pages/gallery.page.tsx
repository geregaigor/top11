import { computed, defineComponent, reactive } from "vue";
import { useAppStore } from "../stores/app.store";
import { PlayerComponent } from "../components/player.component";
import { VBtn } from "vuetify/components/VBtn";
import { useTeamsStore } from "../stores/teams.store";
import { fieldPlayerSkills1, fieldPlayerSkills2, physicalSkills, type Player, type Skill } from "../types";
import { NButton, NCard, NH1, NH2, NSpace } from "naive-ui";

const GalleryPage = defineComponent({
  setup() {
    const teamStore = useTeamsStore();
    const authStore = useAppStore();
    const items = Array.from({ length: 250 }, (_, index) => index + 1);

    return () =>
      <div>
        <NSpace justify="center">
          <NH1>Обміни - Галерея</NH1>
        </NSpace>

        <NCard>{{
          header: () => "Картки які зараз шукають:",
          default: () => <>
            <NSpace>
              {items.map((id) => (
                <NButton key={id} size="tiny" secondary type="primary">{id}</NButton>
              ))}
            </NSpace>

            <NSpace>
              test
            </NSpace>
          </>

        }}

        </NCard>

        <br />

        <NSpace>
          <NH2>Картки які шукаю я:</NH2>
        </NSpace>
        <NSpace>
          {[123, 888, 999].map((id) => (
            <NButton secondary type="primary" key={id}>{id}</NButton>
          ))}
        </NSpace>

      </div>
  },
});

export { GalleryPage };
