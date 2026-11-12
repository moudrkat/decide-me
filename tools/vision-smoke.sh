#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
: "${JAVA_HOME:?Set JAVA_HOME to JDK 21}"
: "${MODEL_DIR:?Directory containing the pinned SmolVLM and projector GGUFs}"
smoke_build="${SMOKE_BUILD_DIR:-/tmp/decide-me-host}"
cmake -S android/app/src/main/cpp -B "$smoke_build" -DCMAKE_BUILD_TYPE=Release
cmake --build "$smoke_build" --target decide_vision -j 4
"$JAVA_HOME/bin/javac" -d "$smoke_build/classes" tests/VisionSmoke.java
"$JAVA_HOME/bin/java" -Djava.library.path="$smoke_build" -cp "$smoke_build/classes" \
  com.moudrkat.decideme.VisionSmoke \
  "$MODEL_DIR/SmolVLM-500M-Instruct-Q8_0.gguf" \
  "$MODEL_DIR/mmproj-SmolVLM-500M-Instruct-Q8_0.gguf" "$@"
