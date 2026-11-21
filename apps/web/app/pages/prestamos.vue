<script setup lang="ts">
type Equipment = { id: number; name: string; status: string };
type Loan = {
  id: number;
  user_id: number;
  equipment_id: number;
  status: string;
  requested_at: string;
};
const {
  public: { apiBase },
} = useRuntimeConfig();
const base = apiBase.replace(/\/+$/, "");
const { restore, request, canManage, sessionUser } = useAuth();
const route = useRoute();
const ready = ref(false);
const loading = ref(false);
const loadError = ref("");
const actionError = ref("");
const message = ref("");
const busy = ref(false);
const loans = ref<Loan[]>([]);
const equipment = ref<Equipment[]>([]);
const selected = ref("");
const filter = ref("");
const labels: Record<string, string> = {
  pending: "Pendiente",
  approved: "Aprobado",
  rejected: "Rechazado",
  returned: "Devuelto",
};
const isManager = computed(() => sessionUser.value?.role === "manager");
const visibleLoans = computed(() =>
  loans.value.filter((loan) => !filter.value || loan.status === filter.value),
);
const available = computed(() =>
  equipment.value.filter((item) => item.status === "available"),
);
const alreadyRequested = computed(() =>
  loans.value.some(
    (loan) =>
      String(loan.equipment_id) === selected.value &&
      ["pending", "approved"].includes(loan.status),
  ),
);
useHead({ title: "Préstamos | LabTrack" });

function equipmentName(id: number) {
  return (
    equipment.value.find((item) => String(item.id) === String(id))?.name ??
    `Equipo #${id}`
  );
}
function date(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? "Fecha no disponible"
    : parsed.toLocaleString("es-MX");
}
async function load() {
  if (loading.value) {
    return;
  }
  loading.value = true;
  loadError.value = "";
  try {
    // El estudiante consulta sus solicitudes; los encargados consultan la lista general.
    const [items, records] = await Promise.all([
      request<{ data: Equipment[] }>(`${base}/api/equipment`),
      request<{ data: Loan[] }>(
        `${base}/api/loans${canManage.value ? "" : "/myloans"}`,
      ),
    ]);
    equipment.value = items.data;
    loans.value = records.data;
  } catch {
    loadError.value = "No se pudieron cargar los préstamos. Intenta de nuevo.";
  } finally {
    loading.value = false;
  }
}
onMounted(async () => {
  try {
    if (!(await restore())) {
      await navigateTo("/login");
      return;
    }
    ready.value = true;
    await load();
    const requested =
      typeof route.query.equipo === "string" ? route.query.equipo : "";
    if (available.value.some((item) => String(item.id) === requested)) {
      selected.value = requested;
    }
  } catch {
    loadError.value =
      "No se pudo comprobar la sesión. Recarga la página para reintentar.";
  }
});
async function submit() {
  if (
    busy.value ||
    loading.value ||
    loadError.value ||
    alreadyRequested.value ||
    !sessionUser.value ||
    !available.value.some((item) => String(item.id) === selected.value)
  ) {
    return;
  }
  busy.value = true;
  actionError.value = "";
  message.value = "";
  try {
    // La API verifica que el solicitante coincida con el usuario autenticado.
    await request(`${base}/api/loans`, {
      method: "POST",
      body: {
        user_id: sessionUser.value.id,
        equipment_id: Number(selected.value),
      },
    });
    message.value = "Solicitud enviada. Un encargado debe revisarla.";
    selected.value = "";
    await load();
  } catch {
    actionError.value =
      "No se pudo enviar la solicitud. Actualiza la lista para comprobar la disponibilidad antes de reintentar.";
  } finally {
    busy.value = false;
  }
}
async function decide(loan: Loan, action: "approve" | "reject") {
  if (
    busy.value ||
    loading.value ||
    loadError.value ||
    !isManager.value ||
    loan.status !== "pending"
  ) {
    return;
  }
  busy.value = true;
  actionError.value = "";
  message.value = "";
  try {
    // Después de decidir, vuelve a consultar para mostrar el estado guardado en PostgreSQL.
    await request(`${base}/api/loans/${loan.id}/${action}`, {
      method: "PATCH",
    });
    message.value =
      action === "approve"
        ? "Préstamo aprobado. El equipo ya no está disponible."
        : "Solicitud rechazada.";
    await load();
  } catch {
    actionError.value =
      "No se pudo actualizar la solicitud. Actualiza la lista antes de reintentar.";
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <main class="mx-auto max-w-3xl space-y-6 p-6">
    <header class="flex flex-wrap items-center justify-between gap-4">
      <h1 class="text-2xl font-bold">{{
        canManage ? "Administrar préstamos" : "Mis préstamos"
      }}</h1>
      <nav aria-label="Navegación" class="flex gap-4 text-blue-800">
        <NuxtLink to="/catalogo">Catálogo</NuxtLink
        ><NuxtLink to="/login">Mi sesión</NuxtLink>
      </nav>
    </header>
    <p v-if="!ready && !loadError" role="status">Comprobando sesión…</p>
    <p v-if="loadError" role="alert" class="text-red-700">{{ loadError }}</p>
    <template v-if="ready">
      <form
        v-if="!canManage"
        class="space-y-4 rounded-xl border border-slate-300 p-5"
        @submit.prevent="submit"
      >
        <h2 class="text-lg font-bold">Solicitar un equipo</h2>
        <label class="block"
          >Equipo disponible
          <select
            v-model="selected"
            required
            :disabled="busy || loading || !!loadError"
            class="mt-2 block w-full rounded border p-2"
          >
            <option value="" disabled>Selecciona un equipo</option>
            <option
              v-for="item in available"
              :key="item.id"
              :value="String(item.id)"
              >{{ item.name }}</option
            >
          </select>
        </label>
        <p v-if="!loading && !loadError && !available.length"
          >No hay equipos disponibles por ahora.</p
        >
        <p v-if="alreadyRequested" role="status"
          >Ya tienes una solicitud pendiente o aprobada para este equipo.</p
        >
        <button
          type="submit"
          :disabled="
            busy || loading || !!loadError || !selected || alreadyRequested
          "
          class="rounded bg-blue-800 px-4 py-2 text-white disabled:opacity-50"
          >{{ busy ? "Enviando…" : "Enviar solicitud" }}</button
        >
      </form>
      <p v-if="sessionUser?.role === 'admin'" class="text-sm text-slate-600"
        >Puedes consultar todos los préstamos. Las aprobaciones y rechazos
        corresponden a la cuenta manager.</p
      >
      <p
        v-if="message"
        role="status"
        class="rounded bg-green-50 p-3 text-green-800"
        >{{ message }}</p
      >
      <p v-if="actionError" role="alert" class="text-red-700">{{
        actionError
      }}</p>
      <div class="flex flex-wrap items-end justify-between gap-4">
        <label
          >Filtrar por estado
          <select v-model="filter" class="ml-2 rounded border p-2"
            ><option value="">Todos</option
            ><option
              v-for="(label, value) in labels"
              :key="value"
              :value="value"
              >{{ label }}</option
            ></select
          >
        </label>
        <button
          type="button"
          :disabled="busy || loading"
          class="rounded border px-3 py-2 disabled:opacity-50"
          @click="load()"
          >Actualizar</button
        >
      </div>
      <p v-if="loading" role="status">Cargando préstamos…</p>
      <ul v-else-if="!loadError && visibleLoans.length" class="space-y-3">
        <li
          v-for="loan in visibleLoans"
          :key="loan.id"
          class="space-y-2 rounded-xl border border-slate-300 p-5"
        >
          <div class="flex flex-wrap justify-between gap-2"
            ><h2 class="font-bold">{{ equipmentName(loan.equipment_id) }}</h2
            ><span>{{ labels[loan.status] ?? loan.status }}</span></div
          >
          <p class="text-sm text-slate-600"
            >Solicitud #{{ loan.id }} · {{ date(loan.requested_at) }}</p
          >
          <p v-if="canManage" class="text-sm"
            >Solicitante #{{ loan.user_id }}</p
          >
          <div
            v-if="isManager && loan.status === 'pending'"
            class="flex gap-3 pt-2"
          >
            <button
              type="button"
              :disabled="busy"
              class="rounded bg-blue-800 px-4 py-2 text-white disabled:opacity-50"
              @click="decide(loan, 'approve')"
              >Aprobar</button
            >
            <button
              type="button"
              :disabled="busy"
              class="rounded border border-red-700 px-4 py-2 text-red-700 disabled:opacity-50"
              @click="decide(loan, 'reject')"
              >Rechazar</button
            >
          </div>
        </li>
      </ul>
      <p v-else-if="!loading && !loadError"
        >No hay solicitudes {{ filter ? "con ese estado" : "todavía" }}.</p
      >
    </template>
  </main>
</template>
