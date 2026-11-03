import { mdiCog, mdiGoogle } from "@mdi/js";
import { defineComponent } from "vue";
import { VBtn, VCard, VCardActions, VCardTitle, VCol, VIcon, VRow } from "vuetify/components";
import { useRoute } from "vue-router";

export default defineComponent({
  setup() {
    const route = useRoute();

    const onLoginGoogle = () => {
      const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/';
      window.location.href = `/api/auth/google-login?returnUrl=${encodeURIComponent(redirect)}`;
    };

    return () =>
      <VCard class="text-center mx-auto pa-2" width="400">
        <VCardTitle>Sign In</VCardTitle>
        <VCardActions class="d-flex justify-center">          
          <VBtn variant="outlined" block onClick={onLoginGoogle}>
            <VIcon icon={mdiGoogle} color="primary" class="mr-2" />
            Sign In with Google
          </VBtn>
        </VCardActions>
      </VCard>
  },
});
