import './style.css';
import Alpine from 'alpinejs';
import { createApp } from './app';

declare global {
  interface Window { Alpine: typeof Alpine; }
}

window.Alpine = Alpine;
Alpine.data('app', createApp);
Alpine.start();

export {};
