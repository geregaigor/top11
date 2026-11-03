import { createApp } from 'vue';
// vuetify
import 'vuetify/styles';
import '@mdi/font/css/materialdesignicons.css';
import './main.css';
import { aliases, mdi } from 'vuetify/iconsets/mdi-svg';
import { createVuetify } from 'vuetify';

import { createPinia } from 'pinia';
import router from './pages/router';
import App from './pages/_layout';

var app = createApp(App);

const myTheme =
//{
//  dark: true,
//  colors: {
//    background: 'rgba(39,39,47,1)',  // Темний чорний фон
//    surface: 'rgba(66,66,66,1)',     // Темна поверхня
//    primary: 'rgba(119,107,231,1)',  // Основний колір (Primary)
//    'primary-darken-1': 'rgba(89,74,226,1)', // Світліший відтінок Primary
//    secondary: 'rgba(255,64,129,1)', // Вторинний колір (Secondary)
//    'secondary-darken-1': 'rgba(205,52,104,1)', // Світліший відтінок Secondary
//    info: 'rgba(50,153,255,1)',      // Інформаційний колір (Info)
//    success: 'rgba(11,186,131,1)',   // Колір успіху (Success)
//    warning: 'rgba(255,183,77,1)',   // Колір попередження (Warning)
//    error: 'rgba(229,57,53,1)',      // Колір помилки (Error)
//    black: 'rgba(39,39,47,1)',       // Чорний
//    white: 'rgba(255,255,255,1)',    // Білий
//  },
//  variables: {
//    'border-color': 'rgba(255,255,255,0.12)',  // Напівпрозорі рамки
//    'high-emphasis-opacity': 0.87,
//    'medium-emphasis-opacity': 0.60,
//    'disabled-opacity': 0.38,
//    'idle-opacity': 0.04,
//    'hover-opacity': 0.08,
//    'focus-opacity': 0.12,
//    'selected-opacity': 0.08,
//    'activated-opacity': 0.12,
//    'pressed-opacity': 0.16,
//    'dragged-opacity': 0.08,
//  }
//}

{
  dark: true,
  colors: {
    background: 'rgba(39, 39, 47, 1)',        // Black (background)
    surface: 'rgba(56, 56, 67, 1)',          // Dark lighten
    primary: 'rgba(119, 107, 231, 1)',       // Primary
    'primary-darken-1': 'rgb(90, 75, 226)',  // Primary darken
    'primary-lighten-1': 'rgb(151, 141, 236)', // Primary lighten
    secondary: 'rgba(255, 64, 129, 1)',      // Secondary
    'secondary-darken-1': 'rgb(255, 31, 105)', // Secondary darken
    'secondary-lighten-1': 'rgb(255, 102, 153)', // Secondary lighten
    tertiary: 'rgba(30, 200, 165, 1)',       // Tertiary
    'tertiary-darken-1': 'rgb(25, 169, 140)', // Tertiary darken
    'tertiary-lighten-1': 'rgb(42, 223, 187)', // Tertiary lighten
    info: 'rgba(50, 153, 255, 1)',           // Info
    'info-darken-1': 'rgb(10, 133, 255)',    // Info darken
    'info-lighten-1': 'rgb(92, 173, 255)',   // Info lighten
    success: 'rgba(11, 186, 131, 1)',        // Success
    'success-darken-1': 'rgb(9, 154, 108)',  // Success darken
    'success-lighten-1': 'rgb(13, 222, 156)', // Success lighten
    warning: 'rgba(255, 168, 0, 1)',         // Warning
    'warning-darken-1': 'rgb(214, 143, 0)',  // Warning darken
    'warning-lighten-1': 'rgb(255, 182, 36)', // Warning lighten
    error: 'rgba(246, 78, 98, 1)',           // Error
    'error-darken-1': 'rgb(244, 47, 70)',    // Error darken
    'error-lighten-1': 'rgb(248, 119, 134)', // Error lighten
    black: 'rgba(39, 39, 47, 1)',            // Black
    white: 'rgba(255, 255, 255, 1)',         // White
    'on-primary': 'rgba(255, 255, 255, 1)',  // Text on primary
    'on-secondary': 'rgba(255, 255, 255, 1)', // Text on secondary
    'on-tertiary': 'rgba(255, 255, 255, 1)',  // Text on tertiary
    'on-info': 'rgba(255, 255, 255, 1)',      // Text on info
    'on-success': 'rgba(255, 255, 255, 1)',   // Text on success
    'on-warning': 'rgba(255, 255, 255, 1)',   // Text on warning
    'on-error': 'rgba(255, 255, 255, 1)',     // Text on error
  },
};

const vuetify = createVuetify({
  theme: { defaultTheme: 'myTheme', themes: { myTheme, }, },
  icons: { defaultSet: 'mdi', aliases, sets: { mdi } },
});
app.use(vuetify);

const pinia = createPinia()
app.use(pinia);

app.use(router);

app.mount("#app");


