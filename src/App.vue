<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { MODELS, type ModelSpec } from './models'
import { decide, download, isDownloaded, isNative, load } from './native'

// the two questions asked about every picture: where to go, and one thing to do here
const WHERE = { instructions: 'Looking at this photo, where should the person go next?', options: ['Stand here', 'Left', 'Right', 'Up', 'Down'] }
const ALSO = { instructions: 'Looking at this photo, what should the person do here?', options: ['Take a photo', 'Sit down', 'Go inside', 'Keep walking'] }
const ICONS: Record<string, string> = {
  'Stand here': 'M12 4a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm-3 6h6v6h-1.5v4h-3v-4H9z',
  Left: 'M11 5 4 12l7 7v-5h9v-4h-9z',
  Right: 'M13 5l7 7-7 7v-5H4v-4h9z',
  Up: 'M5 11l7-7 7 7h-5v9h-4v-9z',
  Down: 'M5 13l7 7 7-7h-5V4h-4v9z',
}

const current = ref<ModelSpec | null>(null)
const picking = ref(false)
const status = reactive<Record<string, { downloaded: boolean; progress: number | null; loading: boolean }>>({})
for (const m of MODELS) status[m.id] = { downloaded: false, progress: null, loading: false }
const error = ref('')

const videoEl = ref<HTMLVideoElement | null>(null)
const canvasEl = ref<HTMLCanvasElement | null>(null)
const still = ref('') // the frame the last answer is about
const busy = ref(false)
const auto = ref(false)
const showAlso = ref(false)
const showHistory = ref(false)
let timer: ReturnType<typeof setTimeout> | null = null
let stream: MediaStream | null = null

interface Shot { thumb: string; where: Record<string, number>; also: Record<string, number>; ms: number; encodeMs: number; at: string }
const last = ref<Shot | null>(null)
const history = ref<Shot[]>([])

const best = (p: Record<string, number>) => Object.entries(p).sort((a, b) => b[1] - a[1])[0]
const rows = computed(() => {
  const p = last.value?.where
  const win = p ? best(p)[0] : ''
  return WHERE.options.map((o) => ({ key: o, p: p ? p[o] ?? 0 : null, win: o === win }))
})
const alsoRows = computed(() => {
  const p = last.value?.also
  const win = p ? best(p)[0] : ''
  return ALSO.options.map((o) => ({ key: o, p: p ? p[o] ?? 0 : null, win: o === win }))
})
const alsoBest = computed(() => (last.value ? best(last.value.also) : null))

onMounted(async () => {
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
  const side = 448
  const scale = side / Math.max(v.videoWidth, v.videoHeight)
  c.width = Math.round(v.videoWidth * scale)
  c.height = Math.round(v.videoHeight * scale)
  c.getContext('2d')!.drawImage(v, 0, 0, c.width, c.height)
  return c.toDataURL('image/jpeg', 0.85)
}

async function ask() {
  if (!current.value || busy.value) return
  error.value = ''
  busy.value = true
  try {
    const image = grab()
    still.value = image
    const d = await decide(image, { where: WHERE, also: ALSO })
    const shot: Shot = {
      thumb: image,
      where: d.answers.where.probabilities,
      also: d.answers.also.probabilities,
      ms: d.wallMs,
      encodeMs: d.encodeMs,
      at: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    }
    last.value = shot
    history.value = [shot, ...history.value].slice(0, 12)
  } catch (e) {
    error.value = String((e as Error).message ?? e)
    auto.value = false
  } finally {
    busy.value = false
    still.value = ''
    if (auto.value) timer = setTimeout(ask, 5000) // you do not need to decide that often in real life
  }
}

function toggleAuto() {
  auto.value = !auto.value
  if (timer) { clearTimeout(timer); timer = null }
  if (auto.value && !busy.value) ask()
}
const pct = (p: number | null) => (p === null ? '–' : Math.round(p * 100) + '%')
</script>

<template>
  <div class="stage">
    <video ref="videoEl" playsinline muted></video>
    <img v-if="still" class="still" :src="still" alt="">
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
          <div><div class="w">{{ best(h.where)[0] }} · {{ pct(best(h.where)[1]) }}</div><div class="t">{{ best(h.also)[0] }} · {{ h.at }}</div></div>
          <div class="t">{{ (h.ms / 1000).toFixed(1) }} s</div>
        </div>
      </div>
    </template>

    <template v-else>
      <div class="q">
        <div class="spark">◆</div><h1>Where should I go?</h1>
        <small v-if="last">{{ (last.ms / 1000).toFixed(1) }} s</small>
      </div>
      <div class="rows">
        <div v-for="r in rows" :key="r.key" class="row" :class="{ win: r.win, idle: r.p === null }">
          <span class="ic"><svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path :d="ICONS[r.key]"/></svg></span>
          <span class="nm">{{ r.key }}</span>
          <span class="bar"><span :style="{ width: (r.p ?? 0) * 100 + '%' }"></span></span>
          <span class="p">{{ pct(r.p) }}</span>
        </div>
      </div>

      <button v-if="alsoBest" class="also" @click="showAlso = !showAlso">and here: <b>{{ alsoBest[0] }}</b><span class="p">{{ pct(alsoBest[1]) }}</span></button>
      <div v-if="showAlso && last" class="rows">
        <div v-for="r in alsoRows" :key="r.key" class="row" :class="{ win: r.win }" style="grid-template-columns: 1fr 96px 46px">
          <span class="nm">{{ r.key }}</span>
          <span class="bar"><span :style="{ width: (r.p ?? 0) * 100 + '%' }"></span></span>
          <span class="p">{{ pct(r.p) }}</span>
        </div>
      </div>

      <div class="act">
        <button class="ask" :disabled="busy" @click="ask">{{ busy ? 'looking…' : last ? 'Ask again' : 'Where should I go?' }}</button>
        <button class="auto" :class="{ on: auto }" @click="toggleAuto">{{ auto ? 'stop' : 'keep asking' }}</button>
      </div>
      <p v-if="last" class="note">looked at the picture for {{ (last.encodeMs / 1000).toFixed(1) }} s, decided in {{ ((last.ms - last.encodeMs) / 1000).toFixed(1) }} s · nothing left the phone</p>
      <p v-else class="note">Point the camera somewhere and ask. The model decides, you walk.</p>
    </template>

    <p v-if="error" class="err">{{ error }}</p>
  </div>
</template>
