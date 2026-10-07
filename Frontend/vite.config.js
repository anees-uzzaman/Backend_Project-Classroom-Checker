import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { webcrypto } from 'node:crypto'

// Fallback Polyfill for older Node.js on older macOS versions
if (typeof globalThis.crypto === 'undefined') {
  globalThis.crypto = webcrypto;
} else if (typeof globalThis.crypto.getRandomValues === 'undefined') {
  globalThis.crypto.getRandomValues = webcrypto.getRandomValues.bind(webcrypto);
}

// https://vite.dev
export default defineConfig({
  plugins: [react()],
})
