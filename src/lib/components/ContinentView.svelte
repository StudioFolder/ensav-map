<script lang="ts">
  import type { ContinentGroup } from '$lib/data/types'

  let { continentGroups }: { continentGroups: ContinentGroup[] } = $props()
</script>

<div class="absolute inset-0 overflow-auto">
  <div class="min-w-full min-h-full flex items-center justify-center p-20">
    <div class="flex flex-col">
      <div class="flex flex-nowrap items-end gap-10">
        {#each continentGroups as group (group.nameFR)}
          <div class="shrink-0 w-24 flex flex-wrap-reverse gap-[3px]">
            {#each { length: group.count } as _, i (i)}
              <span class="block w-1.5 h-1.5 rounded-full bg-black/30 dark:bg-white/50"></span>
            {/each}
          </div>
        {/each}
      </div>
      <div class="flex flex-nowrap items-start gap-10 mt-3">
        {#each continentGroups as group (group.nameFR)}
          <div class="shrink-0 w-24 text-xs text-gray-500 dark:text-white/40 tabular-nums">
            {group.nameEN} ({group.count})
          </div>
        {/each}
      </div>
    </div>
  </div>
</div>
