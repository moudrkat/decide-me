// A multimodal decision model is two files: the model and its projector (mmproj), which turns a
// picture into embeddings. Both download from Hugging Face into the app's data directory.
export interface ModelSpec {
  id: string
  name: string
  files: { file: string; url: string; mb: number; sha256?: string }[] // [model, projector]
  blurb: string
  // how the one thing to do is found. 'all': one call, the ways to go and every action as options (the big model
  // is best at this, 61 % on the test photos). 'thing': first what is in the picture, then the decision (the small
  // model knows what it sees, 49 %, far better than what to do about it, 31 %).
  ask: 'all' | 'thing' | 'vision-laya'
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
  {
    id: 'smolvlm-laya', name: 'SmolVLM → Laya', ask: 'vision-laya',
    blurb: 'Experimental: describes the scene and invents one activity. About 995 MB; offline after download.',
    files: [
      { file: 'SmolVLM-500M-Instruct-Q8_0.gguf', mb: 436.806912,
        url: 'https://huggingface.co/ggml-org/SmolVLM-500M-Instruct-GGUF/resolve/72e986006ef53e37cdd3f6d4241c90b0f01df376/SmolVLM-500M-Instruct-Q8_0.gguf',
        sha256: '9d4612de6a42214499e301494a3ecc2be0abdd9de44e663bda63f1152fad1bf4' },
      { file: 'mmproj-SmolVLM-500M-Instruct-Q8_0.gguf', mb: 108.783360,
        url: 'https://huggingface.co/ggml-org/SmolVLM-500M-Instruct-GGUF/resolve/72e986006ef53e37cdd3f6d4241c90b0f01df376/mmproj-SmolVLM-500M-Instruct-Q8_0.gguf',
        sha256: 'd1eb8b6b23979205fdf63703ed10f788131a3f812c7b1f72e0119d5d81295150' },
      { file: 'Laya-Q8_0.gguf', mb: 449.397600,
        url: 'https://huggingface.co/ggml-org/Laya-GGUF/resolve/845f314dd047fc2444a5289a4d50c1e1d59e27e1/Laya-Q8_0.gguf',
        sha256: 'c06528c5746d3bb8baa72a27938be95abbfd0b226f8471e8a9e365ed0bb066d2' },
    ],
  },
]
