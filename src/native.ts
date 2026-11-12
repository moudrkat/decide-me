// Files on the phone and the kneejerk plugin (llama.cpp inside the app, the projector included).
import { Capacitor } from '@capacitor/core'
import { Directory, Filesystem } from '@capacitor/filesystem'
import { Kneejerk } from 'capacitor-kneejerk'
import type { ModelSpec } from './models'
import { Vision } from './vision'
import { parseProposal, decisionRequest, validatedProbabilities } from './pipeline'

export const isNative = Capacitor.isNativePlatform()

async function pathOf(file: string): Promise<string> {
  const { uri } = await Filesystem.getUri({ path: file, directory: Directory.Data })
  return uri.replace(/^file:\/\//, '')
}

const verified = new Set<string>()
async function has(file: string, mb: number, sha256?: string): Promise<boolean> {
  try {
    const st = await Filesystem.stat({ path: file, directory: Directory.Data })
    if (sha256) {
      if (st.size !== Math.round(mb * 1e6)) return false
      if (!verified.has(sha256)) {
        if (!(await Vision.verify({ path: await pathOf(file), sha256 })).valid) return false
        verified.add(sha256)
      }
      return true
    }
    return (st.size ?? 0) > mb * 1e6 * 0.99
  } catch {
    return false
  }
}

export async function isDownloaded(spec: ModelSpec): Promise<boolean> {
  for (const f of spec.files) if (!(await has(f.file, f.mb, f.sha256))) return false
  return true
}

// both files, progress as one fraction of the total size. The plugin's download continues an interrupted file
// where it stopped (a 1 GB model over a pub's wifi does get interrupted); calling this again picks it up.
export async function download(spec: ModelSpec, onProgress: (fraction: number) => void): Promise<void> {
  const total = spec.files.reduce((a, f) => a + f.mb, 0)
  let done = 0
  for (const f of spec.files) {
    if (!(await has(f.file, f.mb, f.sha256))) {
      // The resumable downloader trusts an existing final file. Remove a rejected final
      // file, but retain .part so interrupted downloads can continue.
      let finalExists = false
      try { await Filesystem.stat({ path: f.file, directory: Directory.Data }); finalExists = true } catch { /* absent */ }
      if (finalExists) await Filesystem.deleteFile({ path: f.file, directory: Directory.Data })
      if (f.sha256) verified.delete(f.sha256)
      const path = await pathOf(f.file)
      const listener = await Kneejerk.addListener('downloadProgress', (p) => {
        if (p.path === path && p.total > 0) onProgress((done + (f.mb * p.bytes) / p.total) / total)
      })
      try {
        await Kneejerk.download({ url: f.url, path })
      } finally {
        await listener.remove()
      }
    }
    if (!(await has(f.file, f.mb, f.sha256))) throw new Error(`Model verification failed: ${f.file}. Retry the download.`)
    done += f.mb
    onProgress(done / total)
  }
}

export async function load(spec: ModelSpec): Promise<{ modelType: string }> {
  await unload()
  if (spec.ask === 'vision-laya') {
    try {
      await Vision.load({ path: await pathOf(spec.files[0].file), projector: await pathOf(spec.files[1].file) })
      const result = await Kneejerk.load({ path: await pathOf(spec.files[2].file), nCtx: 1024, threads: 4, repack: false })
      if (result.modelType !== 'laya') throw new Error('Expected a Laya decision model')
      return result
    } catch (e) { await unload(); throw e }
  }
  const path = await pathOf(spec.files[0].file)
  const mmproj = await pathOf(spec.files[1].file)
  let repack = true
  try {
    const m = await Kneejerk.memory()
    const mb = spec.files.reduce((a, f) => a + f.mb, 0)
    if (m.totalMem > 0 && m.totalMem < mb * 1e6 * 2.2 + 2e9) repack = false
  } catch {
    // keep the default
  }
  return Kneejerk.load({ path, mmproj, nCtx: 4096, repack })
}

export interface Answer {
  type: 'choice' | 'noul'
  probabilities?: Record<string, number>
  choice?: string
  noul?: number
}

export interface Decision {
  answers: Record<string, Answer>
  wallMs: number
  encodeMs: number
  tokens: number
}

export type Question = { instructions: string; options: string[] } | { instructions: string }

// one picture (a JPEG data URL), any number of questions about it: with options a choice, without a yes/no.
// The library encodes a picture once and keeps it, so asking again about the same frame costs only the questions.
export async function decide(image: string, questions: Record<string, Question>): Promise<Decision> {
  const qs: Record<string, unknown> = {}
  for (const [id, q] of Object.entries(questions)) {
    qs[id] = 'options' in q
      ? { type: 'choice', instructions: q.instructions, criteria: Object.fromEntries(q.options.map((o) => [o, o])) }
      : { type: 'noul', instructions: q.instructions }
  }
  const request = { state: 'A photo taken by a person walking around, from where they stand.', images: [image], questions: qs }
  const { response, wallMs } = await Kneejerk.decide({ request: JSON.stringify(request) })
  const r = JSON.parse(response)
  if (r.error) throw new Error(r.error.message)
  return { answers: r.answers, wallMs, encodeMs: r.usage?.image_encode_ms ?? 0, tokens: r.usage?.input_tokens ?? 0 }
}

export async function unload(): Promise<void> {
  await Promise.all([Vision.unload(), Kneejerk.unload()])
}

export async function describeAndDecide(image: string) {
  const start = performance.now()
  const observation = await Vision.describe({ image })
  const scene = parseProposal(observation.json)
  const result = await Kneejerk.decide({ request: JSON.stringify(decisionRequest(scene)) })
  const response = JSON.parse(result.response)
  if (response.error) throw new Error(response.error.message)
  return {
    scene,
    decision: validatedProbabilities(response.answers?.decision?.probabilities, scene.action),
    visionMs: observation.wallMs, decisionMs: result.wallMs, totalMs: performance.now() - start,
  }
}
