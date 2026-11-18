<script setup lang="ts">
const name = ref("");
const email = ref("");
const password = ref("");
const confirmation = ref("");
const showPassword = ref(false);
const busy = ref(false);
const errorMessage = ref("");
useHead({ title: "Crear cuenta | LabTrack" });

async function register() {
  if (busy.value) return;
  errorMessage.value = "";
  if (password.value !== confirmation.value) {
    errorMessage.value = "Las contraseñas deben coincidir.";
    return;
  }
  busy.value = true;
  try {
    await $fetch("/api/auth/register", {
      method: "POST",
      body: { name: name.value.trim(), email: email.value.trim(), password: password.value },
    });
    password.value = "";
    confirmation.value = "";
    await navigateTo("/login?registro=completo");
  } catch (error) {
    const code = (error as { data?: { error?: { code?: string } } }).data?.error?.code;
    errorMessage.value = code === "EMAIL_ALREADY_EXISTS"
      ? "Este correo ya tiene una cuenta. Inicia sesión."
      : "No se pudo crear la cuenta. Revisa los datos e intenta de nuevo.";
  } finally { busy.value = false; }
}
</script>

<template>
  <main class="min-h-dvh bg-slate-100 px-5 py-8 text-slate-950">
    <div class="mx-auto max-w-5xl">
      <NuxtLink to="/login" class="text-xl font-bold text-blue-800">LabTrack</NuxtLink>
      <section class="mx-auto mt-10 w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-9" aria-labelledby="register-title">
        <h1 id="register-title" class="text-3xl font-bold">Crear cuenta</h1>
        <form class="mt-7 space-y-5" @submit.prevent="register">
          <label class="block text-sm font-semibold">
            Nombre
            <input v-model="name" name="name" autocomplete="name" required :disabled="busy" class="mt-2 block w-full rounded-lg border border-slate-300 p-2.5" />
          </label>
          <label class="block text-sm font-semibold">
            Correo electrónico
            <input v-model="email" name="email" type="email" autocomplete="username" required :disabled="busy" class="mt-2 block w-full rounded-lg border border-slate-300 p-2.5" />
          </label>
          <label class="block text-sm font-semibold">
            Contraseña
            <input v-model="password" name="password" :type="showPassword ? 'text' : 'password'" autocomplete="new-password" minlength="8" required :disabled="busy" aria-describedby="password-help" class="mt-2 block w-full rounded-lg border border-slate-300 p-2.5" />
          </label>
          <p id="password-help" class="text-sm text-slate-600">Usa al menos 8 caracteres.</p>
          <label class="block text-sm font-semibold">
            Confirmar contraseña
            <input v-model="confirmation" name="confirmation" :type="showPassword ? 'text' : 'password'" autocomplete="new-password" minlength="8" required :disabled="busy" class="mt-2 block w-full rounded-lg border border-slate-300 p-2.5" />
          </label>
          <button type="button" class="text-sm font-semibold text-blue-800" @click="showPassword = !showPassword">{{ showPassword ? "Ocultar contraseñas" : "Mostrar contraseñas" }}</button>
          <p v-if="errorMessage" role="alert" class="text-sm text-red-700">{{ errorMessage }}</p>
          <button type="submit" :disabled="busy || !name.trim()" class="w-full rounded-lg bg-blue-800 p-2.5 font-semibold text-white disabled:opacity-50">{{ busy ? "Creando cuenta…" : "Crear cuenta" }}</button>
        </form>
        <NuxtLink to="/login" class="mt-6 inline-block text-sm font-semibold text-blue-800 hover:underline">Ya tengo cuenta</NuxtLink>
      </section>
    </div>
  </main>
</template>