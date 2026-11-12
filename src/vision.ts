import { registerPlugin } from '@capacitor/core'

export const Vision = registerPlugin<{
  load(options: { path: string; projector: string }): Promise<void>
  describe(options: { image: string }): Promise<{ json: string; wallMs: number }>
  unload(): Promise<void>
  verify(options: { path: string; sha256: string }): Promise<{ valid: boolean }>
}>('Vision')
