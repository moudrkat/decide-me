# decide me

No more decisions!

You walk around the world, point your phone at it, and a decision model tells you what to do
next. Where to go: go left 39 %, go right 13 %. Or the one thing worth doing right here: take the
next tram, sit down, go inside, talk to someone. The model does not have to pick it, but when it
does, that is what you do. You just enjoy the walk.

The model runs inside the phone ([kneejerk](https://github.com/moudrkat/kneejerk), llama.cpp in
the app). It looks at the picture, and nothing leaves the phone. It is a multimodal decision model:
no chatting, no explaining, just probabilities.

<p>
<img src="docs/sit-down.png" width="270" alt="A bench by a path: Sit down, 83 %">
<img src="docs/tram-stop.png" width="270" alt="A tram stop: Go left 39 %, Take the next tram 30 %">
</p>

The app's screen in a desktop browser, with the answers d1 2B gave for these two photos through the
same library. On a Pixel 8a both models run and a decision takes a few seconds. Photos: Lairich Rig and M J Richardson, CC BY-SA 2.0, via Geograph and
Wikimedia Commons ([bench](https://commons.wikimedia.org/wiki/File:Bench_beside_path_-_geograph.org.uk_-_4114984.jpg),
[tram stop](https://commons.wikimedia.org/wiki/File:Princes_Street_tram_stop,_Edinburgh.jpg)).

I said I would not build this. I have discipline. 😇

(I built it the same morning. You don't need to decide that often in real life anyway.)

## Install

Android only for now.

1. On the phone, open the [releases page](https://github.com/moudrkat/decide-me/releases), tap `decide-me.apk`.
2. Allow installs from this source, install, allow the camera.
3. Pick a model: **d1 2B** (1.3 GB with its projector) decides better, **d1-omni 600M** (670 MB) is the lighter one.
4. Point the camera somewhere. **What should I do?**

## What it does

- Takes one small frame from the camera (320 px) and asks the model for one decision: go left,
  go right, go forward, turn back, or the one thing worth doing here. The model does not have to pick the thing.
- The thing is one of 21: sit down, go inside, talk to someone, take the next tram,
  lie down, look at the art, open a book, eat something… Which actions, and how to ask each model,
  was measured on 672 photos of 56 kinds of places: [calibration](calibration/).
- **keep asking** asks again every five seconds, for the fully automated life.
- The history button shows where it has sent you so far.

The pictures are checked against llama-server: the same photo and questions give the same
probabilities to four decimals (kneejerk, `tests/results_images_2026-11-11.txt`). Whether the
model is *right* about your street is a different question. Actually, wait. Let's ask the
decision model first.

## Build it yourself

Node 22, Android SDK with NDK 27 and cmake, JDK 21.

```bash
git clone --recurse-submodules https://github.com/moudrkat/decide-me
cd decide-me && npm install && npm run build && npx cap sync android
cd android && ./gradlew assembleDebug
```

## PRs welcome

Your own questions and actions, numbers from your phone, iOS.

## Experimental scene descriptions and Laya

An optional **SmolVLM → Laya** mode generates a short image description and one scene-specific
activity, then ranks it against the four walking directions. It can propose activities outside
the fixed list. This is considerably slower than direct d1 decisions because it generates text;
the small vision model can also produce awkward actions or poor uncertainty statements.
The existing d1 modes remain first in the picker and are unchanged as the default preference.

The new mode downloads about 995 MB of pinned, SHA-256-verified weights and works offline
after download. Expand **What it saw** to inspect observations, evidence and separate vision
and decision timings. Treat percentages as model preferences, not verified correctness.

This branch pins kneejerk and its recursive llama.cpp source in `vendor/`, which is also
required by the native vision bridge. Initialize dependencies with
`git submodule update --init --recursive`. `npm run build` builds the plugin bindings
automatically. Run `npm test` for pipeline regression tests. To assemble an APK use the
existing build instructions after `npm run build` and `npx cap sync android`.

Two real-photo desktop smoke tests validated generated scene JSON and five-choice Laya
responses. Android native compilation and APK signature/package checks passed in the fork;
this upstream-ready variant has not been rebuilt as an APK. No comparative phone benchmark
or calibrated-quality improvement is claimed. The host JNI fixture can be run with
`JAVA_HOME=... MODEL_DIR=... tools/vision-smoke.sh image.jpg`.
