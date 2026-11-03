import { getHours, getMinutes, getSeconds, setHours, setMinutes, setSeconds } from "date-fns";
import { computed, defineComponent } from "vue";
import { VNumberInput } from "vuetify/labs/components";

const TimePickerComponent = defineComponent({
  props: {
    modelValue: {
      type: Date,
      required: true,
      default: () => new Date(),
    },
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    const hours = computed({
      get() { return getHours(props.modelValue) },
      set(value) { emit('update:modelValue', setHours(props.modelValue, value)) },
    });
    const minutes = computed({
      get() { return getMinutes(props.modelValue) },
      set(value) { emit('update:modelValue', setMinutes(props.modelValue, value)) },
    });
    const seconds = computed({
      get() { return getSeconds(props.modelValue) },
      set(value) { emit('update:modelValue', setSeconds(props.modelValue, value)) },
    });

    return () => <div>

      <div class="d-flex" style="width: 280px;">
        <VNumberInput v-model={hours.value} controlVariant="stacked" min={0} max={23} hideDetails />
        <span class="text-center" style="font-size: 36px;">:</span>
        <VNumberInput v-model={minutes.value} controlVariant="stacked" min={0} max={59} hideDetails />
        <span class="text-center" style="font-size: 36px;">:</span>
        <VNumberInput v-model={seconds.value} controlVariant="stacked" min={0} max={59} hideDetails />
      </div>
    </div>
  },
});

export { TimePickerComponent }
