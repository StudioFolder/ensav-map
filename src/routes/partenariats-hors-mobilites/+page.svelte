<script lang="ts">
  import type { PageData } from './$types'
  let { data }: { data: PageData } = $props()
</script>

<main class="p-8 max-w-6xl mx-auto">
  <a href="/" class="inline-block mb-6 text-sm text-gray-500 hover:text-gray-800">← Retour</a>
  <h1 class="text-2xl font-bold mb-1">Partenariats — Hors mobilités</h1>
  <p class="text-sm text-gray-400 mb-8">{data.partenariats.length} entrées</p>

  <table class="w-full text-sm text-left border-collapse">
    <thead>
      <tr class="border-b-2 border-gray-200 dark:border-gray-800">
        <th class="pb-2 pr-6 font-medium text-gray-400 tabular-nums w-8">#</th>
        <th class="pb-2 pr-6 font-medium text-gray-500">Type</th>
        <th class="pb-2 pr-6 font-medium text-gray-500">Programme</th>
        <th class="pb-2 font-medium text-gray-500">Institution</th>
      </tr>
    </thead>
    <tbody>
      {#each data.partenariats as p, i}
        <tr class="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800/50">
          <td class="py-2 pr-6 text-gray-400 tabular-nums">{i + 1}</td>
          <td class="py-2 pr-6 text-gray-500">{p.Type ?? '—'}</td>
          <td class="py-2 pr-6 text-gray-500">{p.Programme ?? '—'}</td>
          <td class="py-2">{p['Institution (full name)'] ?? '—'}</td>
        </tr>
      {/each}
    </tbody>
  </table>
</main>
