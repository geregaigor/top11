import { defineComponent } from "vue";
import { NIcon } from "naive-ui";

/** Іконка з @mdi/js у форматі naive-ui: <MdiIcon path={mdiPlus} /> */
export const MdiIcon = defineComponent({
  props: {
    path: { type: String, required: true },
    size: { type: [Number, String], default: undefined },
  },
  setup(props) {
    return () => <NIcon size={props.size}>
      <svg viewBox="0 0 24 24"><path fill="currentColor" d={props.path} /></svg>
    </NIcon>;
  },
});
