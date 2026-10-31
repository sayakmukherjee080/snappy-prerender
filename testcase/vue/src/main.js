import { createSSRApp } from 'vue';
import '../../shared/styles/site.css';
import App from './App.vue';

const root = document.getElementById('root');
const initialHtml = root?.firstElementChild?.innerHTML ?? '';

createSSRApp(App, { initialHtml }).mount(root);
