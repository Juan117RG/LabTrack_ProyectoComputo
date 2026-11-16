# API de LabTrack

## Catálogo publicado

- `GET /api/health` comprueba que la API está activa.
- `GET /api/equipment` lista equipos. Acepta el filtro opcional `status` con
  `available` o `unavailable`.
- `POST /api/equipment` registra un equipo. Envía `name` y la descripción
  opcional `description`. Si se omite `status`, el equipo queda disponible.

La API devuelve el catálogo o el equipo guardado dentro de `data`.

## Préstamos en desarrollo

El PR #7 agregó rutas para listar, consultar, solicitar, aprobar y rechazar
préstamos. La creación recibe `user_id` y `equipment_id`. La aprobación marca el
equipo como no disponible.

- `GET /api/loans`
- `GET /api/loans/:id`
- `POST /api/loans`
- `PATCH /api/loans/:id/approve`
- `PATCH /api/loans/:id/reject`

Quedan pendientes la autenticación, la autorización por rol y las devoluciones.
