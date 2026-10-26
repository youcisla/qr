<script lang="ts">
  /**
   * Miniature, engine-accurate glyphs for the dot / eye-frame / eye-ball pickers.
   * Hand-drawn in a 28x28 box so they read clearly at 28-32px.
   */
  interface Props {
    kind: "dot" | "frame" | "ball"
    name: string
    class?: string
  }

  let { kind, name, class: className = "" }: Props = $props()

  // Octagram used by the engine's "star" module style.
  const starPoints = (() => {
    const points: string[] = []
    const cx = 14
    const cy = 14
    const outer = 12
    const inner = 12 * 0.34
    for (let index = 0; index < 8; index += 1) {
      const angle = (Math.PI * index) / 4 - Math.PI / 2
      const radius = index % 2 === 0 ? outer : inner
      points.push(
        `${(cx + Math.cos(angle) * radius).toFixed(2)},${(cy + Math.sin(angle) * radius).toFixed(2)}`,
      )
    }
    return points.join(" ")
  })()
</script>

<svg viewBox="0 0 28 28" fill="currentColor" class={className} aria-hidden="true" focusable="false">
  {#if kind === "dot"}
    {#if name === "square"}
      <rect x="3" y="3" width="22" height="22" rx="0.5" />
    {:else if name === "rounded"}
      <rect x="3" y="3" width="22" height="22" rx="6" />
    {:else if name === "dots"}
      <circle cx="14" cy="14" r="11" />
    {:else if name === "diamond"}
      <polygon points="14,2 26,14 14,26 2,14" />
    {:else if name === "star"}
      <polygon points={starPoints} />
    {:else if name === "cross"}
      <polygon points="11,3 17,3 17,11 25,11 25,17 17,17 17,25 11,25 11,17 3,17 3,11 11,11" />
    {:else if name === "leaf"}
      <path d="M3 14 Q3 3 14 3 H25 V14 Q25 25 14 25 H3 Z" />
    {:else if name === "classy"}
      <polygon points="3,3 18,3 25,10 25,25 3,25" />
    {:else if name === "hexagon"}
      <polygon points="7,3 21,3 26,14 21,25 7,25 2,14" />
    {:else if name === "squircle"}
      <rect x="3" y="3" width="22" height="22" rx="10" />
    {:else}
      <rect x="3" y="3" width="22" height="22" rx="0.5" />
    {/if}
  {:else if kind === "frame"}
    {#if name === "square"}
      <path fill-rule="evenodd" d="M2 2 H26 V26 H2 Z M8 8 V20 H20 V8 Z" clip-rule="evenodd" />
    {:else if name === "rounded"}
      <path
        fill-rule="evenodd"
        d="M9 2 H19 A7 7 0 0 1 26 9 V19 A7 7 0 0 1 19 26 H9 A7 7 0 0 1 2 19 V9 A7 7 0 0 1 9 2 Z M9 8 A1 1 0 0 0 8 9 V19 A1 1 0 0 0 9 20 H19 A1 1 0 0 0 20 19 V9 A1 1 0 0 0 19 8 Z"
        clip-rule="evenodd"
      />
    {:else if name === "circle"}
      <path
        fill-rule="evenodd"
        d="M14 2 A12 12 0 1 1 13.99 2 Z M14 8 A6 6 0 1 0 14.01 8 Z"
        clip-rule="evenodd"
      />
    {:else if name === "leaf"}
      <path
        fill-rule="evenodd"
        d="M14 2 H22 A4 4 0 0 1 26 6 V14 A12 12 0 0 1 14 26 H6 A4 4 0 0 1 2 22 V14 A12 12 0 0 1 14 2 Z M14 8 A6 6 0 0 0 8 14 V18 A4 4 0 0 0 12 22 H18 A6 6 0 0 0 24 16 V12 A4 4 0 0 0 20 8 Z"
        clip-rule="evenodd"
      />
    {:else if name === "octagon"}
      <path
        fill-rule="evenodd"
        d="M9 2 H19 L26 9 V19 L19 26 H9 L2 19 V9 Z M9 8 L8 9 V19 L9 20 H19 L20 19 V9 L19 8 Z"
        clip-rule="evenodd"
      />
    {:else if name === "squircle"}
      <path
        fill-rule="evenodd"
        d="M12 2 H16 A10 10 0 0 1 26 12 V16 A10 10 0 0 1 16 26 H12 A10 10 0 0 1 2 16 V12 A10 10 0 0 1 12 2 Z M12 8 A4 4 0 0 0 8 12 V16 A4 4 0 0 0 12 20 H16 A4 4 0 0 0 20 16 V12 A4 4 0 0 0 16 8 Z"
        clip-rule="evenodd"
      />
    {:else}
      <path fill-rule="evenodd" d="M2 2 H26 V26 H2 Z M8 8 V20 H20 V8 Z" clip-rule="evenodd" />
    {/if}
  {:else if name === "square"}
    <rect x="7" y="7" width="14" height="14" rx="0.5" />
  {:else if name === "rounded"}
    <rect x="7" y="7" width="14" height="14" rx="4.5" />
  {:else if name === "dots"}
    <circle cx="14" cy="14" r="7" />
  {:else if name === "diamond"}
    <polygon points="14,7 21,14 14,21 7,14" />
  {:else if name === "leaf"}
    <path d="M7 14 Q7 7 14 7 H21 V14 Q21 21 14 21 H7 Z" />
  {:else}
    <rect x="7" y="7" width="14" height="14" rx="0.5" />
  {/if}
</svg>
