import { render } from 'preact';
import { App } from './components/App';
import SettingsWindowApp from './components/Settings/SettingsWindowApp';
import './global.css';

const params = new URLSearchParams(window.location.search);
const view = params.get('view');
const initialTab = params.get('tab');
const appRoot = document.getElementById('app');

if (!appRoot) {
	throw new Error('Renderer root element was not found.');
}

render(
	view === 'settings'
		? <SettingsWindowApp initialTab={initialTab} />
		: <App />,
	appRoot,
);
