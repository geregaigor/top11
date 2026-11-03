import { defineComponent, onMounted, ref } from "vue";
import { useAppStore } from "../stores/app.store";
import { NButton, NFlex, NForm, NFormItem, NInput, NSpace, NText, useMessage } from 'naive-ui';

export default defineComponent({
  setup() {
    const authStore = useAppStore();
    const message = useMessage();

    const formData = ref({
      userCode: authStore.userCode,
    });

    const onSaveClick = () => {
      message.success('Дані успішно збережено \n' + JSON.stringify(formData.value));
    }

    return () =>

      <NForm label-placement="left" label-width="auto">
        <NFormItem label="authenticated">
          <NText>{authStore.isAuthenticated ? 'yes' : 'no'}</NText>
        </NFormItem>
        <NFormItem label="email">
          <NText>{authStore.email}</NText>
        </NFormItem>
        <NFormItem label="user code" >
          <NInput value={formData.value.userCode} onUpdate:value={(value) => formData.value.userCode = value} />
        </NFormItem>
        <NFlex justify="left">
          <NButton secondary strong type="success" size="large" onClick={onSaveClick}>
            Зберегти
          </NButton>
        </NFlex>
      </NForm>
  },
});
