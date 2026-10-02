import ReactDOM from 'react-dom';
import App from './App.jsx';

// React 16 and 17 hydrate through ReactDOM.hydrate; there is no hydrateRoot entry point.
const container = document.getElementById('root');
if (container.hasChildNodes()) {
  ReactDOM.hydrate(<App />, container);
} else {
  ReactDOM.render(<App />, container);
}
