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

## Cuentas iniciales de admin y manager

El registro público crea estudiantes. Las cuentas privilegiadas se crean con
un script manual, después de aplicar las migraciones 001 a 004. El script no
cambia roles, contraseñas ni el estado de usuarios existentes. Si un correo ya
pertenece a un usuario de otro rol o desactivado, cancela toda la operación.

En una terminal PowerShell, desde la raíz, define la conexión de la base que
quieres preparar y los cuatro valores privados. Las contraseñas deben ser
distintas, de al menos 16 caracteres y como máximo 72 bytes. No uses los valores
de ejemplo como contraseñas ni guardes secretos en archivos versionados.

```powershell
$env:DATABASE_URL = 'CONEXION_DE_LA_BASE'
$env:SEED_ADMIN_EMAIL = 'admin@labtrack.local'
$env:SEED_MANAGER_EMAIL = 'manager@labtrack.local'
# Define SEED_ADMIN_PASSWORD y SEED_MANAGER_PASSWORD de forma privada.
npm --prefix apps/api run db:seed
```

También puedes definirlos en `apps/api/.env` (ignorado por Git) y ejecutar
`npm run db:seed` desde `apps/api`. No es necesario mantener las variables SEED
en Render ni ejecutar el script al arrancar la API. Repetirlo conserva las
cuentas y sus contraseñas. Usa estos correos y sus contraseñas en `/login`.

## Pantallas de préstamos

Desde el catálogo, abre **Préstamos**. Un estudiante puede elegir un equipo
disponible, enviar su solicitud y consultar sus propios estados. El botón
**Solicitar préstamo** del catálogo también lleva al formulario con el equipo
seleccionado. La pantalla evita repetir una solicitud propia pendiente o aprobada.

Con una cuenta `manager`, la misma página muestra todas las solicitudes y permite
aprobar o rechazar las pendientes. Al aprobar, la API marca el equipo como no
disponible. Usa **Actualizar** para consultar cambios de otras sesiones y el
selector para filtrar por estado. El admin consulta todos los préstamos; la API
actual reserva aprobar y rechazar al rol `manager`.

Para la demostración, abre dos navegadores o perfiles: uno con el estudiante y
otro con el manager. Solicita un equipo con el primero, apruébalo con el segundo
y actualiza la lista del estudiante. Las devoluciones todavía no tienen una
acción implementada. La API debe reforzar la aprobación simultánea de solicitudes
del mismo equipo y la prevención de solicitudes duplicadas; la validación visual
no reemplaza esas comprobaciones en el servidor.
