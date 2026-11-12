// Files on the phone and the kneejerk plugin (llama.cpp inside the app, the projector included).
import { Capacitor } from '@capacitor/core'
import { Directory, Filesystem } from '@capacitor/filesystem'
import { Kneejerk } from 'capacitor-kneejerk'
import type { ModelSpec } from './models'

export const isNative = Capacitor.isNativePlatform()

async function pathOf(file: string): Promise<string> {
  const { uri } = await Filesystem.getUri({ path: file, directory: Directory.Data })
  return uri.replace(/^file:\/\//, '')
}

async function has(file: string, mb: number): Promise<boolean> {
  try {
    const st = await Filesystem.stat({ path: file, directory: Directory.Data })
    return (st.size ?? 0) > mb * 1e6 * 0.99
  } catch {
    return false
  }
}

export async function isDownloaded(spec: ModelSpec): Promise<boolean> {
  for (const f of spec.files) if (!(await has(f.file, f.mb))) return false
  return true
}

// both files, progress as one fraction of the total size. The plugin's download continues an interrupted file
// where it stopped (a 1 GB model over a pub's wifi does get interrupted); calling this again picks it up.
export async function download(spec: ModelSpec, onProgress: (fraction: number) => void): Promise<void> {
  const total = spec.files.reduce((a, f) => a + f.mb, 0)
  let done = 0
  for (const f of spec.files) {
    if (!(await has(f.file, f.mb))) {
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
    done += f.mb
    onProgress(done / total)
  }
}

export async function load(spec: ModelSpec): Promise<{ modelType: string }> {
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
