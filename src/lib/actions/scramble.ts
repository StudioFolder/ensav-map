export function scramble(node: HTMLElement, value: number) {
  const CHARS = '0123456789'
  const DURATION = 350 // ms
  const INTERVAL = 30  // ms per frame
  let timer: ReturnType<typeof setInterval> | null = null

  function run(target: number) {
    if (timer) clearInterval(timer)
    const final = String(target)
    let elapsed = 0
    timer = setInterval(() => {
      elapsed += INTERVAL
      const progress = Math.min(elapsed / DURATION, 1)
      node.textContent = final
        .split('')
        .map((char, i) => {
          if (progress >= (i + 1) / final.length) return char
          return CHARS[Math.floor(Math.random() * CHARS.length)]
        })
        .join('')
      if (progress >= 1) {
        node.textContent = final
        clearInterval(timer!)
        timer = null
      }
    }, INTERVAL)
  }

  run(value)

  return {
    update(newValue: number) {
      run(newValue)
    },
    destroy() {
      if (timer) clearInterval(timer)
    },
  }
}
