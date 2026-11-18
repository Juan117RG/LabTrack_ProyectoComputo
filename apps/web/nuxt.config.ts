import tailwindcss from '@tailwindcss/vite'
export default defineNuxtConfig({ compatibilityDate: '2025-07-01', modules: ['@pinia/nuxt'], css: ['~/assets/css/main.css'], vite: { plugins: [tailwindcss()] }, runtimeConfig: { authApiBase: '', public: { apiBase: 'http://localhost:3001' } } })
