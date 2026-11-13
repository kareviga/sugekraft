import 'leaflet/dist/leaflet.css';
import './styles.css';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { applyTheme } from './lib/theme';
import { applyFirmaParam } from './lib/firma';

// Farger fra firmaoppsettet blir CSS-variabler (oppdateres når firmaet lastes fra Supabase)
applyFirmaParam();
applyTheme();

createRoot(document.getElementById('root')!).render(<App />);
