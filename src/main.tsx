import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { initThemeSync } from './store/useThemeStore.ts';
import './index.css';

initThemeSync();

createRoot(document.getElementById('root')!).render(<App />);
