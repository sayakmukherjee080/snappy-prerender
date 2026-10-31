import { hydrate, render } from 'preact';
import App from './App.jsx';

const root = document.getElementById('root');
const wrapper = root?.firstElementChild ?? null;
const props = { initialHtml: wrapper?.innerHTML ?? '' };

if (wrapper) hydrate(<App {...props} />, root);
else render(<App {...props} />, root);
