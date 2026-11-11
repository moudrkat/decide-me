<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { MODELS, type ModelSpec } from './models'
import { decide, download, isDownloaded, isNative, load } from './native'
import { ACTIONS, ASK_DECISION, ASK_THING, DIRECTIONS } from './actions'

// One frame, one decision: the five ways to go, or the one thing worth doing here. The model does not have to
// pick the thing. How the thing is found depends on the model (models.ts), and so does the number of calls.
const ICONS: Record<string, string> = {
  'Stand here': 'M12 4a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm-3 6h6v6h-1.5v4h-3v-4H9z',
  Left: 'M11 5 4 12l7 7v-5h9v-4h-9z',
  Right: 'M13 5l7 7-7 7v-5H4v-4h9z',
  Up: 'M5 11l7-7 7 7h-5v9h-4v-9z',
  Down: 'M5 13l7 7 7-7h-5V4h-4v9z',
}
const STAR = 'M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z' // the one thing to do

const current = ref<ModelSpec | null>(null)
const picking = ref(false)
const status = reactive<Record<string, { downloaded: boolean; progress: number | null; loading: boolean }>>({})
for (const m of MODELS) status[m.id] = { downloaded: false, progress: null, loading: false }
const error = ref('')

const videoEl = ref<HTMLVideoElement | null>(null)
const canvasEl = ref<HTMLCanvasElement | null>(null)
const still = ref('') // the frame the answer is about; it stays on screen with the answer, for a look or a screenshot
const busy = ref(false)
const auto = ref(false)
const showHistory = ref(false)
let timer: ReturnType<typeof setTimeout> | null = null
let stream: MediaStream | null = null

interface Shot { thumb: string; action: string; decision: Record<string, number> | null; ms: number; encodeMs: number; at: string }
const last = ref<Shot | null>(null)
const history = ref<Shot[]>([])

type Probs = Record<string, number>
const best = (p: Probs) => Object.entries(p).sort((a, b) => b[1] - a[1])[0]
// an answer with the model's picture-independent preference divided out, summing to one again
function corrected(p: Probs, prior: Probs | undefined): Probs {
  if (!prior) return p
  const q = Object.fromEntries(Object.entries(p).map(([k, v]) => [k, v / Math.max(prior[k] ?? 0, 1e-9)]))
  const sum = Object.values(q).reduce((a, b) => a + b, 0) || 1
  return Object.fromEntries(Object.entries(q).map(([k, v]) => [k, v / sum]))
}
let gray = '' // a plain picture: what the small model answers about it is its preference, not a decision
const priorDecision = new Map<string, Probs>() // that preference, per action, measured the first time it comes up
const THING_PRIOR: Probs = Object.fromEntries(ACTIONS.map((a) => [a.thing, a.prior]))
const decisionQuestion = (action: string) => ({ instructions: ASK_DECISION, options: [...DIRECTIONS, action] })
// only these options of an answer, summing to one again
function among(p: Probs, keys: string[]): Probs {
  const sum = keys.reduce((a, k) => a + (p[k] ?? 0), 0) || 1
  return Object.fromEntries(keys.map((k) => [k, (p[k] ?? 0) / sum]))
}

// the rows of the decision: the five ways, then the one thing to do
const rows = computed(() => {
  const p = last.value?.decision
  const win = p ? best(p)[0] : ''
  const dirs = DIRECTIONS.map((o) => ({ key: o, p: p ? p[o] : null, win: o === win, extra: false }))
  const a = last.value?.action
  return [...dirs, { key: a ?? 'one thing to do', p: p && a ? p[a] : null, win: !!a && a === win, extra: true }]
})

// Development server only (stripped from the build): ?demo=name shows a stored photo with the answer the library
// gave for it (docs/demo/name.json), so the screen can be looked at and photographed without a phone.
async function demo(name: string) {
  const d = await (await fetch(`/docs/demo/${name}.json`)).json()
  current.value = { ...MODELS[0], name: d.model }
  still.value = d.image
  last.value = { thumb: d.image, action: d.action, decision: d.decision, ms: d.ms, encodeMs: 0, at: '' }
}

onMounted(async () => {
  const demoName = import.meta.env.DEV ? new URLSearchParams(location.search).get('demo') : null
  if (demoName) return demo(demoName)
  await startCamera()
  if (!isNative) return
  for (const m of MODELS) status[m.id].downloaded = await isDownloaded(m)
  const first = MODELS.find((m) => status[m.id].downloaded)
  if (first) await useModel(first)
  else picking.value = true
})
onBeforeUnmount(() => {
  if (timer) clearTimeout(timer)
  stream?.getTracks().forEach((t) => t.stop())
})

async function startCamera() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } }, audio: false })
    if (videoEl.value) {
      videoEl.value.srcObject = stream
      await videoEl.value.play()
    }
  } catch (e) {
    error.value = 'camera: ' + String((e as Error).message ?? e)
  }
}

async function useModel(spec: ModelSpec) {
  error.value = ''
  const st = status[spec.id]
  try {
    if (!st.downloaded) {
      st.progress = 0
      await download(spec, (f) => (st.progress = f))
      st.downloaded = await isDownloaded(spec)
      st.progress = null
      if (!st.downloaded) throw new Error('download did not complete')
    }
    st.loading = true
    await load(spec)
    priorDecision.clear()
    gray = grayPicture()
    current.value = spec
    picking.value = false
  } catch (e) {
    error.value = String((e as Error).message ?? e)
    st.progress = null
  } finally {
    st.loading = false
  }
}

// one frame of the preview as a small JPEG: the model does not need more, and every pixel costs tokens
function grab(): string {
  const v = videoEl.value, c = canvasEl.value
  if (!v || !c || !v.videoWidth) throw new Error('the camera is not ready')
  const side = 320 // measured: 320 px is about 140 tokens per question, and the model sees it as well as 448
  const scale = side / Math.max(v.videoWidth, v.videoHeight)
  c.width = Math.round(v.videoWidth * scale)
  c.height = Math.round(v.videoHeight * scale)
  c.getContext('2d')!.drawImage(v, 0, 0, c.width, c.height)
  return c.toDataURL('image/jpeg', 0.85)
}

function grayPicture(): string {
  const c = document.createElement('canvas')
  c.width = 320
  c.height = 240
  const g = c.getContext('2d')!
  g.fillStyle = '#808080'
  g.fillRect(0, 0, c.width, c.height)
  return c.toDataURL('image/jpeg', 0.85)
}

// the main button: with an answer on screen it goes back to the live camera, otherwise it asks
function press() {
  if (still.value && !busy.value) still.value = ''
  else ask()
}

async function ask() {
  if (!current.value || busy.value) return
  error.value = ''
  busy.value = true
  try {
    const image = grab()
    still.value = image
    const at = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    const spec = current.value
    let shot: Shot
    if (spec.ask === 'all') {
      // one call: the ways to go and every action. The strongest action is the one thing to do; the decision
      // is between it and the five ways.
      const d = await decide(image, { decision: { instructions: ASK_DECISION, options: [...DIRECTIONS, ...ACTIONS.map((a) => a.action)] } })
      const p = d.answers.decision.probabilities!
      const action = best(among(p, ACTIONS.map((a) => a.action)))[0]
      shot = { thumb: image, action, decision: among(p, [...DIRECTIONS, action]), ms: d.wallMs, encodeMs: d.encodeMs, at }
    } else {
      // 1. what is here; each thing divided by how readily the model names it anyway
      const d1 = await decide(image, { pick: { instructions: ASK_THING, options: ACTIONS.map((a) => a.thing) } })
      const thing = best(corrected(d1.answers.pick.probabilities!, THING_PRIOR))[0]
      const action = ACTIONS.find((a) => a.thing === thing)!.action
      shot = { thumb: image, action, decision: null, ms: d1.wallMs, encodeMs: d1.encodeMs, at }
      last.value = shot
      // 2. the decision: the ways to go and that one thing; the picture is already encoded
      const d2 = await decide(image, { decision: decisionQuestion(action) })
      // the preference for this set of options, measured after the photo so that the gray picture does not push
      // the photo out of the library's memory between the two calls
      if (!priorDecision.has(action)) {
        priorDecision.set(action, (await decide(gray, { decision: decisionQuestion(action) })).answers.decision.probabilities!)
      }
      shot = { ...shot, decision: corrected(d2.answers.decision.probabilities!, priorDecision.get(action)), ms: shot.ms + d2.wallMs }
    }
    last.value = shot
    history.value = [shot, ...history.value].slice(0, 12)
  } catch (e) {
    error.value = String((e as Error).message ?? e)
    auto.value = false
  } finally {
    busy.value = false
    if (auto.value || error.value) still.value = '' // walking: back to the live picture; one question: the frame stays
    if (auto.value) timer = setTimeout(ask, 5000) // you do not need to decide that often in real life
  }
}

function toggleAuto() {
  auto.value = !auto.value
  if (timer) { clearTimeout(timer); timer = null }
  if (auto.value && !busy.value) { still.value = ''; ask() }
}
const pct = (p: number | null) => (p === null ? '–' : Math.round(p * 100) + '%')
</script>

<template>
  <div class="stage">
    <video ref="videoEl" playsinline muted></video>
    <img v-if="still" class="still" :class="{ demo: last && !last.at }" :src="still" alt="">
    <canvas ref="canvasEl"></canvas>
  </div>

  <div class="top">
    <button class="chip" @click="picking = !picking; showHistory = false"><span class="dot"></span>{{ current ? current.name : 'pick a model' }}</button>
    <button class="round" aria-label="history" @click="showHistory = !showHistory; picking = false">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/><path d="M12 7v5l3 2"/></svg>
    </button>
  </div>

  <div class="sheet">
    <div class="grab"></div>

    <template v-if="picking || !current">
      <div class="q"><div class="spark">◆</div><h1>Pick a model</h1></div>
      <p v-if="!isNative" class="note">This is the web build. The model runs inside the Android app.</p>
      <div class="models">
        <button v-for="m in MODELS" :key="m.id" class="model" :disabled="status[m.id].loading || status[m.id].progress !== null" @click="useModel(m)">
          <b>{{ m.name }}</b>
          <span class="st">{{ status[m.id].loading ? 'loading' : status[m.id].progress !== null ? Math.round(status[m.id].progress! * 100) + ' %' : status[m.id].downloaded ? (current?.id === m.id ? 'loaded' : 'ready') : 'download' }}</span>
          <span class="sub">{{ m.blurb }}</span>
          <span v-if="status[m.id].progress !== null" class="prog"><span :style="{ width: status[m.id].progress! * 100 + '%' }"></span></span>
        </button>
      </div>
      <p class="note">The model and the photos stay in the phone. Nothing is sent anywhere.</p>
    </template>

    <template v-else-if="showHistory">
      <div class="q"><div class="spark">◆</div><h1>Where it sent you</h1></div>
      <p v-if="!history.length" class="note">Nothing yet. Point the camera and ask.</p>
      <div class="hist">
        <div v-for="(h, i) in history" :key="i" class="h">
          <img :src="h.thumb" alt="">
          <div>
            <div class="w">{{ h.decision ? best(h.decision)[0] + ' · ' + pct(best(h.decision)[1]) : '…' }}</div>
            <div class="t">{{ h.decision && best(h.decision)[0] !== h.action ? 'or: ' + h.action + ' · ' : '' }}{{ h.at }}</div>
          </div>
          <div class="t">{{ (h.ms / 1000).toFixed(1) }} s</div>
        </div>
      </div>
    </template>

    <template v-else>
      <div class="q">
        <div class="spark">◆</div><h1>Where should I go?</h1>
        <small v-if="last && last.at">{{ (last.ms / 1000).toFixed(1) }} s</small>
      </div>
      <div class="rows">
        <div v-for="r in rows" :key="r.key" class="row" :class="{ win: r.win, idle: r.p === null, extra: r.extra }">
          <span class="ic"><svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path :d="r.extra ? STAR : ICONS[r.key]"/></svg></span>
          <span class="nm">{{ r.key }}</span>
          <span class="bar"><span :style="{ width: (r.p ?? 0) * 100 + '%' }"></span></span>
          <span class="p">{{ pct(r.p) }}</span>
        </div>
      </div>

      <div class="act">
        <button class="ask" :disabled="busy" @click="press">{{ busy ? 'looking…' : still ? 'Back to camera' : last ? 'Ask again' : 'Where should I go?' }}</button>
        <button class="auto" :class="{ on: auto }" @click="toggleAuto">{{ auto ? 'stop' : 'keep asking' }}</button>
      </div>
      <p v-if="last && last.at" class="note">{{ (last.ms / 1000).toFixed(1) }} s, {{ (last.encodeMs / 1000).toFixed(1) }} s of it looking at the picture · ★ = the one thing to do here · nothing left the phone</p>
      <p v-else-if="!last" class="note">Point the camera somewhere and ask. The model decides, you walk.</p>
    </template>

    <p v-if="error" class="err">{{ error }}</p>
  </div>
</template>
