import { render } from 'solid-js/web';
import App from './App.jsx';

const root = document.getElementById('root');

// Solid mounts beside existing children instead of adopting prerendered markup, so clear
// the prerendered shell first or the booted app would append a second copy of the page.
root.replaceChildren();
render(() => <App />, root);
