// A multimodal decision model is two files: the model and its projector (mmproj), which turns a
// picture into embeddings. Both download from Hugging Face into the app's data directory.
export interface ModelSpec {
  id: string
  name: string
  files: { file: string; url: string; mb: number }[] // [model, projector]
  blurb: string
  // how the one thing to do is found. 'all': one call, the ways to go and every action as options (the big model
  // is best at this, 61 % on the test photos). 'thing': first what is in the picture, then the decision (the small
  // model knows what it sees, 49 %, far better than what to do about it, 31 %).
  ask: 'all' | 'thing'
}

const hf = (repo: string, file: string) => `https://huggingface.co/${repo}/resolve/main/${file}`

export const MODELS: ModelSpec[] = [
  {
    id: 'd1-omni-600m',
    name: 'd1-omni 600M',
    files: [
      { file: 'd1-omni-600M-Q8_0.gguf', url: hf('LiquidAI/d1-omni-600M-GGUF', 'd1-omni-600M-Q8_0.gguf'), mb: 407 },
      { file: 'mmproj-d1-omni-600M-Q8_0.gguf', url: hf('LiquidAI/d1-omni-600M-GGUF', 'mmproj-d1-omni-600M-Q8_0.gguf'), mb: 263 },
    ],
    blurb: 'Liquid AI, the small one. 670 MB in two files.',
    ask: 'thing',
  },
  {
    id: 'd1-2b',
    name: 'd1 2B',
    files: [
      { file: 'd1-2B-Q4_K_M.gguf', url: hf('LiquidAI/d1-2B-GGUF', 'd1-2B-Q4_K_M.gguf'), mb: 1100 },
      { file: 'mmproj-d1-2B-Q8_0.gguf', url: hf('LiquidAI/d1-2B-GGUF', 'mmproj-d1-2B-Q8_0.gguf'), mb: 203 },
    ],
    blurb: 'Liquid AI, the bigger one. 1.3 GB in two files, about 2.5 GB of RAM.',
    ask: 'all',
  },
]
