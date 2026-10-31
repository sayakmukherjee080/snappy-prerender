import { mount } from 'svelte';
import App from './App.svelte';

const root = document.getElementById('root');

// Svelte mounts beside existing children instead of adopting prerendered markup, so clear
// the prerendered shell first or the booted app would append a second copy of the page.
root.replaceChildren();
mount(App, { target: root });
