import { createApp } from 'vue';

// Vuetify
import 'vuetify/styles'
import { createVuetify } from 'vuetify';

import App from './App';

var app = createApp(App);

const vuetify = createVuetify({ theme: { defaultTheme: 'dark' } });
app.use(vuetify);

app.mount("#app");


