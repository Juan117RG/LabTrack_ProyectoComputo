# LabTrack

Sistema universitario de préstamo y devolución de equipos. **Este repositorio es una base inicial, no el MVP completo.**

## Inicio local

Requiere Docker Desktop. Ejecuta `docker compose up --build`.

- Frontend: http://localhost:3000
- API: http://localhost:3001/api/health
- PostgreSQL: puerto 5432 (solo desarrollo)

La migración inicial se ejecuta al crear el volumen de base de datos. La API todavía no consulta PostgreSQL: implementar las rutas y servicios en la segunda etapa.

## GitHub

Trabajar con `master`, `develop` y ramas `feature/*`. Crear PR a develop, solicitar revisión y verificar CI.

## Despliegue

`render.yaml` es una base de configuración para API. Para Netlify con Nuxt SSR se debe configurar el adaptador y publicación correspondiente; el archivo `netlify.toml` es preliminar y requiere validación antes del despliegue. Configurar variables de entorno reales sin subir secretos.
