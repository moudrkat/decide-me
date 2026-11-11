# decide me

No more decisions!

You walk around the world, point your phone at it, and a decision model tells you where to go
next. Left 34 %, right 28 %, stand here 12 %. You just enjoy the walk.

The model runs inside the phone ([kneejerk](https://github.com/moudrkat/kneejerk), llama.cpp in
the app). It looks at the picture, answers in about a second, and nothing leaves the phone. It is
a multimodal decision model: no chatting, no explaining, just probabilities.

I said I would not build this. I have discipline. 😇

(I built it the same morning. You don't need to decide that often in real life anyway.)

## Install

Android only for now.

1. On the phone, open the [releases page](https://github.com/moudrkat/decide-me/releases), tap `decide-me.apk`.
2. Allow installs from this source, install, allow the camera.
3. Pick a model: **d1-omni 600M** (670 MB with its projector) is the one to start with.
4. Point the camera somewhere. **Where should I go?**

## What it does

- Takes one small frame from the camera (320 px) and asks the model three things. Where to go:
  stand here, left, right, up, down. What is here: a café, a place to sit, a landmark, a shop,
  water, stairs, green, a crowd, one yes/no each. And what to do about it: the things it saw unlock
  the actions (a café unlocks "Have a coffee"), and it picks one. "Keep walking" is always on the table.
- **keep asking** asks again every five seconds, for the fully automated life.
- The history button shows where it has sent you so far.

The pictures are checked against llama-server: the same photo and questions give the same
probabilities to four decimals (kneejerk, `tests/results_images_2026-11-11.txt`). Whether the
model is *right* about your street is a different question. Actually, wait. Let's ask the
decision model first.

## Build it yourself

Node 22, Android SDK with NDK 27 and cmake, JDK 21.

```bash
git clone --recurse-submodules https://github.com/moudrkat/kneejerk
git clone https://github.com/moudrkat/decide-me
cd decide-me && npm install && npm run build && npx cap sync android
cd android && ./gradlew assembleDebug
```

## PRs welcome

Your own questions and actions, numbers from your phone, iOS.
