// Для IDE без підтримки Vue SFC (Visual Studio). vue-tsc / Vue - Official у VS Code бачать справжні типи .vue
declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<{}, {}, any>;
  export default component;
}
