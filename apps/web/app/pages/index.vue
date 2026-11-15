<script setup lang="ts">
import { ref } from 'vue'

const nombre = ref('')
const descripcion = ref('')

const equipos = ref([
  {
    id: 1,
    nombre: 'Proyector',
    descripcion: 'Equipo de ejemplo',
    estado: 'Disponible',
  },
  {
    id: 2,
    nombre: 'Microscopio',
    descripcion: 'En revisión',
    estado: 'En mantenimiento',
  },
])

function guardarEquipo() {
  const nombreLimpio = nombre.value.trim()

  if (!nombreLimpio) return

  equipos.value.push({
    id: equipos.value.length + 1,
    nombre: nombreLimpio,
    descripcion: descripcion.value.trim(),
    estado: 'Disponible',
  })

  nombre.value = ''
  descripcion.value = ''
}
</script>

<template>
  <main class="mx-auto max-w-xl space-y-6 p-6">
    <h1 class="text-2xl font-bold">Catálogo de equipos</h1>

    <form class="space-y-4" @submit.prevent="guardarEquipo">
      <label class="block">
        Nombre
        <input
          v-model="nombre"
          class="block w-full rounded border p-2"
          required
        />
      </label>

      <label class="block">
        Descripción (opcional)
        <textarea
          v-model="descripcion"
          class="block w-full rounded border p-2"
        ></textarea>
      </label>

      <button type="submit" class="rounded bg-blue-700 px-4 py-2 text-white">
        Guardar
      </button>
    </form>

    <ul class="space-y-2">
      <li
        v-for="equipo in equipos"
        :key="equipo.id"
        class="rounded border p-3"
      >
        <strong>{{ equipo.nombre }}</strong>
        <p class="text-sm text-slate-600">Estado: {{ equipo.estado }}</p>
        <p v-if="equipo.descripcion">{{ equipo.descripcion }}</p>
      </li>
    </ul>
  </main>
</template> 