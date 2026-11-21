<script setup lang="ts">
type TokenResponse = { data: { accessToken: string } };

const route = useRoute();
const email = ref("");
const password = ref("");
const showPassword = ref(false);
const busy = ref(false);
const errorMessage = ref("");
const accessToken = useState<string | null>("access-token", () => null);
const checkingSession = ref(true);

useHead({ title: "Iniciar sesión | LabTrack" });

// La cookie HttpOnly permite recuperar la sesión sin pedir otra vez la contraseña.
async function refreshSession() {
  try {
    const response = await $fetch<TokenResponse>("/api/auth/refresh-token", {
      method: "POST",
    });
    accessToken.value = response.data.accessToken;
  } catch {
    accessToken.value = null;
  }
}

onMounted(async () => {
  if (!accessToken.value) {
    await refreshSession();
  }
  checkingSession.value = false;
});

async function signIn() {
  if (busy.value) {
    return;
  }
  busy.value = true;
  errorMessage.value = "";

  try {
    const response = await $fetch<TokenResponse>("/api/auth/login", {
      method: "POST",
      body: { email: email.value.trim(), password: password.value },
    });
    accessToken.value = response.data.accessToken;
    await navigateTo("/catalogo");
    password.value = "";
    showPassword.value = false;
  } catch (error) {
    const status = (error as { statusCode?: number }).statusCode;
    errorMessage.value =
      status === 401
        ? "El correo o la contraseña son incorrectos."
        : "No se pudo iniciar sesión. Intenta de nuevo.";
  } finally {
    busy.value = false;
  }
}

async function signOut() {
  if (!accessToken.value || busy.value) {
    return;
  }
  busy.value = true;
  errorMessage.value = "";

  try {
    await $fetch("/api/auth/logout", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken.value}` },
    });
    accessToken.value = null;
  } catch {
    // Si el acceso caducó, recupera la sesión para poder volver a intentar el cierre.
    accessToken.value = null;
    await refreshSession();
    if (accessToken.value) {
      errorMessage.value = "No se pudo cerrar la sesión. Intenta de nuevo.";
    }
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <main class="min-h-dvh bg-slate-100 px-5 py-8 text-slate-950 sm:px-8">
    <div class="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-5xl flex-col">
      <NuxtLink
        to="/catalogo"
        class="self-start rounded text-xl font-bold tracking-tight text-blue-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700"
      >
        LabTrack
      </NuxtLink>

      <div class="grid flex-1 place-items-center py-10">
        <section
          aria-labelledby="titulo-login"
          class="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-9"
        >
          <h1 id="titulo-login" class="text-3xl font-bold tracking-tight">
            Iniciar sesión
          </h1>

          <p
            v-if="route.query.registro === 'completo'"
            role="status"
            class="mt-5 text-sm text-green-800"
            >Cuenta creada. Ya puedes iniciar sesión.</p
          >
          <p
            v-if="checkingSession"
            class="mt-6 text-sm text-slate-600"
            role="status"
          >
            Comprobando sesión…
          </p>
          <div v-else-if="accessToken" class="mt-6 space-y-4">
            <p role="status">Tu sesión está iniciada.</p>
            <button
              type="button"
              :disabled="busy"
              class="rounded-lg border border-slate-300 px-4 py-2 font-semibold disabled:opacity-50"
              @click="signOut"
            >
              {{ busy ? "Cerrando sesión…" : "Cerrar sesión" }}
            </button>
          </div>
          <form v-else class="mt-7 space-y-5" @submit.prevent="signIn">
            <div>
              <label for="correo" class="block text-sm font-semibold"
                >Correo electrónico</label
              >
              <input
                id="correo"
                v-model="email"
                name="email"
                type="email"
                autocomplete="username"
                required
                class="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
              />
            </div>

            <div>
              <label for="contrasena" class="block text-sm font-semibold"
                >Contraseña</label
              >
              <div class="relative mt-2">
                <input
                  id="contrasena"
                  v-model="password"
                  name="password"
                  :type="showPassword ? 'text' : 'password'"
                  autocomplete="current-password"
                  required
                  class="w-full rounded-lg border border-slate-300 py-2.5 pr-24 pl-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
                />
                <button
                  type="button"
                  aria-controls="contrasena"
                  class="absolute inset-y-0 right-1 my-1 rounded px-3 text-sm font-semibold text-blue-800 focus-visible:outline-2 focus-visible:outline-blue-700"
                  @click="showPassword = !showPassword"
                >
                  {{ showPassword ? "Ocultar" : "Mostrar" }}
                  <span class="sr-only"> contraseña</span>
                </button>
              </div>
            </div>

            <div>
              <button
                type="submit"
                :disabled="busy"
                class="w-full rounded-lg bg-blue-800 px-4 py-2.5 font-semibold text-white disabled:opacity-50"
              >
                {{ busy ? "Iniciando sesión…" : "Iniciar sesión" }}
              </button>
            </div>
          </form>
          <p v-if="errorMessage" class="mt-4 text-sm text-red-700" role="alert">
            {{ errorMessage }}
          </p>

          <NuxtLink
            v-if="!accessToken"
            to="/registro"
            class="mt-6 block font-semibold text-blue-800"
            >Crear cuenta</NuxtLink
          >
          <NuxtLink
            v-if="accessToken"
            to="/catalogo"
            class="mt-6 inline-block rounded text-sm font-semibold text-blue-800 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700"
          >
            Ver catálogo
          </NuxtLink>
        </section>
      </div>
    </div>
  </main>
</template>
