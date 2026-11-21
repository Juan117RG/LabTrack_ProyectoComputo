<script setup lang="ts">
type Equipo = {
  id: string | number;
  name: string;
  description: string | null;
  status: string;
};

const {
  public: { apiBase },
} = useRuntimeConfig();
const url = `${apiBase.replace(/\/+$/, "")}/api/equipment`;
const { accessToken, restore, request, canManage } = useAuth();
const ready = ref(false);
useHead({ title: "Catálogo | LabTrack" });
onMounted(async () => {
  // Comprueba la sesión antes de pedir el catálogo protegido.
  try {
    if (!(await restore())) {
      await navigateTo("/login");
      return;
    }
    ready.value = true;
    await refresh();
  } catch {
    await navigateTo("/login");
  }
});
const { data, status, error, refresh } = await useAsyncData<{ data: Equipo[] }>(
  "equipment",
  () => request<{ data: Equipo[] }>(url),
  {
    server: false,
    immediate: false,
  },
);

const nombre = ref("");
const descripcion = ref("");
const guardando = ref(false);
const mensaje = ref("");
const errorGuardado = ref("");

const estados: Record<string, string> = {
  available: "Disponible",
  unavailable: "No disponible",
};

async function guardarEquipo() {
  const name = nombre.value.trim();
  if (!name || guardando.value || !data.value) {
    return;
  }

  guardando.value = true;
  mensaje.value = "";
  errorGuardado.value = "";

  try {
    // Agrega a la lista el equipo que confirma la API, con su identificador real.
    const { data: equipo } = await request<{ data: Equipo }>(url, {
      method: "POST",
      body: { name, description: descripcion.value.trim() || undefined },
    });
    data.value = { data: [...data.value.data, equipo] };
    nombre.value = "";
    descripcion.value = "";
    mensaje.value = "Equipo guardado.";
  } catch {
    errorGuardado.value = "No se pudo guardar el equipo. Intenta de nuevo.";
  } finally {
    guardando.value = false;
  }
}
</script>

<template>
  <main v-if="ready" class="mx-auto max-w-xl space-y-6 p-6">
    <header class="flex flex-wrap items-center justify-between gap-3">
      <h1 class="text-2xl font-bold">Catálogo de equipos</h1>
      <NuxtLink
        to="/prestamos"
        class="font-semibold text-blue-800 hover:underline"
        >Préstamos</NuxtLink
      >
      <NuxtLink
        to="/login"
        class="rounded font-semibold text-blue-800 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700"
      >
        Mi sesión
      </NuxtLink>
    </header>

    <form v-if="canManage" class="space-y-4" @submit.prevent="guardarEquipo">
      <label class="block">
        Nombre
        <input
          v-model="nombre"
          class="block w-full rounded border p-2"
          maxlength="20"
          required
        />
      </label>

      <label class="block">
        Descripción (opcional)
        <textarea
          v-model="descripcion"
          class="block w-full rounded border p-2"
          maxlength="200"
        ></textarea>
      </label>

      <button
        type="submit"
        class="rounded bg-blue-700 px-4 py-2 text-white disabled:opacity-50"
        :disabled="guardando || !data || !nombre.trim()"
      >
        {{ guardando ? "Guardando…" : "Guardar" }}
      </button>
      <p v-if="mensaje" role="status">{{ mensaje }}</p>
      <p v-if="errorGuardado" role="alert" class="text-red-700">
        {{ errorGuardado }}
      </p>
    </form>

    <p v-if="status === 'idle' || status === 'pending'" role="status">
      Cargando equipos…
    </p>
    <div v-else-if="error">
      <p role="alert" class="text-red-700">No se pudo cargar el catálogo.</p>
      <button type="button" class="text-blue-700 underline" @click="refresh()">
        Reintentar
      </button>
    </div>
    <ul v-else-if="data?.data.length" class="space-y-2">
      <li
        v-for="equipo in data.data"
        :key="equipo.id"
        class="rounded border p-3"
      >
        <strong>{{ equipo.name }}</strong>
        <p class="text-sm text-slate-600">
          Estado: {{ estados[equipo.status] ?? equipo.status }}
        </p>
        <p v-if="equipo.description">{{ equipo.description }}</p>
        <NuxtLink
          v-if="!canManage && equipo.status === 'available'"
          :to="{ path: '/prestamos', query: { equipo: String(equipo.id) } }"
          class="mt-3 inline-block rounded bg-blue-800 px-3 py-2 text-white"
          >Solicitar préstamo</NuxtLink
        >
      </li>
    </ul>
    <p v-else>Todavía no hay equipos registrados.</p>
  </main>
</template>
