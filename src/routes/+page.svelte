<script lang="ts">
  import { onMount } from 'svelte';
  import { analyzePhotograph } from '$lib/analyze';
  import { BUILD_HASH, fetchDeployedBuild, isDifferentBuild, shortBuildHash } from '$lib/build';
  import {
    clearSession,
    loadHistory,
    loadSession,
    requestPersistentStorage,
    saveCompletedSession,
    saveSession
  } from '$lib/persistence';
  import { renderZodiac } from '$lib/render';
  import { saveZodiac, shareZodiac } from '$lib/share';
  import { newSession, type DetectedStar, type GameHistoryEntry, type GameSession } from '$lib/types';
  import type { RecognizedTextRegion } from '$lib/ocr';

  type Stage = 'loading' | 'welcome' | 'capture' | 'processing' | 'confirm' | 'review' | 'generating' | 'result' | 'history' | 'history-result';
  interface PendingCapture {
    image: Blob;
    preview: string;
    cardLabel: string;
    stars: DetectedStar[];
    textRegion?: RecognizedTextRegion;
    imageAspectRatio: number;
  }
  type BuildFreshness = 'checking' | 'current' | 'available' | 'offline' | 'unknown' | 'refreshing';

  let stage: Stage = 'loading';
  let session: GameSession | undefined;
  let pending: PendingCapture | undefined;
  let previews: Record<string, string> = {};
  let history: GameHistoryEntry[] = [];
  let historyPreviews: Record<string, string> = {};
  let historySelection: GameHistoryEntry | undefined;
  let resultUrl = '';
  let message = '';
  let errorMessage = '';
  let fileInput: HTMLInputElement;
  let buildFreshness: BuildFreshness = 'checking';
  let deployedBuildHash = '';

  $: goldCount = session?.captures.flatMap((capture) => capture.stars).filter((star) => star.color === 'gold').length ?? 0;
  $: redCount = session?.captures.flatMap((capture) => capture.stars).filter((star) => star.color === 'red').length ?? 0;
  $: pendingGold = pending?.stars.filter((star) => star.color === 'gold').length ?? 0;
  $: pendingRed = pending?.stars.filter((star) => star.color === 'red').length ?? 0;
  $: canRefreshBuild = stage === 'welcome' || stage === 'result' || stage === 'history' || stage === 'history-result';

  onMount(() => {
    const handleOnline = () => void checkBuildFreshness();
    const handleOffline = () => (buildFreshness = 'offline');
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') void checkBuildFreshness();
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('visibilitychange', handleVisibility);
    const buildCheckTimer = window.setInterval(() => void checkBuildFreshness(), 5 * 60 * 1000);
    void checkBuildFreshness();

    void Promise.all([loadSession().catch(() => undefined), loadHistory().catch(() => [])]).then(
      async ([restored, savedHistory]) => {
        if (restored?.output && !savedHistory.some((entry) => entry.id === restored.id)) {
          try {
            const migrated = await saveCompletedSession(restored, restored.updatedAt);
            savedHistory = [migrated, ...savedHistory];
          } catch {}
        }
        history = savedHistory;
        hydrateHistoryPreviews(history);
        session = restored;
        if (session) {
          hydratePreviews(session);
          if (session.output) {
            resultUrl = URL.createObjectURL(session.output);
            stage = 'result';
          } else if (session.captures.length === 6) stage = 'review';
          else stage = 'welcome';
        } else stage = 'welcome';
      }
    );
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.clearInterval(buildCheckTimer);
      Object.values(previews).forEach(URL.revokeObjectURL);
      Object.values(historyPreviews).forEach(URL.revokeObjectURL);
      if (pending) URL.revokeObjectURL(pending.preview);
      if (resultUrl) URL.revokeObjectURL(resultUrl);
    };
  });

  async function checkBuildFreshness() {
    if (!navigator.onLine) {
      buildFreshness = 'offline';
      return;
    }
    try {
      const deployed = await fetchDeployedBuild();
      deployedBuildHash = deployed.hash;
      buildFreshness = deployed.source === 'cache'
        ? 'offline'
        : isDifferentBuild(deployed.hash) ? 'available' : 'current';
      if (buildFreshness === 'available' && 'serviceWorker' in navigator) {
        void navigator.serviceWorker.getRegistration().then((registration) => registration?.update());
      }
    } catch {
      buildFreshness = navigator.onLine ? 'unknown' : 'offline';
    }
  }

  async function refreshToLatestBuild() {
    if (!deployedBuildHash) return;
    buildFreshness = 'refreshing';
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.getRegistration();
        await registration?.update();
        registration?.waiting?.postMessage({ type: 'ACTIVATE_UPDATE' });
      } catch {}
    }
    const target = new URL(location.href);
    target.searchParams.set('build', shortBuildHash(deployedBuildHash));
    location.replace(target);
  }

  function hydratePreviews(value: GameSession) {
    Object.values(previews).forEach(URL.revokeObjectURL);
    previews = Object.fromEntries(value.captures.map((capture) => [capture.id, URL.createObjectURL(capture.image)]));
  }

  function hydrateHistoryPreviews(entries: GameHistoryEntry[]) {
    Object.values(historyPreviews).forEach(URL.revokeObjectURL);
    historyPreviews = Object.fromEntries(
      entries.map((entry) => [entry.id, URL.createObjectURL(entry.output)])
    );
  }

  async function startGame() {
    errorMessage = '';
    if (!session || session.status === 'complete') {
      session = newSession();
      await saveSession(session);
    }
    void requestPersistentStorage();
    stage = session.captures.length === 6 ? 'review' : 'capture';
  }

  async function choosePhoto(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    stage = 'processing';
    errorMessage = '';
    message = 'Reading the printed card and finding its stars…';
    try {
      const analysis = await analyzePhotograph(file);
      pending = {
        ...analysis,
        preview: URL.createObjectURL(analysis.image)
      };
      stage = 'confirm';
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'That photograph could not be read.';
      stage = 'capture';
    } finally {
      input.value = '';
    }
  }

  function toggleStar(starId: string) {
    if (!pending) return;
    pending.stars = pending.stars.map((star) =>
      star.id === starId ? { ...star, color: star.color === 'gold' ? 'red' : 'gold' } : star
    );
    pending = { ...pending };
  }

  function addStar(color: 'gold' | 'red') {
    if (!pending) return;
    pending.stars = [
      ...pending.stars,
      {
        id: crypto.randomUUID(),
        color,
        x: 0.5,
        y: 0.5,
        size: color === 'red' ? 0.14 : 0.075,
        confidence: 1
      }
    ];
    pending = { ...pending };
  }

  function removeLastStar() {
    if (!pending?.stars.length) return;
    pending.stars = pending.stars.slice(0, -1);
    pending = { ...pending };
  }

  function retake() {
    if (pending) URL.revokeObjectURL(pending.preview);
    pending = undefined;
    stage = 'capture';
    requestAnimationFrame(() => fileInput?.click());
  }

  async function keepPhoto() {
    if (!session || !pending || !pending.cardLabel.trim() || pending.stars.length === 0) return;
    const id = crypto.randomUUID();
    const next = {
      id,
      order: session.captures.length,
      cardLabel: pending.cardLabel.trim().toUpperCase(),
      image: pending.image,
      stars: pending.stars,
      cardRotationDegrees: pending.textRegion?.rotationDegrees,
      imageAspectRatio: pending.imageAspectRatio,
      acceptedAt: new Date().toISOString()
    };
    session.captures = [...session.captures, next];
    session.status = session.captures.length === 6 ? 'reviewing' : 'capturing';
    previews = { ...previews, [id]: pending.preview };
    pending = undefined;
    await saveSession(session);
    session = { ...session };
    stage = session.captures.length === 6 ? 'review' : 'capture';
  }

  async function removeCapture(id: string) {
    if (!session) return;
    URL.revokeObjectURL(previews[id]);
    const { [id]: removed, ...remainingPreviews } = previews;
    void removed;
    previews = remainingPreviews;
    session.captures = session.captures
      .filter((capture) => capture.id !== id)
      .map((capture, order) => ({ ...capture, order }));
    session.status = 'capturing';
    await saveSession(session);
    session = { ...session };
    stage = 'capture';
  }

  async function generate() {
    if (!session || session.captures.length !== 6) return;
    stage = 'generating';
    message = '';
    errorMessage = '';
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    try {
      const output = await renderZodiac(session);
      session.output = output;
      session.status = 'complete';
      const archived = await saveCompletedSession(session);
      const previousHistoryUrl = historyPreviews[archived.id];
      if (previousHistoryUrl) URL.revokeObjectURL(previousHistoryUrl);
      history = [archived, ...history.filter((entry) => entry.id !== archived.id)];
      historyPreviews = { ...historyPreviews, [archived.id]: URL.createObjectURL(output) };
      if (resultUrl) URL.revokeObjectURL(resultUrl);
      resultUrl = URL.createObjectURL(output);
      session = { ...session };
      stage = 'result';
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'The Zodiac could not be generated.';
      stage = 'review';
    }
  }

  async function shareOutput(output: Blob) {
    const outcome = await shareZodiac(output);
    message = outcome === 'shared' ? 'Your Zodiac is ready to share.' : outcome === 'saved' ? 'Your Zodiac was saved.' : '';
  }

  function openHistoryEntry(entry: GameHistoryEntry) {
    historySelection = entry;
    message = '';
    stage = 'history-result';
  }

  async function startAnother() {
    if (!confirm('Start another game? Your completed Zodiac will stay in Game history.')) return;
    await clearSession();
    Object.values(previews).forEach(URL.revokeObjectURL);
    previews = {};
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    resultUrl = '';
    session = undefined;
    pending = undefined;
    historySelection = undefined;
    message = '';
    stage = 'welcome';
  }
</script>

<svelte:head>
  <title>Zodiac — A game becomes a constellation</title>
  <meta name="description" content="Turn six gameplay photos into a private constellation keepsake." />
</svelte:head>

<main class:camera-stage={stage === 'capture' || stage === 'confirm'} data-e2e-layout data-status="ready">
  {#if stage === 'loading'}
    <section class="center-panel" aria-live="polite">
      <div class="spinner" aria-hidden="true">✦</div>
      <p>Opening Zodiac…</p>
    </section>
  {:else if stage === 'welcome'}
    <section class="welcome">
      <div class="chart-preview" aria-hidden="true">
        <div class="preview-ring"></div>
        <span class="preview-star one">★</span><span class="preview-star two">★</span>
        <span class="preview-star three">★</span><span class="preview-star four">★</span>
      </div>
      <div class="welcome-copy">
        <p class="eyebrow">A tabletop keepsake</p>
        <h1>Zodiac</h1>
        <p class="promise">A game becomes a constellation.</p>
        <p class="privacy-note">Six quick photographs. Everything stays on this device unless you share the result.</p>
      </div>
      <button class="primary" onclick={startGame}>
        {session?.captures.length ? `Resume game · ${session.captures.length} of 6` : 'Start a game'}
      </button>
      {#if history.length}
        <button class="secondary" onclick={() => (stage = 'history')}>Game history · {history.length}</button>
      {/if}
      <details class="install-help">
        <summary>Add Zodiac to your Home Screen</summary>
        <p>In Safari, tap Share, then Add to Home Screen for a full-screen game companion.</p>
      </details>
    </section>
  {:else if stage === 'history'}
    <section class="history-screen">
      <header>
        <button class="text-button" onclick={() => (stage = session?.output ? 'result' : 'welcome')}>Back</button>
        <div>
          <p class="eyebrow">Saved on this device</p>
          <h1>Game history</h1>
        </div>
        <span class="counter">{history.length}</span>
      </header>
      <p class="history-intro">Completed Zodiacs stay here so you can open, save, or share them again.</p>
      <ul class="history-list">
        {#each history as entry}
          <li>
            <button
              class="history-card"
              aria-label={`Open Zodiac from ${new Intl.DateTimeFormat('en-CA', { dateStyle: 'long' }).format(new Date(entry.completedAt))}`}
              onclick={() => openHistoryEntry(entry)}
            >
              <img src={historyPreviews[entry.id]} alt="" />
              <span class="history-copy">
                <strong>{new Intl.DateTimeFormat('en-CA', { dateStyle: 'medium' }).format(new Date(entry.completedAt))}</strong>
                <span>{entry.cardLabels.join(' · ')}</span>
                <small>{entry.goldCount + entry.redCount} stars · {entry.goldCount} gold · {entry.redCount} red</small>
              </span>
              <span class="history-arrow" aria-hidden="true">›</span>
            </button>
          </li>
        {/each}
      </ul>
    </section>
  {:else if stage === 'history-result' && historySelection}
    <section class="result-screen history-result-screen">
      <header class="history-result-header">
        <button class="text-button" onclick={() => (stage = 'history')}>Back</button>
        <div>
          <p class="eyebrow">From game history</p>
          <h1>Saved Zodiac</h1>
        </div>
        <time datetime={historySelection.completedAt}>{new Intl.DateTimeFormat('en-CA', { dateStyle: 'medium' }).format(new Date(historySelection.completedAt))}</time>
      </header>
      <img
        class="result-image"
        src={historyPreviews[historySelection.id]}
        alt={`Saved Zodiac with six constellations, ${historySelection.goldCount} gold stars, and ${historySelection.redCount} red stars`}
      />
      <p class="result-summary">{historySelection.cardLabels.join(' · ')}</p>
      <p class="result-summary">Six constellations · {historySelection.goldCount + historySelection.redCount} stars · saved locally</p>
      {#if message}<p class="success" role="status">{message}</p>{/if}
      <div class="result-actions">
        <button class="primary" onclick={() => shareOutput(historySelection!.output)}>Share again</button>
        <button class="secondary" onclick={() => saveZodiac(historySelection!.output)}>Save image</button>
      </div>
    </section>
  {:else if stage === 'capture'}
    <section class="capture-screen">
      <header>
        <button class="text-button" onclick={() => (stage = session?.captures.length ? 'review' : 'welcome')}>Back</button>
        <div>
          <p class="eyebrow">Constellation {Math.min((session?.captures.length ?? 0) + 1, 6)} of 6</p>
          <h1>Capture the table</h1>
        </div>
        <span class="counter">{session?.captures.length ?? 0}/6</span>
      </header>
      <div class="camera-placeholder">
        <div class="focus-corners" aria-hidden="true"></div>
        <div class="camera-message">
          <span>✦</span>
          <strong>Keep the printed card and every star in frame</strong>
          <small>Token color, position, and size will be preserved.</small>
        </div>
      </div>
      {#if errorMessage}<p class="error" role="alert">{errorMessage}</p>{/if}
      <div class="capture-controls">
        <input
          id="photo-input"
          bind:this={fileInput}
          class="visually-hidden"
          type="file"
          accept="image/*"
          capture="environment"
          onchange={choosePhoto}
        />
        <label class="shutter" for="photo-input" aria-label={`Take photo for constellation ${(session?.captures.length ?? 0) + 1} of 6`}>
          <span></span>
        </label>
        <p>Take or choose photo</p>
      </div>
    </section>
  {:else if stage === 'processing'}
    <section class="center-panel" aria-live="polite">
      <div class="mapping" aria-hidden="true"><span>✦</span><span>✦</span><span>✦</span></div>
      <h1>Reading the stars…</h1>
      <p>{message}</p>
      <small>Recognition runs locally. Keep Zodiac open.</small>
    </section>
  {:else if stage === 'confirm' && pending}
    <section class="confirm-screen">
      <header>
        <button class="text-button" onclick={retake}>Retake</button>
        <div>
          <p class="eyebrow">Check photograph</p>
          <h1>{pending.stars.length} stars found</h1>
        </div>
        <span class="counter">{(session?.captures.length ?? 0) + 1}/6</span>
      </header>
      <div class="photo-review">
        <img src={pending.preview} alt="Captured card and star tokens" />
        <div class="star-region" aria-label="Detected stars">
          {#each pending.stars as star (star.id)}
            <button
              class:gold={star.color === 'gold'}
              class:red={star.color === 'red'}
              class="detected-star"
              style={`left:${star.x * 100}%;top:${star.y * 100}%;width:${Math.max(26, star.size * 260)}px;height:${Math.max(26, star.size * 260)}px`}
              data-star-x={star.x}
              data-star-y={star.y}
              data-star-size={star.size}
              aria-label={`${star.color} star, tap to change color`}
              title="Tap to change color"
              onclick={() => toggleStar(star.id)}
            >★</button>
          {/each}
        </div>
      </div>
      <div class="confirm-card">
        <label for="card-name">Printed card name</label>
        <input id="card-name" bind:value={pending.cardLabel} autocomplete="off" autocapitalize="characters" placeholder="Read from the photographed card" />
        {#if pending.textRegion}
          <output
            class="visually-hidden"
            data-testid="recognized-text-region"
            data-center-x={pending.textRegion.center.x}
            data-center-y={pending.textRegion.center.y}
            data-width={pending.textRegion.width}
            data-height={pending.textRegion.height}
            data-rotation-degrees={pending.textRegion.rotationDegrees}
          >Text direction {pending.textRegion.rotationDegrees.toFixed(1)} degrees</output>
        {/if}
        <div class="token-summary" aria-label={`${pendingGold} gold and ${pendingRed} red stars`}>
          <span class="gold-ink">★ {pendingGold} gold</span><span class="red-ink">★ {pendingRed} red</span>
        </div>
        <div class="edit-row">
          <button class="chip" onclick={() => addStar('gold')}>+ Gold star</button>
          <button class="chip" onclick={() => addStar('red')}>+ Red star</button>
          <button class="chip" disabled={!pending.stars.length} onclick={removeLastStar}>Remove last</button>
        </div>
        {#if !pending.cardLabel.trim()}<p class="hint">Check the photo and enter the name printed on its card.</p>{/if}
        {#if !pending.stars.length}<p class="hint">No tokens were clear enough. Retake or add them from the photo.</p>{/if}
        <button class="primary" disabled={!pending.cardLabel.trim() || !pending.stars.length} onclick={keepPhoto}>Keep photo</button>
      </div>
    </section>
  {:else if stage === 'review' && session}
    <section class="review-screen">
      <header class="simple-header">
        <div>
          <p class="eyebrow">All six captured</p>
          <h1>Ready to make your Zodiac?</h1>
        </div>
        <span class="counter">6/6</span>
      </header>
      <div class="totals" aria-label={`${goldCount} gold and ${redCount} red stars`}>
        <div><strong>{session.captures.length}</strong><span>constellations</span></div>
        <div class="gold-ink"><strong>{goldCount}</strong><span>gold stars</span></div>
        <div class="red-ink"><strong>{redCount}</strong><span>red stars</span></div>
      </div>
      <p class="total-line">{goldCount + redCount} stars recorded with their original sizes</p>
      <ol class="capture-grid">
        {#each session.captures as capture}
          <li>
            <img src={previews[capture.id]} alt={`${capture.cardLabel} gameplay photograph`} />
            <div><strong>{capture.cardLabel}</strong><span>{capture.stars.length} stars</span></div>
            <button aria-label={`Remove ${capture.cardLabel} and retake`} onclick={() => removeCapture(capture.id)}>Retake</button>
          </li>
        {/each}
      </ol>
      {#if errorMessage}<p class="error" role="alert">{errorMessage}</p>{/if}
      <button class="primary" disabled={session.captures.length !== 6} onclick={generate}>Generate Zodiac</button>
    </section>
  {:else if stage === 'generating'}
    <section class="center-panel generating" aria-live="polite">
      <div class="generating-chart" aria-hidden="true">
        <span>★</span><span>★</span><span>★</span><span>★</span><span>★</span><span>★</span>
      </div>
      <h1>Mapping the stars…</h1>
      <p>Composing six constellations locally.</p>
      <small>Keep Zodiac open.</small>
    </section>
  {:else if stage === 'result' && session?.output}
    <section class="result-screen">
      <header class="simple-header">
        <div>
          <p class="eyebrow">A game remembered</p>
          <h1>Your Zodiac</h1>
        </div>
        <time datetime={session.createdAt}>{new Intl.DateTimeFormat('en-CA', { dateStyle: 'medium' }).format(new Date(session.createdAt))}</time>
      </header>
      <img class="result-image" src={resultUrl} alt={`Zodiac with six constellations, ${goldCount} gold stars, and ${redCount} red stars`} />
      <p class="result-summary">Six constellations · {goldCount + redCount} stars · rendered privately on this device</p>
      {#if message}<p class="success" role="status">{message}</p>{/if}
      <div class="result-actions">
        <button class="primary" onclick={() => shareOutput(session!.output!)}>Share</button>
        <button class="secondary" onclick={() => saveZodiac(session!.output!)}>Save image</button>
        <button class="secondary" onclick={() => (stage = 'history')}>Game history · {history.length}</button>
        <button class="text-button restart" onclick={startAnother}>Start another</button>
      </div>
    </section>
  {/if}
  <footer class="build-status" data-freshness={buildFreshness} aria-live="polite">
    <span data-testid="build-marker" title={`Full build ${BUILD_HASH}`}>Build {shortBuildHash()}</span>
    <span aria-hidden="true">·</span>
    {#if buildFreshness === 'available'}
      {#if canRefreshBuild}
        <button class="build-update" onclick={refreshToLatestBuild}>Update available · Refresh</button>
      {:else}
        <span>Update available</span>
      {/if}
    {:else if buildFreshness === 'offline'}
      <span>Offline</span>
    {:else if buildFreshness === 'checking'}
      <span>Checking…</span>
    {:else if buildFreshness === 'refreshing'}
      <span>Refreshing…</span>
    {:else if buildFreshness === 'current'}
      <span>Current</span>
    {:else}
      <span>Status unavailable</span>
    {/if}
  </footer>
</main>

<style>
  :global(*) { box-sizing: border-box; }
  :global(html) { background: #010a14; color-scheme: dark; }
  :global(body) { margin: 0; min-width: 320px; background: #010a14; color: #fff7e7; font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
  :global(button), :global(input) { font: inherit; }
  :global(button), :global(label.shutter), :global(summary) { -webkit-tap-highlight-color: transparent; }
  :global(button:focus-visible), :global(input:focus-visible), :global(summary:focus-visible), :global(label.shutter:focus-within) { outline: 3px solid #fff7e7; outline-offset: 3px; }
  main { position: relative; width: min(100%, 540px); min-height: 100dvh; margin: 0 auto; overflow-x: hidden; background: radial-gradient(circle at 50% 16%, #0b2a49 0, #031426 48%, #010a14 100%); padding: max(22px, env(safe-area-inset-top)) 20px max(24px, env(safe-area-inset-bottom)); }
  main::before { content: ""; position: absolute; inset: 0; pointer-events: none; opacity: .36; background-image: radial-gradient(circle, #fff 0 1px, transparent 1.5px), radial-gradient(circle, #f3b83f 0 1px, transparent 1.5px); background-position: 17px 31px, 81px 119px; background-size: 97px 103px, 151px 167px; mask-image: linear-gradient(#000, transparent 70%); }
  section { position: relative; z-index: 1; min-height: calc(100dvh - 78px - env(safe-area-inset-top) - env(safe-area-inset-bottom)); }
  h1 { margin: 0; font-family: Georgia, "Times New Roman", serif; font-weight: 500; color: #f7c451; letter-spacing: -.02em; }
  p { line-height: 1.45; }
  button { color: inherit; }
  .eyebrow { margin: 0 0 5px; color: #f3b83f; font-size: .72rem; font-weight: 800; letter-spacing: .15em; text-transform: uppercase; }
  .primary, .secondary { display: grid; place-items: center; width: 100%; min-height: 56px; border-radius: 999px; border: 1px solid #f3b83f; font-weight: 800; cursor: pointer; }
  .primary { background: linear-gradient(135deg, #f0a82f, #ffd466); color: #061426; box-shadow: 0 12px 32px #0008, inset 0 1px #fff8; }
  .secondary { background: #06192b; color: #f7c451; }
  button:disabled { cursor: not-allowed; opacity: .45; }
  .text-button { min-width: 44px; min-height: 44px; padding: 0; border: 0; background: none; color: #f7c451; cursor: pointer; }
  .counter { display: grid; place-items: center; min-width: 46px; height: 34px; padding: 0 10px; border: 1px solid #f3b83f88; border-radius: 99px; color: #f7c451; font-size: .8rem; font-weight: 800; }
  .welcome { display: flex; flex-direction: column; justify-content: center; text-align: center; gap: 24px; }
  .chart-preview { position: relative; width: min(68vw, 270px); aspect-ratio: 1; margin: 0 auto; border: 2px solid #f3b83f; border-radius: 50%; box-shadow: 0 0 60px #14518355, inset 0 0 44px #0008; }
  .chart-preview::before, .chart-preview::after, .preview-ring { content: ""; position: absolute; inset: 9%; border: 1px solid #f3b83f99; border-radius: 50%; }
  .chart-preview::before { clip-path: polygon(49.5% 0,50.5% 0,50.5% 100%,49.5% 100%); background:#f3b83f; border:0; }
  .chart-preview::after { clip-path: polygon(0 49.5%,100% 49.5%,100% 50.5%,0 50.5%); background:#f3b83f; border:0; transform: rotate(30deg); }
  .preview-star { position: absolute; z-index: 2; color: #f3b83f; text-shadow: 0 0 10px currentColor; animation:pulse 5s ease-in-out infinite; }
  .preview-star.one { left: 29%; top: 20%; font-size: 24px; } .preview-star.two { right: 23%; top: 37%; color:#d83b2d; font-size:32px; } .preview-star.three { left: 38%; bottom: 20%; font-size:18px; } .preview-star.four { left: 18%; bottom: 38%; color:#d83b2d; font-size:20px; }
  .welcome h1 { font-size: clamp(3.3rem, 18vw, 5.2rem); line-height: .9; }
  .promise { margin: 12px 0 0; font-family: Georgia, serif; font-size: 1.22rem; }
  .privacy-note { max-width: 390px; margin: 13px auto 0; color: #d7deea; font-size: .9rem; }
  .install-help { color: #cbd6e3; font-size: .82rem; }
  .install-help summary { min-height: 44px; cursor: pointer; color: #f7c451; }
  .install-help p { margin: 4px 20px 0; }
  .capture-screen, .confirm-screen, .review-screen, .result-screen, .history-screen { display: flex; flex-direction: column; gap: 16px; }
  header, .simple-header { display: grid; grid-template-columns: 52px 1fr 52px; align-items: start; gap: 8px; }
  header > div { text-align: center; }
  header h1 { font-size: 1.45rem; }
  .camera-placeholder { position: relative; flex: 1; min-height: 480px; overflow: hidden; border-radius: 24px; background: linear-gradient(145deg, #6c4827, #291c13); box-shadow: inset 0 0 90px #0008; }
  .camera-placeholder::before { content:""; position:absolute; inset:0; opacity:.26; background: repeating-linear-gradient(8deg, transparent 0 20px, #d09a5b 21px, transparent 23px); }
  .focus-corners { position:absolute; inset:24px; border:2px solid #f3b83f; border-radius:20px; clip-path: polygon(0 0,24% 0,24% 2px,2px 2px,2px 24%,0 24%,0 0,100% 0,100% 24%,calc(100% - 2px) 24%,calc(100% - 2px) 2px,76% 2px,76% 0,100% 0,100% 100%,76% 100%,76% calc(100% - 2px),calc(100% - 2px) calc(100% - 2px),calc(100% - 2px) 76%,100% 76%,100% 100%,0 100%,0 76%,2px 76%,2px calc(100% - 2px),24% calc(100% - 2px),24% 100%); }
  .camera-message { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:36px; text-align:center; gap:10px; }
  .camera-message > span { color:#f3b83f; font-size:2.5rem; } .camera-message strong { font-family:Georgia,serif; font-size:1.35rem; } .camera-message small { color:#e8dfd2; }
  .capture-controls { display:grid; justify-items:center; gap:6px; }
  .capture-controls p { margin:0; color:#cbd6e3; font-size:.8rem; }
  .visually-hidden { position:absolute!important; width:1px!important; height:1px!important; padding:0!important; margin:-1px!important; overflow:hidden!important; clip:rect(0,0,0,0)!important; white-space:nowrap!important; border:0!important; }
  .shutter { display:grid; place-items:center; width:76px; height:76px; border:3px solid #fff; border-radius:50%; cursor:pointer; }
  .shutter span { width:60px; height:60px; border-radius:50%; background:#fff; box-shadow:inset 0 0 0 2px #ccc; }
  .center-panel { display:flex; min-height:calc(100dvh - 78px); flex-direction:column; align-items:center; justify-content:center; text-align:center; }
  .center-panel h1 { font-size:2.25rem; } .center-panel p { color:#d7deea; } .center-panel small { color:#9eacbb; }
  .spinner { color:#f3b83f; font-size:3rem; animation:pulse 1.3s ease-in-out infinite; }
  .mapping { display:flex; gap:24px; height:90px; align-items:center; color:#f3b83f; } .mapping span:nth-child(2) { color:#d83b2d; font-size:2rem; }
  .photo-review { position:relative; overflow:hidden; min-height:0; flex:1; border-radius:20px; background:#08121c; }
  .photo-review img { display:block; width:100%; height:100%; max-height:49dvh; object-fit:contain; }
  .star-region { position:absolute; inset:0; pointer-events:none; }
  .detected-star { position:absolute; display:grid; place-items:center; min-width:44px; min-height:44px; transform:translate(-50%,-50%); border:2px solid currentColor; border-radius:50%; background:#061426b8; pointer-events:auto; font-size:1rem; cursor:pointer; }
  .detected-star.gold { color:#ffd154; } .detected-star.red { color:#ef5749; }
  .confirm-card { display:grid; gap:10px; padding:14px; border:1px solid #f3b83f55; border-radius:20px; background:#06192bea; }
  .confirm-card label { color:#f7c451; font-size:.75rem; font-weight:800; letter-spacing:.1em; text-transform:uppercase; }
  .confirm-card input { width:100%; min-height:48px; padding:8px 12px; border:1px solid #f3b83f88; border-radius:10px; background:#fffaf0; color:#061426; font-family:Georgia,serif; font-size:1.35rem; text-transform:uppercase; }
  .token-summary, .edit-row { display:flex; flex-wrap:wrap; align-items:center; gap:8px 16px; }
  .token-summary { font-weight:800; } .gold-ink { color:#f7c451; } .red-ink { color:#ef5749; }
  .chip { min-height:44px; padding:5px 12px; border:1px solid #f3b83f66; border-radius:99px; background:#0b2843; cursor:pointer; }
  .hint, .error, .success { margin:0; padding:9px 12px; border-radius:10px; font-size:.82rem; }
  .hint { background:#f3b83f18; color:#f6dcaa; } .error { background:#9b241f88; color:#fff; } .success { background:#1d704f77; text-align:center; }
  .simple-header { grid-template-columns:1fr auto; }
  .simple-header > div { text-align:left; } .simple-header h1 { font-size:1.9rem; }
  .simple-header time, .history-result-header time { color:#d7deea; font-size:.8rem; }
  .history-result-header { grid-template-columns:52px 1fr auto; }
  .history-intro { margin:0; color:#cbd6e3; text-align:center; font-size:.88rem; }
  .history-list { display:grid; gap:12px; margin:0; padding:0; list-style:none; }
  .history-card { display:grid; grid-template-columns:92px minmax(0,1fr) 24px; align-items:center; width:100%; min-height:108px; overflow:hidden; padding:0; border:1px solid #f3b83f66; border-radius:16px; background:#06192be8; text-align:left; cursor:pointer; }
  .history-card img { width:92px; height:108px; object-fit:cover; }
  .history-copy { display:grid; min-width:0; gap:6px; padding:10px 12px; }
  .history-copy strong { color:#f7c451; font-family:Georgia,serif; font-size:1rem; }
  .history-copy > span { overflow:hidden; color:#fff7e7; font-size:.72rem; text-overflow:ellipsis; white-space:nowrap; }
  .history-copy small { color:#b9c6d4; font-size:.7rem; }
  .history-arrow { color:#f7c451; font-size:1.8rem; }
  .totals { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; }
  .totals div { display:grid; justify-items:center; gap:3px; padding:12px 4px; border:1px solid #f3b83f44; border-radius:14px; background:#06192bbf; }
  .totals strong { font-family:Georgia,serif; font-size:1.65rem; } .totals span { font-size:.68rem; text-transform:uppercase; letter-spacing:.06em; }
  .total-line { margin:-6px 0 0; color:#cbd6e3; text-align:center; font-size:.76rem; }
  .capture-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:10px; margin:0; padding:0; list-style:none; }
  .capture-grid li { position:relative; overflow:hidden; display:grid; grid-template-columns:58px 1fr; align-items:center; min-height:76px; border:1px solid #f3b83f66; border-radius:14px; background:#06192b; }
  .capture-grid img { width:58px; height:76px; object-fit:cover; } .capture-grid li > div { display:grid; min-width:0; padding:7px; gap:4px; } .capture-grid strong { overflow:hidden; color:#fff7e7; font-family:Georgia,serif; font-size:.82rem; text-overflow:ellipsis; white-space:nowrap; } .capture-grid span { color:#b9c6d4; font-size:.7rem; }
  .capture-grid button { position:absolute; top:0; right:0; min-width:44px; min-height:44px; border:0; background:transparent; color:transparent; cursor:pointer; } .capture-grid button::after { content:"↻"; position:absolute; top:7px; right:8px; color:#f7c451; font-size:1.15rem; }
  .generating-chart { position:relative; width:230px; aspect-ratio:1; margin-bottom:30px; border:2px solid #f3b83f; border-radius:50%; animation:pulse 1.8s ease-in-out infinite; }
  .generating-chart::before, .generating-chart::after { content:""; position:absolute; left:50%; top:0; width:1px; height:100%; background:#f3b83f88; transform:rotate(30deg); } .generating-chart::after { transform:rotate(-30deg); }
  .generating-chart span { position:absolute; color:#f3b83f; } .generating-chart span:nth-child(1){left:25%;top:22%}.generating-chart span:nth-child(2){left:62%;top:18%;color:#d83b2d}.generating-chart span:nth-child(3){left:70%;top:48%}.generating-chart span:nth-child(4){left:53%;top:72%;color:#d83b2d}.generating-chart span:nth-child(5){left:25%;top:65%}.generating-chart span:nth-child(6){left:17%;top:43%}
  .result-screen { justify-content:center; }
  .result-image { display:block; width:100%; aspect-ratio:1; object-fit:contain; border:1px solid #f3b83f; border-radius:6px; box-shadow:0 18px 50px #000b; }
  .result-summary { margin:0; text-align:center; color:#cbd6e3; font-size:.78rem; }
  .result-actions { display:grid; gap:10px; } .restart { width:100%; }
  .build-status { position:relative; z-index:2; display:flex; min-height:30px; align-items:center; justify-content:center; gap:6px; color:#91a2b5; font-size:.64rem; letter-spacing:.04em; }
  .build-update { min-height:44px; padding:4px 8px; border:0; background:transparent; color:#f7c451; font-size:.7rem; font-weight:800; text-decoration:underline; cursor:pointer; }
  @keyframes pulse { 50% { opacity:.52; transform:scale(.98); } }
  @media (max-height: 760px) { main { padding-top:max(12px,env(safe-area-inset-top)); padding-bottom:max(12px,env(safe-area-inset-bottom)); } .welcome { gap:14px; } .chart-preview { width:min(45vw,210px); } .camera-placeholder { min-height:330px; } .photo-review img { max-height:38dvh; } .capture-grid li { min-height:62px; } .capture-grid img { height:62px; } }
  @media (min-width: 760px) { main { margin:24px auto; min-height:calc(100dvh - 48px); border:1px solid #f3b83f44; border-radius:32px; box-shadow:0 30px 90px #0009; } section { min-height:calc(100dvh - 126px); } }
  @media (prefers-reduced-motion: reduce) { *, *::before, *::after { scroll-behavior:auto!important; animation-duration:.01ms!important; animation-iteration-count:1!important; transition-duration:.01ms!important; } }
</style>
