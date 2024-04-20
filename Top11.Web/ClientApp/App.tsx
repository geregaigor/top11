import { defineComponent, onMounted, ref } from 'vue';
import { VApp, VAppBar, VMain, VNavigationDrawer } from 'vuetify/components';
import MyComponent from './MyComponent';

export default defineComponent({
  setup() {
    // Define reactive state
    const count = ref(0);

    // Function to increment count
    const increment = () => {
      count.value++;
    };

    onMounted(() => {
      console.log('Component is mounted');
    });

    return () => (
      <VApp>
        <VAppBar title="Title2"></VAppBar>
        <VNavigationDrawer></VNavigationDrawer>
        <VMain>
          Main content
          <h2>Counter: {count.value}</h2>
          <button onClick={increment}>Increment</button>
          <br />
          <MyComponent foo="test_name" />
        </VMain>
      </VApp>
    );
  }
});
