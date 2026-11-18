# LabTrack

Sistema universitario de préstamo y devolución de equipos.

## Avance publicado

- [Catálogo en Netlify](https://labtrack-computo.netlify.app/)
- [Catálogo de la API en Render](https://labtrack-api-tdo1.onrender.com/api/equipment)
- [Estado de la API](https://labtrack-api-tdo1.onrender.com/api/health)

Para probar el avance, registra un equipo desde Netlify y recarga la página. El
registro debe seguir visible porque se guarda en PostgreSQL.

## Inicio local

Abre Docker Desktop y ejecuta `docker compose up --build` desde la raíz del
repositorio. Abre el [frontend local](http://localhost:3000) o consulta el
[catálogo de la API local](http://localhost:3001/api/equipment). Compose aplica
las migraciones cuando crea el volumen de PostgreSQL por primera vez.

## GitHub

Crea ramas de trabajo desde `develop` y abre un PR hacia `develop`. Pide revisión
a tu compañero y verifica el CI. Para publicar, abre un PR de `develop` hacia
`master`.

## Despliegue

Netlify publica el frontend y usa `NUXT_PUBLIC_API_BASE` para acceder a la API.
Render ejecuta `docker/api.Dockerfile`. Configura `DATABASE_URL` con la conexión
interna de PostgreSQL y `CORS_ORIGIN` con el dominio público de Netlify.

## Actualizar una base de datos existente

Docker ejecuta las migraciones de inicio cuando crea el volumen. Si tu volumen
ya existía, ejecuta la migración 002 con el servicio `db` encendido, desde la raíz
del repositorio en PowerShell:

```powershell
Get-Content -Raw database/migrations/002_equipment_availability.sql |
  docker compose exec -T db psql -v ON_ERROR_STOP=1 -U labtrack -d labtrack
```

En Render, ejecuta el mismo archivo SQL en PostgreSQL antes de desplegar la API
actualizada. La migración conserva los equipos y convierte el estado anterior
`maintenance` a `unavailable`.

## Inicio de sesión

Para probarlo localmente, define `JWT_SECRET` en el archivo `.env` de la raíz con
un secreto aleatorio de al menos 64 bytes. Si la base local ya tenía datos,
aplica la migración 003 antes de probar el formulario:

```powershell
Get-Content -Raw database/migrations/003_user_sessions.sql |
  docker compose exec -T db psql -v ON_ERROR_STOP=1 -U labtrack -d labtrack
```

La pantalla `/login` usa rutas del mismo dominio en Nuxt. Esto permite que
el navegador envíe la cookie de renovación HttpOnly sin compartirla con
otro dominio. En Docker, Nuxt usa `NUXT_AUTH_API_BASE` como dirección interna
de Express. En Netlify puedes definir esa variable con la URL HTTPS de la API.
En Render, configura `JWT_SECRET`, `NODE_ENV=production` y aplica la migración
003 antes de desplegar los cambios de autenticación.
