import axios from 'axios';
import type { Team } from './types';

const api = {
  async GetAuthDetails() {
    return (await axios.get<{ email: string, isAuthenticated: boolean, weekActiveUsers: number }>('/api/auth/details')).data;
  },
  async PostAuthLogout() {
    await axios.post('/api/auth/logout');
  },
  async GetTeams(): Promise<Team[]> {
    var res = await axios.get<Array<Team>>('/api/teams');
    return res.data;
  },
  async SaveTeams(teams: Team[]) {
    // бекенд зберігає значення скілів як int — дробову частину обрізаємо тільки у запиті,
    // на фронті значення лишаються дробовими
    const payload = teams.map(team => ({
      ...team,
      players: team.players.map(player => ({
        ...player,
        skills: player.skills.map(skill => ({ ...skill, value: Math.trunc(+skill.value || 0) })),
      })),
    }));
    await axios.put('/api/teams', payload);
  },
}

export default api;
