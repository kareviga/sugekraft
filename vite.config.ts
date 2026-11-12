import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base: './' gjør at bygget (dist/) kan legges hvor som helst, også i en undermappe.
export default defineConfig({
  base: './',
  plugins: [react()],
});
