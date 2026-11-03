import { defineStore } from "pinia";
import api from '../api';
import type { Team } from "../types";
import { nextTick, toRaw, watch } from "vue";

export const useTeamsStore = defineStore('teams', {
  state: () => {
    return {
      loading: false,
      loaded: false,
      teams: [] as Array<Team>,
      saved: true,
    }
  },
  getters: {

  },
  actions: {
    deleteTeam(teamId: number) {
      this.teams = this.teams.filter(t => t.id != teamId);
    },
    async save() {
      this.teams.forEach((team) => team.players.forEach((player, index) => player.sortOrder = index));
      await api.SaveTeams(toRaw(this.teams));
      this.saved = true;
    },
    async loadData() {
      if (this.loading)
        return;
      try {
        this.loading = true;
        const teams = await api.GetTeams();
        teams.forEach(team => team.players.sort((a, b) => a.sortOrder - b.sortOrder));
        this.teams = teams;
        this.loaded = true;
        await nextTick();
        this.saved = true;
      } finally {
        this.loading = false;
      }
    },
    deletePlayer(playerId: number) {
      this.teams.forEach(t => t.players = t.players.filter(p => p.id !== playerId));
    },
    reorderPlayer(playerId: number, direction: "up" | "down") {
      for (const team of this.teams) {
        const player = team.players.find(p => p.id === playerId);
        if (!player) continue;

        const currentOrder = player.sortOrder;
        const newOrder = direction === "up" ? currentOrder - 1 : currentOrder + 1;

        if (newOrder < 0 || newOrder >= team.players.length) return;

        const targetPlayer = team.players.find(p => p.sortOrder === newOrder);
        if (!targetPlayer) return;

        player.sortOrder = newOrder;
        targetPlayer.sortOrder = currentOrder;

        team.players.sort((a, b) => a.sortOrder - b.sortOrder);
        return;
      }
    }
  }
});


