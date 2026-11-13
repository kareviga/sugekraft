import 'leaflet/dist/leaflet.css';
import './styles.css';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { applyTheme } from './lib/theme';

// Farger fra firmaoppsettet blir CSS-variabler (oppdateres når firmaet lastes fra Supabase)
applyTheme();

createRoot(document.getElementById('root')!).render(<App />);
