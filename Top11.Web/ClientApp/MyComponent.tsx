import { defineComponent, onMounted, ref, defineProps} from 'vue';

interface Props {
  foo: string
  bar?: number
}

export default defineComponent<Props>({
  name: 'MyComponent',  
  setup(props) {

    // Define reactive state
    const count = ref(0);

    // Function to increment count
    const increment = () => {
      count.value++;
    };


    onMounted(() => {
      console.log('Component!!! is mounted')
    });






    // JSX template
    return () => (
      <div>
        <h1>Name: {props.foo}</h1>
        {/*<p>{props.foo}</p>*/}
        {/*<p>{props.bar}</p>*/}
        <h2>Counter: {count.value}</h2>
        <button onClick={increment}>Increment</button>
      </div>
    );
  },
});