import 'vue';

declare module 'vue' {
  export interface AllowedComponentProps {
    onClick?: (MouseEvent: MouseEvent) => void;
    tabindex?: number;
  }
}
