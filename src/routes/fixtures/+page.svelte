<script lang="ts">
  import { dev } from '$app/environment';
  import { base } from '$app/paths';
  import { onMount } from 'svelte';

  type Point = { x: number; y: number };
  type StarColor = 'gold' | 'red';
  type ReviewStatus = 'draft' | 'approved';
  type FixtureStar = { id: string; color: StarColor; center: Point; radius: number };
  type FixtureAnnotation = {
    schemaVersion: 1;
    id: string;
    reviewStatus: ReviewStatus;
    image: { file: string; width: number; height: number; source: string };
    expected: {
      cardLabel: string;
      textRegion: { corners: Point[] };
      north: { origin: Point; target: Point };
      stars: FixtureStar[];
    };
  };
  type DragTarget =
    | { kind: 'star-center'; starId: string }
    | { kind: 'star-radius'; starId: string }
    | { kind: 'text-corner'; corner: number }
    | { kind: 'north-origin' }
    | { kind: 'north-target' };
  type Tool = 'select' | 'add-gold' | 'add-red';

  const apiRoot = `${base}/__fixtures`;
  let fixtures: FixtureAnnotation[] = [];
  let selectedId = '';
  let selectedStarId = '';
  let savedRecords: Record<string, string> = {};
  let tool: Tool = 'select';
  let dragTarget: DragTarget | undefined;
  let overlay: SVGSVGElement;
  let loadError = '';
  let saveMessage = '';

  $: selected = fixtures.find((fixture) => fixture.id === selectedId);
  $: selectedStar = selected?.expected.stars.find((star) => star.id === selectedStarId);
  $: isDirty = selected ? JSON.stringify(selected) !== savedRecords[selected.id] : false;
  $: selectedIndex = fixtures.findIndex((fixture) => fixture.id === selectedId);
  $: goldCount = selected?.expected.stars.filter((star) => star.color === 'gold').length ?? 0;
  $: redCount = selected?.expected.stars.filter((star) => star.color === 'red').length ?? 0;

  onMount(async () => {
    if (!dev) {
      loadError = 'The fixture annotator is available only from the local development server.';
      return;
    }
    try {
      const response = await fetch(`${apiRoot}/manifest.json`, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Fixture manifest returned ${response.status}.`);
      const result = (await response.json()) as { fixtures: FixtureAnnotation[] };
      fixtures = result.fixtures;
      savedRecords = Object.fromEntries(fixtures.map((fixture) => [fixture.id, JSON.stringify(fixture)]));
      selectedId = fixtures[0]?.id ?? '';
    } catch (error) {
      loadError = error instanceof Error ? error.message : 'The fixture annotations could not be loaded.';
    }
  });

  function imageUrl(fixture: FixtureAnnotation) {
    return `${apiRoot}/images/${fixture.image.file}`;
  }

  function selectFixture(id: string) {
    selectedId = id;
    selectedStarId = '';
    tool = 'select';
    saveMessage = '';
  }

  function adjacentFixture(offset: number) {
    if (!fixtures.length) return;
    const index = (selectedIndex + offset + fixtures.length) % fixtures.length;
    selectFixture(fixtures[index].id);
  }

  function changed() {
    fixtures = fixtures;
    saveMessage = '';
  }

  function updateLabel(event: Event) {
    if (!selected) return;
    selected.expected.cardLabel = (event.currentTarget as HTMLInputElement).value.toUpperCase();
    changed();
  }

  function updateReviewStatus(event: Event) {
    if (!selected) return;
    selected.reviewStatus = (event.currentTarget as HTMLSelectElement).value as ReviewStatus;
    changed();
  }

  function normalizedPointer(event: PointerEvent): Point {
    const bounds = overlay.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)),
      y: Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height))
    };
  }

  function beginDrag(event: PointerEvent, target: DragTarget) {
    event.preventDefault();
    event.stopPropagation();
    dragTarget = target;
    if ('starId' in target) selectedStarId = target.starId;
    (event.currentTarget as Element).setPointerCapture?.(event.pointerId);
  }

  function moveDrag(event: PointerEvent) {
    if (!selected || !dragTarget) return;
    const target = dragTarget;
    const point = normalizedPointer(event);
    if (target.kind === 'star-center') {
      const star = selected.expected.stars.find((candidate) => candidate.id === target.starId);
      if (star) star.center = point;
    } else if (target.kind === 'star-radius') {
      const star = selected.expected.stars.find((candidate) => candidate.id === target.starId);
      if (star) {
        const pixelX = (point.x - star.center.x) * selected.image.width;
        const pixelY = (point.y - star.center.y) * selected.image.height;
        star.radius = Math.max(0.008, Math.min(0.12, Math.hypot(pixelX, pixelY) / selected.image.width));
      }
    } else if (target.kind === 'text-corner') {
      selected.expected.textRegion.corners[target.corner] = point;
    } else if (target.kind === 'north-origin') {
      selected.expected.north.origin = point;
    } else if (target.kind === 'north-target') {
      selected.expected.north.target = point;
    }
    changed();
  }

  function endDrag() {
    dragTarget = undefined;
  }

  function addStar(event: PointerEvent) {
    if (!selected || tool === 'select') return;
    const color: StarColor = tool === 'add-red' ? 'red' : 'gold';
    const existingIds = new Set(selected.expected.stars.map((star) => star.id));
    let sequence = 1;
    while (existingIds.has(`${color}-${sequence}`)) sequence += 1;
    const star: FixtureStar = {
      id: `${color}-${sequence}`,
      color,
      center: normalizedPointer(event),
      radius: color === 'red' ? 0.045 : 0.03
    };
    selected.expected.stars.push(star);
    selectedStarId = star.id;
    tool = 'select';
    changed();
  }

  function toggleSelectedColor() {
    if (!selectedStar) return;
    selectedStar.color = selectedStar.color === 'gold' ? 'red' : 'gold';
    changed();
  }

  function removeSelectedStar() {
    if (!selected || !selectedStarId) return;
    selected.expected.stars = selected.expected.stars.filter((star) => star.id !== selectedStarId);
    selectedStarId = '';
    changed();
  }

  function resetSelected() {
    if (!selected || !isDirty) return;
    const saved = savedRecords[selected.id];
    if (!saved || !confirm(`Discard unsaved edits to ${selected.expected.cardLabel}?`)) return;
    const reset = JSON.parse(saved) as FixtureAnnotation;
    fixtures = fixtures.map((fixture) => fixture.id === reset.id ? reset : fixture);
    selectedStarId = '';
    saveMessage = 'Unsaved edits discarded.';
  }

  async function saveSelected() {
    if (!selected) return;
    saveMessage = 'Saving…';
    const response = await fetch(`${apiRoot}/annotations/${selected.id}.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(selected)
    });
    if (!response.ok) {
      const error = (await response.json().catch(() => ({}))) as { error?: string };
      saveMessage = error.error ?? `Save failed with status ${response.status}.`;
      return;
    }
    savedRecords = { ...savedRecords, [selected.id]: JSON.stringify(selected) };
    saveMessage = `Saved ${selected.id}.json`;
  }

  function downloadSelected() {
    if (!selected) return;
    const blob = new Blob([`${JSON.stringify(selected, null, 2)}\n`], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${selected.id}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function polygonPoints(fixture: FixtureAnnotation) {
    return fixture.expected.textRegion.corners
      .map((point) => `${point.x * fixture.image.width},${point.y * fixture.image.height}`)
      .join(' ');
  }
</script>

<svelte:head>
  <title>Fixture annotations · Zodiac</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<main>
  <header class="page-header">
    <div>
      <p class="eyebrow">Local regression workspace</p>
      <h1>Fixture annotations</h1>
      <p class="lede">Review card text, logical north, token centers, colors, and sizes. Coordinates are normalized against each source image.</p>
    </div>
    <a href={`${base}/`}>Back to Zodiac</a>
  </header>

  {#if loadError}
    <section class="empty-state" role="alert">
      <h2>Fixtures unavailable</h2>
      <p>{loadError}</p>
      <code>npm run dev</code>
    </section>
  {:else if !selected}
    <section class="empty-state" aria-live="polite"><p>Loading fixture records…</p></section>
  {:else}
    <div class="workspace">
      <aside class="fixture-list" aria-label="Fixture photographs">
        <div class="list-heading"><strong>{fixtures.length} fixtures</strong><span>{fixtures.filter((fixture) => fixture.reviewStatus === 'approved').length} approved</span></div>
        {#each fixtures as fixture, index}
          <button class:active={fixture.id === selected.id} onclick={() => selectFixture(fixture.id)}>
            <img src={imageUrl(fixture)} alt="" />
            <span><strong>{index + 1}. {fixture.expected.cardLabel}</strong><small>{fixture.id} · {fixture.expected.stars.length} stars</small></span>
            <i class:approved={fixture.reviewStatus === 'approved'}>{fixture.reviewStatus}</i>
          </button>
        {/each}
      </aside>

      <section class="editor">
        <div class="fixture-heading">
          <button class="icon-button" aria-label="Previous fixture" onclick={() => adjacentFixture(-1)}>←</button>
          <div><p>Fixture {selectedIndex + 1} of {fixtures.length}</p><h2>{selected.expected.cardLabel}</h2></div>
          <button class="icon-button" aria-label="Next fixture" onclick={() => adjacentFixture(1)}>→</button>
        </div>

        <div class="toolbar" aria-label="Annotation tools">
          <button class:active={tool === 'select'} onclick={() => (tool = 'select')}>Select / move</button>
          <button class:active={tool === 'add-gold'} onclick={() => (tool = 'add-gold')}>+ Gold star</button>
          <button class:active={tool === 'add-red'} onclick={() => (tool = 'add-red')}>+ Red star</button>
          <span>{goldCount} gold · {redCount} red</span>
        </div>

        <div class:adding={tool !== 'select'} class="image-stage">
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <svg
            bind:this={overlay}
            viewBox={`0 0 ${selected.image.width} ${selected.image.height}`}
            aria-label={`Annotated photograph for ${selected.expected.cardLabel}`}
            onpointermove={moveDrag}
            onpointerup={endDrag}
            onpointercancel={endDrag}
            onpointerleave={endDrag}
          >
            <defs>
              <marker id="north-arrow" markerWidth="24" markerHeight="24" refX="20" refY="12" orient="auto" markerUnits="userSpaceOnUse" viewBox="0 0 24 24">
                <path d="M 0 0 L 24 12 L 0 24 z" fill="#63e6ff" />
              </marker>
            </defs>
            <image href={imageUrl(selected)} width={selected.image.width} height={selected.image.height} />
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <rect class="interaction-surface" width={selected.image.width} height={selected.image.height} onpointerdown={addStar} />

            <polygon class="text-region" points={polygonPoints(selected)} />
            {#each selected.expected.textRegion.corners as corner, index}
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <circle
                class="handle text-handle"
                cx={corner.x * selected.image.width}
                cy={corner.y * selected.image.height}
                r="13"
                onpointerdown={(event) => beginDrag(event, { kind: 'text-corner', corner: index })}
              />
            {/each}

            <line
              class="north-line"
              x1={selected.expected.north.origin.x * selected.image.width}
              y1={selected.expected.north.origin.y * selected.image.height}
              x2={selected.expected.north.target.x * selected.image.width}
              y2={selected.expected.north.target.y * selected.image.height}
              marker-end="url(#north-arrow)"
            />
            <text class="north-label" x={selected.expected.north.target.x * selected.image.width} y={selected.expected.north.target.y * selected.image.height - 22}>NORTH</text>
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <circle
              class="handle north-handle"
              cx={selected.expected.north.origin.x * selected.image.width}
              cy={selected.expected.north.origin.y * selected.image.height}
              r="13"
              onpointerdown={(event) => beginDrag(event, { kind: 'north-origin' })}
            />
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <circle
              class="handle north-handle"
              cx={selected.expected.north.target.x * selected.image.width}
              cy={selected.expected.north.target.y * selected.image.height}
              r="13"
              onpointerdown={(event) => beginDrag(event, { kind: 'north-target' })}
            />

            {#each selected.expected.stars as star}
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <circle
                class:gold={star.color === 'gold'}
                class:red={star.color === 'red'}
                class:selected={star.id === selectedStarId}
                class="star-circle"
                cx={star.center.x * selected.image.width}
                cy={star.center.y * selected.image.height}
                r={star.radius * selected.image.width}
                onpointerdown={(event) => beginDrag(event, { kind: 'star-center', starId: star.id })}
              />
              {#if star.id === selectedStarId}
                <line
                  class="radius-guide"
                  x1={star.center.x * selected.image.width}
                  y1={star.center.y * selected.image.height}
                  x2={(star.center.x + star.radius) * selected.image.width}
                  y2={star.center.y * selected.image.height}
                />
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <circle
                  class="handle radius-handle"
                  cx={(star.center.x + star.radius) * selected.image.width}
                  cy={star.center.y * selected.image.height}
                  r="13"
                  onpointerdown={(event) => beginDrag(event, { kind: 'star-radius', starId: star.id })}
                />
              {/if}
            {/each}
          </svg>
        </div>

        <p class="legend"><span class="text-key"></span> Text region <span class="north-key">↑</span> Card-defined north <span class="gold-key"></span> Gold token <span class="red-key"></span> Red token</p>
      </section>

      <aside class="inspector">
        <label>Printed card label<input value={selected.expected.cardLabel} oninput={updateLabel} /></label>
        <label>Review status<select value={selected.reviewStatus} onchange={updateReviewStatus}><option value="draft">Draft</option><option value="approved">Approved</option></select></label>

        <div class="selected-object">
          <h3>Selected token</h3>
          {#if selectedStar}
            <dl>
              <div><dt>ID</dt><dd>{selectedStar.id}</dd></div>
              <div><dt>Color</dt><dd>{selectedStar.color}</dd></div>
              <div><dt>Center</dt><dd>{selectedStar.center.x.toFixed(4)}, {selectedStar.center.y.toFixed(4)}</dd></div>
              <div><dt>Radius</dt><dd>{selectedStar.radius.toFixed(4)}</dd></div>
            </dl>
            <div class="object-actions"><button onclick={toggleSelectedColor}>Toggle color</button><button class="danger" onclick={removeSelectedStar}>Delete</button></div>
          {:else}
            <p>Select a token circle to move, resize, recolor, or delete it. Drag cyan handles to correct text and north.</p>
          {/if}
        </div>

        <div class="save-actions">
          <button class="primary" disabled={!isDirty} onclick={saveSelected}>Save JSON</button>
          <button disabled={!isDirty} onclick={resetSelected}>Reset</button>
          <button onclick={downloadSelected}>Download JSON</button>
        </div>
        <p class="save-state" class:dirty={isDirty}>{isDirty ? 'Unsaved changes' : 'Record matches disk'}{saveMessage ? ` · ${saveMessage}` : ''}</p>

        <details>
          <summary>JSON preview</summary>
          <pre>{JSON.stringify(selected, null, 2)}</pre>
        </details>
      </aside>
    </div>
  {/if}
</main>

<style>
  :global(*) { box-sizing: border-box; }
  :global(html) { color-scheme: dark; background:#07111d; }
  :global(body) { margin:0; min-width:320px; background:#07111d; color:#f7f3e8; font-family:ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
  :global(button), :global(input), :global(select) { font:inherit; }
  :global(button:focus-visible), :global(input:focus-visible), :global(select:focus-visible), :global(summary:focus-visible), :global(a:focus-visible) { outline:3px solid #63e6ff; outline-offset:3px; }
  main { min-height:100dvh; padding:24px; }
  .page-header { display:flex; max-width:1700px; margin:0 auto 22px; align-items:flex-start; justify-content:space-between; gap:24px; }
  .eyebrow { margin:0 0 6px; color:#63e6ff; font-size:.75rem; font-weight:800; letter-spacing:.16em; text-transform:uppercase; }
  h1,h2,h3,p { margin-top:0; } h1 { margin-bottom:8px; font:500 clamp(2rem,4vw,3.5rem)/1 Georgia,serif; color:#f4c24d; } h2 { margin:2px 0 0; font:500 1.7rem Georgia,serif; color:#f4c24d; }
  .lede { max-width:760px; margin:0; color:#b9c5d3; line-height:1.5; }
  a { color:#f4c24d; font-weight:800; }
  .workspace { display:grid; grid-template-columns:260px minmax(440px,1fr) 310px; max-width:1700px; margin:0 auto; gap:18px; align-items:start; }
  .fixture-list,.editor,.inspector,.empty-state { border:1px solid #294057; border-radius:16px; background:#0b1a29; box-shadow:0 20px 50px #0005; }
  .fixture-list { max-height:calc(100dvh - 150px); overflow:auto; padding:10px; position:sticky; top:14px; }
  .list-heading { display:flex; justify-content:space-between; padding:7px 5px 12px; color:#b9c5d3; font-size:.75rem; }
  .fixture-list button { display:grid; grid-template-columns:48px 1fr auto; width:100%; min-height:66px; margin:0 0 6px; padding:7px; align-items:center; gap:9px; border:1px solid transparent; border-radius:10px; background:#07121e; color:inherit; text-align:left; cursor:pointer; }
  .fixture-list button:hover,.fixture-list button.active { border-color:#f4c24d; background:#10243a; }
  .fixture-list img { width:48px; height:56px; border-radius:5px; object-fit:cover; }
  .fixture-list span { min-width:0; } .fixture-list strong,.fixture-list small { display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; } .fixture-list small { margin-top:4px; color:#8fa1b4; font-size:.68rem; }
  .fixture-list i { padding:3px 5px; border-radius:999px; background:#442c19; color:#ffd493; font-size:.58rem; font-style:normal; text-transform:uppercase; } .fixture-list i.approved { background:#123d33; color:#7df3c8; }
  .editor { padding:14px; }
  .fixture-heading { display:grid; grid-template-columns:44px 1fr 44px; margin-bottom:12px; align-items:center; text-align:center; } .fixture-heading p { margin:0; color:#91a3b5; font-size:.72rem; text-transform:uppercase; letter-spacing:.12em; }
  .icon-button { width:44px; height:44px; border:1px solid #3a5065; border-radius:50%; background:#0e2134; color:#fff; cursor:pointer; }
  .toolbar { display:flex; margin-bottom:10px; align-items:center; gap:7px; flex-wrap:wrap; }
  .toolbar button,.object-actions button,.save-actions button { min-height:40px; padding:8px 11px; border:1px solid #3b5268; border-radius:8px; background:#0f2235; color:#eaf0f7; cursor:pointer; }
  .toolbar button.active { border-color:#f4c24d; background:#5b4515; color:#fff4d4; } .toolbar span { margin-left:auto; color:#b9c5d3; font-size:.78rem; }
  .image-stage { overflow:hidden; width:min(100%,720px); margin:0 auto; border:1px solid #30475e; border-radius:10px; background:#02070c; box-shadow:inset 0 0 30px #000; } .image-stage.adding { cursor:crosshair; }
  svg { display:block; width:100%; height:auto; touch-action:none; user-select:none; }
  .interaction-surface { fill:transparent; }
  .text-region { fill:#5ce1ff26; stroke:#63e6ff; stroke-width:6; stroke-dasharray:18 10; vector-effect:non-scaling-stroke; }
  .north-line { stroke:#63e6ff; stroke-width:7; vector-effect:non-scaling-stroke; } .north-label { fill:#63e6ff; font-size:28px; font-weight:900; text-anchor:middle; paint-order:stroke; stroke:#06101b; stroke-width:8px; }
  .star-circle { fill:#06101b55; stroke-width:7; vector-effect:non-scaling-stroke; cursor:grab; } .star-circle.gold { stroke:#ffe16a; } .star-circle.red { stroke:#ff665e; } .star-circle.selected { fill:#fff3; stroke-width:11; }
  .handle { stroke:#06101b; stroke-width:5; vector-effect:non-scaling-stroke; cursor:grab; } .text-handle,.north-handle { fill:#63e6ff; } .radius-handle { fill:#fff; } .radius-guide { stroke:#fff; stroke-width:4; stroke-dasharray:10 8; vector-effect:non-scaling-stroke; }
  .legend { display:flex; margin:11px 0 0; align-items:center; justify-content:center; gap:7px; flex-wrap:wrap; color:#aebccc; font-size:.72rem; } .legend span { display:inline-block; margin-left:8px; } .text-key { width:20px; border-top:3px dashed #63e6ff; } .north-key { color:#63e6ff; font-size:1.2rem; } .gold-key,.red-key { width:13px; height:13px; border:3px solid; border-radius:50%; } .gold-key { border-color:#ffe16a!important; } .red-key { border-color:#ff665e!important; }
  .inspector { padding:16px; position:sticky; top:14px; }
  label { display:block; margin-bottom:13px; color:#acbdcd; font-size:.76rem; font-weight:800; letter-spacing:.04em; } input,select { display:block; width:100%; min-height:44px; margin-top:6px; padding:9px 10px; border:1px solid #405870; border-radius:8px; background:#06121e; color:#fff; }
  .selected-object { margin:18px 0; padding:14px; border:1px solid #2b4257; border-radius:10px; background:#071522; } .selected-object h3 { margin-bottom:10px; color:#f4c24d; font-size:.88rem; } .selected-object p { margin:0; color:#99aabc; font-size:.78rem; line-height:1.5; }
  dl { margin:0; font-size:.75rem; } dl div { display:flex; justify-content:space-between; gap:12px; padding:4px 0; } dt { color:#8fa2b5; } dd { margin:0; font-family:ui-monospace,SFMono-Regular,Menlo,monospace; }
  .object-actions,.save-actions { display:flex; margin-top:12px; gap:7px; flex-wrap:wrap; } .object-actions button { min-height:36px; font-size:.72rem; } button.danger { border-color:#7b3737; color:#ff9c96; }
  .save-actions .primary { border-color:#f4c24d; background:#f4c24d; color:#15202b; font-weight:900; } button:disabled { opacity:.42; cursor:not-allowed; }
  .save-state { min-height:18px; margin:9px 0 18px; color:#7df3c8; font-size:.72rem; } .save-state.dirty { color:#ffd493; }
  details { border-top:1px solid #2b4257; padding-top:12px; } summary { cursor:pointer; color:#b8c7d5; font-size:.78rem; } pre { max-height:340px; overflow:auto; padding:10px; border-radius:8px; background:#030a11; color:#b8e8f0; font-size:.65rem; line-height:1.45; }
  .empty-state { max-width:700px; margin:80px auto; padding:32px; text-align:center; } .empty-state code { display:inline-block; padding:8px 11px; border-radius:6px; background:#02080e; }
  @media (max-width:1100px) { .workspace { grid-template-columns:210px minmax(0,1fr); } .inspector { grid-column:2; position:static; } }
  @media (max-width:720px) { main { padding:14px; } .page-header { display:block; } .page-header a { display:inline-block; margin-top:14px; } .workspace { display:flex; flex-direction:column; } .fixture-list { display:flex; width:100%; max-height:none; position:static; overflow-x:auto; } .list-heading { min-width:100px; flex-direction:column; } .fixture-list button { min-width:190px; } .editor,.inspector { width:100%; } .toolbar span { width:100%; margin-left:0; } }
</style>
