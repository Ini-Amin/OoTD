<script lang="ts">
 import { onMount } from 'svelte';
 import { resolve } from '$app/paths';
 import WorldCanvas from '$lib/world/WorldCanvas.svelte';
 import { destinations, styles, type Person, type Style } from '$lib/world/district';
 import { joinPlaza } from '$lib/world/presence';
 import type { PageData } from './$types';
 let { data }: { data: PageData } = $props();
 let selected = $state('');
 let filter = $state<Style>('All styles');
 let tab = $state<'brands' | 'people'>('brands');
 let visitToken = $state(0);
 let people = $state<Person[]>([]);
 let me = $state<Person>({ id: '', name: '', style: 'Minimal', x: 0, z: 4, wave: 0 });
 let nickname = $state('');
 let myStyle = $state('Minimal');
 let status = $state('Solo exploration');
 let joined = $state(false);
 let now = $state(Date.now());
 let connection: ReturnType<typeof joinPlaza> | undefined;
 let brand = $derived(destinations.find(d => d.id === selected));
 let filtered = $derived(destinations.filter(d => filter === 'All styles' || d.style === filter));
 let others = $derived(people.filter(p => p.id !== me.id));
 onMount(() => {
  me.id = crypto.randomUUID();
  const clock = setInterval(() => { now = Date.now(); }, 1000);
  return () => { clearInterval(clock); connection?.close(); };
 });
 function visit(id: string) { selected = id; visitToken++; }
 function move(x: number, z: number) { me = { ...me, x, z }; connection?.update(me); }
 function join(event: SubmitEvent) {
  event.preventDefault();
  if (!nickname.trim() || !data.supabaseUrl || !data.supabaseKey || !me.id) return;
  connection?.close();
  me = { ...me, name: nickname.trim().slice(0, 24), style: myStyle };
  status = 'Connecting…'; joined = true;
  try { connection = joinPlaza(data.supabaseUrl, data.supabaseKey, me, p => { people = p; }, s => { status = s; }); }
  catch { status = 'Connection interrupted'; joined = false; }
 }
 function leave() { connection?.close(); connection = undefined; joined = false; status = 'Solo exploration'; }
 function wave() { if (now - me.wave < 5000) return; me = { ...me, wave: Date.now() }; connection?.update(me); }
</script>
<svelte:head><title>World — OoTD</title><meta name="description" content="Walk through the OoTD fashion district. Discover brands by style, explore official collections, and meet other visitors in a shared 3D plaza." /></svelte:head>
<main class="world-page">
 <header class="world-header">
  <div><p class="eyebrow">OOTD WORLD <span>/</span> THE FASHION DISTRICT</p><h1>Good style. Better company.</h1><p class="subtitle">Wander a little. Find your people. Discover your next look.</p></div>
  <a class="wardrobe-link" href={resolve('/mannequin')}>Your fitting room <span aria-hidden="true">&#8599;&#65038;</span></a>
 </header>
 <div class="world-bar"><div class="district-title"><span class="status-dot" class:live={status === 'Live'}></span><strong>The Plaza</strong><span class="beta">EARLY ACCESS</span></div><span class="connection" role="status">{status === 'Live' ? `${people.length} ${people.length === 1 ? 'explorer' : 'explorers'} online` : status}</span></div>
 <div class="world-layout">
  <section class="map-region" aria-label="Explore the fashion district"><WorldCanvas {people} ownId={me.id} {selected} {visitToken} onselect={id => { selected = id; }} onmove={move} /></section>
  <aside class="directory">
   <div class="tabs" role="tablist" aria-label="District directory"><button id="brands-tab" role="tab" aria-selected={tab === 'brands'} aria-controls="brands-panel" tabindex={tab === 'brands' ? 0 : -1} onclick={() => { tab = 'brands'; }} onkeydown={e => { if (e.key === 'ArrowRight') { tab = 'people'; document.getElementById('people-tab')?.focus(); } }}>Discover brands</button><button id="people-tab" role="tab" aria-selected={tab === 'people'} aria-controls="people-panel" tabindex={tab === 'people' ? 0 : -1} onclick={() => { tab = 'people'; }} onkeydown={e => { if (e.key === 'ArrowLeft') { tab = 'brands'; document.getElementById('brands-tab')?.focus(); } }}>People <span>{status === 'Live' ? people.length : '—'}</span></button></div>
   {#if tab === 'brands'}
    <div id="brands-panel" role="tabpanel" aria-labelledby="brands-tab" class="panel">
     {#if brand}
      <button class="back-link" onclick={() => { selected = ''; }}>← All destinations</button>
      <div class="brand-feature"><span class="eyebrow">{brand.style} DESTINATION</span><h2>{brand.name}</h2><span class="feature-word" aria-hidden="true">{brand.sign}</span></div>
      <p class="description">{brand.description}</p>
      <div class="price-note"><div><strong>Real-world prices</strong><span class="small-badge">NOT SYNCED</span></div><p>No live catalog connected. Check the official site for current prices, currency, sizes, and availability.</p></div>
      <a class="primary-button" href={brand.url} target="_blank" rel="noopener noreferrer">Explore official site <span aria-hidden="true">&#8599;&#65038;</span></a>
      <button class="secondary-button" onclick={() => visit(brand.id)}>Walk to {brand.name}</button>
      <p class="fine-print">Independent editorial destination. Not affiliated with or endorsed by {brand.name}.</p>
     {:else}
      <div class="section-intro"><h2>Find your corner.</h2><p>Different labels. A shared love of getting dressed.</p></div>
      <div class="style-filters" aria-label="Filter brands by style">{#each styles as style (style)}<button aria-pressed={filter === style} onclick={() => { filter = style; }}>{style}</button>{/each}</div>
      <div class="brand-list">{#each filtered as d (d.id)}<button class="brand-row" onclick={() => visit(d.id)}><span class="brand-monogram">{d.name === 'Acne Studios' ? 'Ac' : d.name === 'Carhartt WIP' ? 'Cw' : d.sign.slice(0, 2)}</span><span class="brand-copy"><strong>{d.name}</strong><span>{d.style}</span></span><span aria-hidden="true" class="row-arrow">&#8599;&#65038;</span></button>{/each}</div>
      <p class="directory-note">Select a destination to walk over and explore.<br />Brand prices are shown on their official sites.</p>
     {/if}
    </div>
   {:else}
    <div id="people-panel" role="tabpanel" aria-labelledby="people-tab" class="panel">
     <div class="section-intro"><h2>Style is social.</h2><p>Join the public plaza to see other visitors and share your style.</p></div>
     {#if !joined}
      <form class="join-form" onsubmit={join}><label for="nickname">Your display name</label><input id="nickname" bind:value={nickname} placeholder="What should we call you?" maxlength="24" required /><label for="my-style">Your style today</label><select id="my-style" bind:value={myStyle}>{#each styles.filter(s => s !== 'All styles') as style (style)}<option>{style}</option>{/each}</select><button class="primary-button" disabled={!data.supabaseUrl || !data.supabaseKey || !me.id}>Join the plaza <span aria-hidden="true">→</span></button></form>
      <p class="fine-print">Guest names are unverified. Your name, style, and position are visible to everyone in this public room while you are connected. Nothing is saved to a profile.</p>
      {#if !data.supabaseUrl || !data.supabaseKey}<p role="status">Live presence is unavailable. You can still explore solo.</p>{/if}
     {:else}
      <div class="self-card"><span class="avatar-dot">{me.name.slice(0, 1).toUpperCase()}</span><div><strong>{me.name} <span class="you-label">YOU</span></strong><p>{me.style} · Guest</p></div></div>
      {#if status === 'Connection interrupted'}<p role="alert">The live connection was interrupted. Leave and rejoin to retry.</p>{/if}
      <div class="people-list" aria-live="polite">{#each others as person (person.id)}<div class="person"><span class="avatar-dot other">{person.name.slice(0, 1).toUpperCase()}</span><div><strong>{person.name}</strong><p>{person.style}{now - person.wave < 5000 && now >= person.wave ? ' · Waving hello!' : ' · Exploring'}</p></div></div>{:else}<div class="empty-people"><strong>A little room to explore.</strong><p>You’re the first here. Invite a friend to this page to meet in the plaza.</p></div>{/each}</div>
      <button class="primary-button" onclick={wave} disabled={status !== 'Live' || now - me.wave < 5000}>{now - me.wave < 5000 ? 'You waved hello!' : 'Wave to the plaza'} <span aria-hidden="true">&#8599;&#65038;</span></button><button class="text-button" onclick={leave}>Leave live plaza</button>
     {/if}
    </div>
   {/if}
   <div class="sidebar-footer"><span class="footer-mark">OoTD</span><span>Real brands. Your own world.</span></div>
  </aside>
 </div>
 <footer class="world-footer"><span><span class="keycap">↑</span><span class="keycap">←</span><span class="keycap">↓</span><span class="keycap">→</span> Focus the map to move with your keyboard</span><span>Built for discovering, not scrolling.</span></footer>
</main>
<style>
 .world-page { --world-ink: #17232f; --world-slate: #52677c; --world-pale: #dce4eb; --world-white: #f7f9fb; --world-blue: #4169e1; max-width: 1500px; margin: 0 auto; padding: 24px 30px 40px; }
 .world-header { display: flex; align-items: center; justify-content: space-between; gap: 24px; margin-bottom: 32px; }
 .eyebrow { font-size: 12px; letter-spacing: 0.12em; font-weight: 600; color: var(--t-muted); }
 .eyebrow span { padding: 0 10px; opacity: 0.5; }
 h1 { font-size: clamp(28px, 3.2vw, 44px); letter-spacing: -0.055em; font-weight: 500; margin: 14px 0 10px; line-height: 1.15; text-wrap: balance; }
 .subtitle { font-size: 15px; color: var(--t-muted); margin: 0; line-height: 1.5; }
 .wardrobe-link { display: flex; gap: 24px; align-items: center; padding: 13px 18px; border: 1px solid var(--t-line); border-radius: 10px; text-decoration: none; font-size: 14px; color: var(--t-fg); white-space: nowrap; }
 .world-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; font-size: 14px; }
 .district-title { display: flex; gap: 10px; align-items: center; }
 .status-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--t-muted); }
 .status-dot.live { background: var(--world-blue); box-shadow: 0 0 0 4px color-mix(in srgb, var(--world-blue) 15%, transparent); }
 .beta { font-size: 10px; letter-spacing: 0.08em; padding: 4px 6px; border: 1px solid var(--t-line); border-radius: 4px; color: var(--t-muted); }
 .connection { font-size: 13px; color: var(--t-muted); }
 .world-layout { display: grid; grid-template-columns: minmax(0, 1fr) 320px; align-items: stretch; gap: 20px; height: clamp(500px, calc(100dvh - 310px), 740px); }
 .map-region { min-width: 0; }
 .directory { display: flex; flex-direction: column; border: 1px solid var(--t-line); border-radius: 20px; background: var(--t-surface); color: var(--t-fg); overflow: hidden; }
 .tabs { display: flex; border-bottom: 1px solid var(--t-line); }
 .tabs button { flex: 1; border: 0; padding: 18px 6px; background: transparent; color: var(--t-muted); font-size: 14px; border-bottom: 2px solid transparent; }
 .tabs button[aria-selected='true'] { color: var(--t-fg); border-bottom-color: var(--world-blue); }
 .tabs span { font-size: 11px; border-radius: 4px; background: var(--t-tint); padding: 2px 4px; }
 .panel { padding: 22px 20px; flex: 1; overflow: auto; min-height: 0; }
 .tabs, .sidebar-footer { flex-shrink: 0; }
 .section-intro h2 { font-size: 23px; font-weight: 500; letter-spacing: -0.04em; margin: 0 0 8px; }
 .section-intro p, .description { font-size: 14px; color: var(--t-muted); line-height: 1.65; margin: 0; }
 .style-filters { display: flex; flex-wrap: wrap; gap: 6px; padding-block: 22px 14px; }
 .style-filters button { font-size: 12px; padding: 7px 10px; border: 1px solid var(--t-line); background: transparent; color: var(--t-muted); border-radius: 20px; }
 .style-filters button[aria-pressed='true'] { background: var(--world-ink); color: var(--world-white); border-color: var(--world-ink); }
 .brand-list { display: flex; flex-direction: column; }
 .brand-row { display: flex; align-items: center; gap: 12px; width: 100%; padding: 13px 0; background: none; color: var(--t-fg); border: 0; border-bottom: 1px solid var(--t-line); text-align: left; }
 .brand-row:hover .row-arrow { transform: translate(2px, -2px); color: var(--world-blue); }
 .brand-monogram { display: grid; place-items: center; width: 42px; height: 42px; flex-shrink: 0; border-radius: 10px; background: var(--t-tint); color: var(--t-fg); font-size: 14px; font-weight: 600; letter-spacing: -0.07em; }
 .brand-copy { display: flex; flex: 1; flex-direction: column; gap: 4px; }
 .brand-copy strong { font-size: 14px; font-weight: 500; }
 .brand-copy span { font-size: 12px; color: var(--t-muted); }
 .row-arrow { font-size: 20px; color: var(--t-muted); transition: transform 0.15s; }
 .directory-note { color: var(--t-muted); font-size: 12px; line-height: 1.6; margin: 20px 0 0; }
 .sidebar-footer { display: flex; align-items: center; justify-content: space-between; gap: 10px; border-top: 1px solid var(--t-line); padding: 16px 20px; font-size: 11px; color: var(--t-muted); }
 .footer-mark { font-size: 17px; letter-spacing: -0.06em; font-weight: 600; color: var(--t-fg); }
 .world-footer { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 16px; padding-top: 18px; font-size: 12px; color: var(--t-muted); }
 .keycap { display: inline-block; border: 1px solid var(--t-line); border-radius: 4px; padding: 1px 5px; margin-right: 3px; }
 .back-link, .text-button { border: 0; background: none; color: var(--t-muted); padding: 0; font-size: 13px; }
 .brand-feature { background: var(--world-ink); color: var(--world-white); padding: 24px 20px; border-radius: 12px; margin-block: 20px; overflow: hidden; min-height: 165px; }
 .brand-feature .eyebrow { color: var(--world-pale); font-size: 10px; }
 .brand-feature h2 { font-size: 28px; letter-spacing: -0.04em; font-weight: 500; margin: 10px 0 26px; }
 .feature-word { font-size: 26px; letter-spacing: 0.08em; color: var(--world-slate); white-space: nowrap; font-weight: 700; }
 .price-note { border-top: 1px solid var(--t-line); padding-top: 20px; margin-block: 24px 20px; }
 .price-note div { display: flex; justify-content: space-between; align-items: center; }
 .price-note strong { font-size: 14px; font-weight: 500; }
 .small-badge { font-size: 9px; letter-spacing: 0.06em; border: 1px solid var(--t-line); border-radius: 4px; padding: 4px; color: var(--t-muted); }
 .price-note p, .fine-print { font-size: 12px; color: var(--t-muted); line-height: 1.6; }
 .primary-button, .secondary-button { display: flex; justify-content: space-between; align-items: center; width: 100%; padding: 13px 14px; border-radius: 9px; border: 1px solid var(--world-blue); background: var(--world-blue); color: var(--world-white); text-decoration: none; font-size: 14px; }
 .secondary-button { background: transparent; color: var(--t-fg); border-color: var(--t-line); justify-content: center; margin-top: 8px; }
 .primary-button:hover { filter: brightness(1.12); }
 .primary-button:disabled { opacity: 0.5; cursor: not-allowed; }
 .fine-print { margin-top: 18px; }
 .join-form { display: flex; flex-direction: column; gap: 10px; padding-top: 24px; }
 .join-form label { font-size: 13px; }
 .join-form input, .join-form select { width: 100%; padding: 12px; border: 1px solid var(--t-line); border-radius: 8px; background: var(--t-bg); color: var(--t-fg); font: inherit; font-size: 14px; }
 .join-form button { margin-top: 10px; }
 .self-card, .person { display: flex; align-items: center; gap: 12px; padding-block: 20px; }
 .self-card strong, .person strong { font-size: 14px; font-weight: 500; }
 .self-card p, .person p { font-size: 12px; color: var(--t-muted); margin: 5px 0 0; }
 .avatar-dot { display: grid; place-items: center; height: 36px; width: 36px; border-radius: 50%; background: var(--world-blue); color: var(--world-white); font-size: 14px; }
 .avatar-dot.other { background: var(--world-slate); }
 .you-label { font-size: 10px; color: var(--t-muted); }
 .people-list { max-height: 200px; overflow: auto; margin-bottom: 20px; }
 .empty-people { border: 1px dashed var(--t-line); padding: 24px 16px; border-radius: 10px; }
 .empty-people strong { font-size: 14px; font-weight: 500; }
 .empty-people p { font-size: 13px; line-height: 1.6; color: var(--t-muted); margin-bottom: 0; }
 .text-button { display: block; margin: 16px auto 0; }
 button:focus-visible, a:focus-visible, input:focus-visible, select:focus-visible { outline: 2px solid var(--world-blue); outline-offset: 3px; }
 @media(min-width: 1600px) { .world-layout { grid-template-columns: minmax(0, 1fr) 350px; } }
 @media(max-width: 1000px) { .world-page { padding: 20px 16px; } .world-layout { grid-template-columns: minmax(0, 1fr) 290px; gap: 12px; } .wardrobe-link { display: none; } }
 @media(max-width: 760px) { .world-layout { grid-template-columns: 1fr; height: auto; } .world-header { margin-bottom: 24px; } .world-page { padding: 12px 12px 80px; } .world-footer > span:last-child { display: none; } .eyebrow { font-size: 10px; } .subtitle { font-size: 14px; } .connection { font-size: 12px; } .panel { padding: 20px; } }
</style>
