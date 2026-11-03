import { defineComponent } from "vue";
import { VBtn, VCard, VCardActions, VCardTitle, VContainer, VForm, VTextField } from "vuetify/components";
import { useForm } from 'vee-validate';
import { object, string } from 'zod';
import { toTypedSchema } from '@vee-validate/zod';
import axios from "axios";
import { useTeamsStore } from "../../stores/teams.store";
import { useRouter } from "vue-router";

const schema = object({
  name: string(),
});

const vuetifyConfig = (state: any) => ({
  props: {
    'error-messages': state.errors,
  },
});

export const TeamsCreatePage = defineComponent({
  setup() {
    const teamsStore = useTeamsStore();
    const router = useRouter();

    const { defineField, handleSubmit } = useForm({ validationSchema: toTypedSchema(schema) });
    const [name, nameAttrs] = defineField('name', vuetifyConfig);

    const onSubmit = handleSubmit(async (values, ctx) => {
      try {
        const team = await axios.post<{ id: number; name: string }>('/api/teams', values);
        await teamsStore.loadData();
        router.push(`/teams/${team.data.id}`);
      }
      catch (ex: any) {
        ctx.setErrors(ex.response.data.errors);
      }
    });

    return () => <VContainer>
      <VForm onSubmit={onSubmit}>
        <VCard>
          <VCardTitle>Create Team</VCardTitle>
          <VTextField {...nameAttrs.value} v-model={name.value} label="Name" />
          <VCardActions>
            <VBtn {...{ type: 'submit' }} variant="flat" text="Create Team"></VBtn>
          </VCardActions>
        </VCard>
      </VForm>
    </VContainer>
  },
});
