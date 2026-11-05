import { computed, defineComponent, onMounted, ref, Transition, watch } from 'vue';
import { VApp, VAppBar, VAppBarTitle, VBtn, VDivider, VList, VListItem, VMain, VNavigationDrawer, VOverlay, VProgressCircular, VSpacer, } from 'vuetify/components';
import { useAppStore } from '../stores/app.store';
import api from '@/api';
import { RouterView, useRouter, useRoute } from 'vue-router';
import { mdiLogoutVariant, mdiLoginVariant, mdiCog, mdiMenu } from '@mdi/js';
import { useTeamsStore } from '../stores/teams.store';
import { NConfigProvider, darkTheme, NButton, NTooltip, NMessageProvider, useMessage } from 'naive-ui';
import type { GlobalThemeOverrides } from 'naive-ui';

// Палітра naive-ui = палітра Vuetify (main.ts), щоб primary/success/... були однакові
const themeOverrides: GlobalThemeOverrides = {
  common: {
    primaryColor: 'rgb(119, 107, 231)',
    primaryColorHover: 'rgb(151, 141, 236)',
    primaryColorPressed: 'rgb(90, 75, 226)',
    primaryColorSuppl: 'rgb(151, 141, 236)',
    successColor: 'rgb(11, 186, 131)',
    successColorHover: 'rgb(13, 222, 156)',
    successColorPressed: 'rgb(9, 154, 108)',
    successColorSuppl: 'rgb(13, 222, 156)',
    warningColor: 'rgb(255, 168, 0)',
    warningColorHover: 'rgb(255, 182, 36)',
    warningColorPressed: 'rgb(214, 143, 0)',
    warningColorSuppl: 'rgb(255, 182, 36)',
    errorColor: 'rgb(246, 78, 98)',
    errorColorHover: 'rgb(248, 119, 134)',
    errorColorPressed: 'rgb(244, 47, 70)',
    errorColorSuppl: 'rgb(248, 119, 134)',
    infoColor: 'rgb(50, 153, 255)',
    infoColorHover: 'rgb(92, 173, 255)',
    infoColorPressed: 'rgb(10, 133, 255)',
    infoColorSuppl: 'rgb(92, 173, 255)',
  },
  // чекбокси — зелені, а не primary
  Checkbox: {
    colorChecked: 'rgb(13, 222, 156)',
    borderChecked: '1px solid rgb(13, 222, 156)',
    borderFocus: '1px solid rgb(13, 222, 156)',
    boxShadowFocus: '0 0 0 2px rgba(13, 222, 156, 0.3)',
    checkMarkColor: 'rgb(39, 39, 47)',
  },
};
import { useNavigation } from './router';
import { useDisplay } from 'vuetify';
import styles from './_layout.module.css';

export default defineComponent({
  setup() {
    const appStore = useAppStore();
    const router = useRouter();

    return () => (
      <NConfigProvider theme={darkTheme} themeOverrides={themeOverrides}>
        <NMessageProvider>
          <VApp>
            <VAppBar>
              <VBtn icon={mdiMenu} onClick={() => appStore.drawer = !appStore.drawer} />
              <VAppBarTitle class="cursor-pointer" onClick={() => router.push("/")}>
                <span class={styles.brand}><img src="/favicon.svg" alt="" class={styles.brandLogo} />Top11</span>
              </VAppBarTitle>

              <VSpacer />
              {appStore.isAuthenticated && <>
                <VBtn to="/account" icon={mdiCog} class="mx-1 mx-md-2" />
              </>}

              <VDivider vertical />
              <LoginBtn class="mx-1 mx-md-4" />
            </VAppBar>
            <Navigation />
            <VMain>
              <SaveChangesBar />
              <div class="pa-2 pa-md-4">
                <RouterView />
              </div>
              <LoadingOverlay />
            </VMain>
          </VApp>
        </NMessageProvider>
      </NConfigProvider>
    );
  }
});

const LoginBtn = defineComponent({
  setup() {
    const appStore = useAppStore();
    const { smAndDown } = useDisplay();
    const onLogout = async () => {
      await api.PostAuthLogout();
      window.location.href = "/";
    }
    return () => {
      if (smAndDown.value)
        return appStore.isAuthenticated
          ? <VBtn icon={mdiLogoutVariant} onClick={onLogout} />
          : <VBtn icon={mdiLoginVariant} to="/login" />;
      return appStore.isAuthenticated
        ? <VBtn variant="outlined" appendIcon={mdiLogoutVariant} onClick={onLogout}>Logout</VBtn>
        : <VBtn variant="outlined" appendIcon={mdiLoginVariant} to="/login">Login</VBtn>;
    }
  }
});

const LoadingOverlay = defineComponent({
  setup() {
    const appStore = useAppStore();

    return () =>
      <VOverlay class="align-center justify-center" modelValue={appStore.isLoading} onUpdate:modelValue={() => { }} >
        <VProgressCircular color="primary" size="64" indeterminate>
        </VProgressCircular>
      </VOverlay>
  }
});

const Navigation = defineComponent({
  setup() {
    const route = useRoute();
    const appStore = useAppStore();
    const teamsStore = useTeamsStore();
    const navigation = useNavigation();
    const router = useRouter();
    const { mdAndUp } = useDisplay();
    const { hasChanges, saving, save } = useSaveChanges();
    const teams = computed(() => {
      return teamsStore.teams.map(t => ({ title: t.name, to: `/teams/${t.id}` }));
    })

    // версія розширення, опублікованого на сайті (оболонка) — для пункту меню
    const extVersion = ref('');
    onMounted(async () => {
      try {
        const r = await fetch('/ext/code/payload.json', { cache: 'no-store' });
        if (!r.ok) return;
        const { manifest } = await r.json() as { manifest: string };
        extVersion.value = (JSON.parse(manifest) as { shell?: { latest?: string } }).shell?.latest ?? '';
      } catch { /* не опубліковано — без версії */ }
    });

    watch(
      () => teamsStore.teams,
      () => { teamsStore.saved = false; },
      { deep: true }
    );

    watch(() => route.path, () => { if (!mdAndUp.value) appStore.drawer = false; });

    return () => (
      <VNavigationDrawer v-model={appStore.drawer} permanent={mdAndUp.value} temporary={!mdAndUp.value}>
        <VList density="compact" nav>

          <NTooltip trigger="hover">
            {{
              trigger: () => <NButton block secondary type="primary" onClick={() => navigation.goToGallery()}>Обміни - Галерея</NButton>,
              default: () => (
                <>
                  Помічник для обміну картками гравців
                </>
              ),
            }}
          </NTooltip>
          {appStore.isAuthenticated && <NButton block secondary type="info" class="mt-2" onClick={() => router.push('/ext')}>
            Розширення Chrome<span class={styles.newBadge}>new</span>{extVersion.value && <span class={styles.extVersion}>v{extVersion.value}</span>}
          </NButton>}
          <br />

          {teams.value.map(t => {
            const isActive = route.path.startsWith(t.to);
            return <><VListItem to={t.to} title={t.title} key={t.to} active={isActive}></VListItem><VDivider /></>
          })}
          {mdAndUp.value && hasChanges.value &&
            <VListItem class="text-capitalize text-center" title="Зберегти зміни" color="success" base-color="success" variant="outlined" disabled={saving.value} onClick={save}></VListItem>}
          <VListItem class="text-capitalize text-center" variant="outlined" to="/teams/create" title="Створити команду"></VListItem>

          
        </VList>
      </VNavigationDrawer>
    );
  }
});

function useSaveChanges() {
  const appStore = useAppStore();
  const teamsStore = useTeamsStore();
  const message = useMessage();

  const hasChanges = computed(() => appStore.isAuthenticated && teamsStore.loaded && !teamsStore.saved);

  const save = async () => {
    if (saving.value) return;
    try {
      saving.value = true;
      await teamsStore.save();
      message.success('Зміни збережено');
    } catch {
      message.error('Не вдалося зберегти зміни');
    } finally {
      saving.value = false;
    }
  };

  return { hasChanges, saving, save };
}

// спільний стан збереження
const saving = ref(false);

const SaveChangesBar = defineComponent({
  setup() {
    const { hasChanges, saving, save } = useSaveChanges();
    const { mdAndUp } = useDisplay();
    // плаваюча кнопка — тільки на мобілці; на десктопі кнопка в меню
    const visible = computed(() => hasChanges.value && !mdAndUp.value);

    return () => (<>
      {visible.value && <div class={styles.saveBarSpacer} />}
      <Transition
        enterFromClass={styles.saveBarHidden}
        leaveToClass={styles.saveBarHidden}
        enterActiveClass={styles.saveBarAnim}
        leaveActiveClass={styles.saveBarAnim}
      >
        {visible.value && <div class={styles.saveBar}>
          <NButton type="success" ghost strong loading={saving.value} onClick={save} class={styles.saveBarBtn}>
            Зберегти зміни
          </NButton>
        </div>}
      </Transition>
    </>);
  }
});
