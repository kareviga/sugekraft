import 'leaflet/dist/leaflet.css';
import './styles.css';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { config } from './config';

// Farger fra konfigurasjonen blir CSS-variabler
const root = document.documentElement.style;
Object.entries(config.colors).forEach(([k, v]) => root.setProperty(`--${k}`, v));
document.title = `${config.appName} · ${config.company.name}`;

createRoot(document.getElementById('root')!).render(<App />);
