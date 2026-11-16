<script setup lang="ts">
const mostrarContrasena = ref(false)

useHead({ title: 'Iniciar sesión | LabTrack' })
</script>

<template>
  <main class="min-h-dvh bg-slate-100 px-5 py-8 text-slate-950 sm:px-8">
    <div class="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-5xl flex-col">
      <NuxtLink
        to="/"
        class="self-start rounded text-xl font-bold tracking-tight text-blue-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700"
      >
        LabTrack
      </NuxtLink>

      <div class="grid flex-1 place-items-center py-10">
        <section
          aria-labelledby="titulo-login"
          class="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-9"
        >
          <h1 id="titulo-login" class="text-3xl font-bold tracking-tight">Iniciar sesión</h1>

          <form class="mt-7 space-y-5" @submit.prevent>
            <div>
              <label for="correo" class="block text-sm font-semibold">Correo electrónico</label>
              <input
                id="correo"
                name="email"
                type="email"
                autocomplete="username"
                required
                class="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
              />
            </div>

            <div>
              <label for="contrasena" class="block text-sm font-semibold">Contraseña</label>
              <div class="relative mt-2">
                <input
                  id="contrasena"
                  name="password"
                  :type="mostrarContrasena ? 'text' : 'password'"
                  autocomplete="current-password"
                  required
                  class="w-full rounded-lg border border-slate-300 py-2.5 pr-24 pl-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
                />
                <button
                  type="button"
                  aria-controls="contrasena"
                  class="absolute inset-y-0 right-1 my-1 rounded px-3 text-sm font-semibold text-blue-800 focus-visible:outline-2 focus-visible:outline-blue-700"
                  @click="mostrarContrasena = !mostrarContrasena"
                >
                  {{ mostrarContrasena ? 'Ocultar' : 'Mostrar' }}
                  <span class="sr-only"> contraseña</span>
                </button>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled
                aria-describedby="estado-login"
                class="w-full rounded-lg bg-slate-200 px-4 py-2.5 font-semibold text-slate-600"
              >
                Iniciar sesión
              </button>
              <p id="estado-login" class="mt-3 text-sm text-slate-600">
                El inicio de sesión estará disponible cuando se conecte la API.
              </p>
            </div>
          </form>

          <NuxtLink
            to="/"
            class="mt-6 inline-block rounded text-sm font-semibold text-blue-800 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700"
          >
            Volver al catálogo
          </NuxtLink>
        </section>
      </div>
    </div>
  </main>
</template>
