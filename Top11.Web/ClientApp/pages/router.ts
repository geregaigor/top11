import { createWebHistory, createRouter, useRouter } from 'vue-router';
import homePage from './home.page';
import loginPage from './login.page';
import accountPage from './account.page';
import { useAppStore } from '../stores/app.store';
import api from '../api';
import { TeamsCreatePage } from './teams/create.page';
import { useTeamsStore } from '../stores/teams.store';
import { TeamPage } from './teams/team.page';
import { GalleryPage } from './gallery.page';

const routes = [
  { path: '/', component: homePage, meta: { allowAnonymous: true } },
  { path: '/login', component: loginPage, meta: { allowAnonymous: true } },
  { path: '/account', component: accountPage, },
  { path: '/teams/create', component: TeamsCreatePage },
  { path: '/teams/:id', component: TeamPage, props: (route: any) => ({ key: 'team_' + route.params.id }) },
  { path: '/gallery', component: GalleryPage, meta: { allowAnonymous: true } }
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach(async (to, from) => {

  const appStore = useAppStore();
  const teamsStore = useTeamsStore();
  if (!appStore.isLoaded) {
    try {
      appStore.isLoading = true;
      const authDetails = await api.GetAuthDetails();
      appStore.$state.email = authDetails.email;
      appStore.$state.isAuthenticated = authDetails.isAuthenticated;
      appStore.$state.weekActiveUsers = authDetails.weekActiveUsers;

      if (authDetails.isAuthenticated) {
        await teamsStore.loadData();
      };
    } finally {
      appStore.isLoaded = true;
      appStore.isLoading = false;
    }
  }

  if (!to.meta.allowAnonymous && !appStore.isAuthenticated) {
    return { path: '/login', query: { redirect: to.fullPath }, }
  }

  if (to.path != '/account' && appStore.isAuthenticated && !appStore.isRegistrationComplete) {
    return { path: '/account', query: { redirect: to.fullPath }, }
  }
})

export default router;

export function useNavigation() {
  const router = useRouter();

  return {
    goToGallery() {
      router.push({
        path: "/gallery"
      });
    }
  };
}
