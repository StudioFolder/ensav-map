<script lang="ts">
  import type { PageData } from './$types'
  let { data }: { data: PageData } = $props()
</script>

<main class="p-8 max-w-6xl mx-auto">
  <a href="/" class="inline-block mb-6 text-sm text-gray-500 hover:text-gray-800">← Retour</a>
  <h1 class="text-2xl font-bold mb-1">PFE</h1>
  <p class="text-sm text-gray-400 mb-8">{data.pfe.length} entrées</p>

  <table class="w-full text-sm text-left border-collapse">
    <thead>
      <tr class="border-b-2 border-gray-200 dark:border-gray-800">
        <th class="pb-2 pr-6 font-medium text-gray-500">Titre</th>
        <th class="pb-2 font-medium text-gray-500">Étudiant·e</th>
      </tr>
    </thead>
    <tbody>
      {#each data.pfe as p}
        <tr class="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800/50">
          <td class="py-2 pr-6">{p.Title}</td>
          <td class="py-2 text-gray-500">{[p['Student 1'], p['Student 2'], p['Student 3']].filter(Boolean).join(', ') || '—'}</td>
        </tr>
      {/each}
    </tbody>
  </table>
</main>
