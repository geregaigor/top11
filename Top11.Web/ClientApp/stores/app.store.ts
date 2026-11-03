import { defineStore } from "pinia";

export const useAppStore = defineStore('auth', {
  state: () => {
    return {
      isLoading: false,
      isLoaded: false,
      isAuthenticated: false,
      isRegistrationComplete: true,
      email: '',
      drawer: window.innerWidth >= 960,
      weekActiveUsers: 0,
      userCode: 'test user code',
    }
  },
  getters: {
    
  },
  actions: {

  }
});
