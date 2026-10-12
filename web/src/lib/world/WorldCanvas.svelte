<script lang="ts">
 import { onMount } from 'svelte';
 import { type Person } from './district';
 import type { createWorld } from './scene';
 let { people, ownId, selected, visitToken, onselect, onmove }: { people: Person[]; ownId: string; selected: string; visitToken: number; onselect: (id: string) => void; onmove: (x: number, z: number) => void } = $props();
 let canvas: HTMLCanvasElement;
 let world = $state<ReturnType<typeof createWorld>>();
 let error = $state(false);
 onMount(() => {
  let cancelled = false;
  import('./scene').then(({ createWorld }) => {
   if (cancelled) return;
   try { world = createWorld(canvas, onselect, onmove); } catch { error = true; }
  }).catch(() => { if (!cancelled) error = true; });
  return () => { cancelled = true; world?.destroy(); };
 });
 $effect(() => { world?.people(people, ownId); });
 $effect(() => { if (visitToken > 0 && selected) world?.visit(selected); });
</script>
<div class="viewport">
 <canvas bind:this={canvas} tabindex="0" aria-label="Interactive fashion plaza. Click the streets to walk or focus here and use arrow keys. Select brands using the directory." class:failed={error}></canvas>
 {#if !world && !error}<div class="canvas-message" role="status">Opening the district…</div>{/if}
 {#if error}<div class="canvas-message" role="status"><strong>3D isn’t available in this browser.</strong><span>You can still explore every brand using the directory.</span></div>{/if}
 <div class="map-label"><span class="location-dot"></span><div><strong>The fashion district</strong><span>PUBLIC PLAZA · CONCEPT WORLD</span></div></div>
 <div class="camera-controls" aria-label="Map camera"><button disabled={!world} onclick={() => world?.zoom(1.2)} aria-label="Zoom in">+</button><button disabled={!world} onclick={() => world?.zoom(0.8)} aria-label="Zoom out">−</button><button disabled={!world} onclick={() => world?.reset()} aria-label="Reset map camera">↺</button></div>
 <div class="movement-controls" aria-label="Move your avatar"><button disabled={!world} onclick={() => world?.move(0, -1)} aria-label="Walk north">↑</button><div><button disabled={!world} onclick={() => world?.move(-1, 0)} aria-label="Walk west">←</button><button disabled={!world} onclick={() => world?.move(0, 1)} aria-label="Walk south">↓</button><button disabled={!world} onclick={() => world?.move(1, 0)} aria-label="Walk east">→</button></div></div>
 <div class="map-help"><span>Click to walk</span><span>Right-drag to orbit</span><span>Scroll to zoom</span></div>
</div>
<style>
 .viewport { position: relative; min-width: 0; min-height: 0; height: 100%; overflow: hidden; background: var(--world-pale); color: var(--world-ink); border-radius: 1.25rem; }
 canvas { display: block; width: 100%; height: 100%; min-height: 0; touch-action: none; }
 canvas:focus-visible { outline: 3px solid var(--world-blue); outline-offset: -5px; }
 .failed { visibility: hidden; }
 .map-label { position: absolute; top: 24px; left: 24px; display: flex; align-items: center; gap: 10px; pointer-events: none; }
 .map-label div { display: flex; flex-direction: column; gap: 6px; }
 .map-label strong { font-size: 16px; font-weight: 600; letter-spacing: -0.03em; }
 .map-label span:not(.location-dot) { font-size: 11px; letter-spacing: 0.09em; }
 .location-dot { height: 10px; width: 10px; border: 2px solid var(--world-blue); border-radius: 50%; }
 button { border: 1px solid color-mix(in srgb, var(--world-ink) 12%, transparent); background: var(--world-white); color: var(--world-ink); border-radius: 10px; width: 40px; height: 40px; font-size: 20px; }
 button:hover { background: var(--world-blue); color: var(--world-white); }
 button:focus-visible { outline: 2px solid var(--world-blue); outline-offset: 2px; }
 button:disabled { opacity: 0.4; cursor: not-allowed; }
 .camera-controls { position: absolute; top: 24px; right: 20px; display: flex; flex-direction: column; gap: 6px; }
 .movement-controls { position: absolute; bottom: 24px; right: 20px; display: flex; flex-direction: column; align-items: center; gap: 5px; }
 .movement-controls div { display: flex; gap: 5px; }
 .map-help { position: absolute; bottom: 24px; left: 24px; display: flex; flex-wrap: wrap; gap: 12px; max-width: calc(100% - 200px); font-size: 12px; color: var(--world-slate); }
 .canvas-message { position: absolute; inset: 30% 15%; display: flex; flex-direction: column; justify-content: center; gap: 12px; text-align: center; font-size: 14px; }
 @media(max-width: 700px) { .viewport, canvas { min-height: 440px; height: 440px; } .map-help { font-size: 11px; } .map-label { top: 18px; left: 18px; } }
</style>
