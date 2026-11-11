import json, math, sys
tag = sys.argv[1]; show = sys.argv[2] if len(sys.argv) > 2 else None
D = json.load(open(f"results_{tag}.json")); A, T, DIRS = D["actions"], D["things"], D["dirs"]
# what a person would accept per scene type, written before any model output was seen (weak labels: per category, not per photo)
EXP = {"street": "talk inside photo buy", "downtown": "photo talk inside", "alley": "photo", "crosswalk": "talk", "residential_neighborhood": "", "plaza": "photo sit talk", "park": "sit flowers",
 "playground": "play", "promenade": "sit water talk", "bridge": "bridge photo", "fountain": "water photo sit", "church/outdoor": "photo inside", "tower": "photo", "castle": "photo inside",
 "shopfront": "inside buy", "market/outdoor": "buy talk eat", "restaurant_patio": "coffee eat sit", "bus_station/indoor": "tram sit", "train_station/platform": "tram sit", "subway_station/platform": "tram",
 "parking_lot": "", "forest_path": "photo", "river": "water photo", "beach": "water photo lie", "courtyard": "sit photo inside", "doorway/outdoor": "inside", "building_facade": "photo inside",
 "picnic_area": "sit eat", "cemetery": "read photo", "pier": "water photo", "corridor": "outside inside", "staircase": "stairs", "lobby": "sit talk outside", "elevator_lobby": "outside inside",
 "kitchen": "tea eat hands", "living_room": "sit lie window", "bedroom": "lie window", "bathroom": "hands", "office": "work sit", "home_office": "work sit", "coffee_shop": "coffee sit buy",
 "restaurant": "eat sit coffee", "pub/indoor": "sit talk coffee", "supermarket": "buy eat", "bookstore": "books buy", "library/indoor": "books sit", "museum/indoor": "art photo read", "art_gallery": "art",
 "church/indoor": "sit photo art", "shopping_mall/indoor": "buy inside", "waiting_room": "sit", "bakery/shop": "eat buy", "train_interior": "sit window", "classroom": "sit work",
 "entrance_hall": "stairs outside photo", "escalator/indoor": "stairs"}
S = D["scenes"]
def gmean(v): return math.exp(sum(math.log(max(x, 1e-12)) for x in v) / len(v))
def prior(q, kind, opts):
    if kind == "raw": return {o: 1.0 for o in opts}
    if kind == "blank4": return {o: gmean([D["blank"][b][q][o] for b in D["blank"]]) for o in opts}
    if kind == "scenes": return {o: gmean([r[q][o] for r in S.values()]) for o in opts}
    return dict(D["blank"][kind][q])
print(f"== {tag}: {len(S)} scenes, median ms {({k: round(v) for k, v in D['ms'].items()})}")
best = None
for q, table in (("direct", A), ("things", T), ("onepass", A)):
    opts = list(table.values()); inv = {v: k for k, v in table.items()}
    for kind in ("raw", "gray", "blank4", "scenes"):
        pri = prior(q, kind, opts); hit = tot = 0; hist = {}; bycat = {}
        for f, r in S.items():
            t = inv[max(opts, key=lambda o: r[q][o] / max(pri[o], 1e-12))]; hist[t] = hist.get(t, 0) + 1
            bycat.setdefault(r["cat"], {}); bycat[r["cat"]][t] = bycat[r["cat"]].get(t, 0) + 1
            ok = EXP[r["cat"]].split()
            if ok: tot += 1; hit += t in ok
        ent = -sum(v / len(S) * math.log2(v / len(S)) for v in hist.values())
        print(f"{q:8} {kind:7} fits the scene type {hit:3}/{tot} = {hit/tot:.0%} | spread {ent:.1f} bits | most picked: " + " ".join(f"{k}{v}" for k, v in sorted(hist.items(), key=lambda kv: -kv[1])[:7]))
        if show == f"{q}/{kind}":
            for c in D["cats"]:
                print(f"    {c:26} expect [{EXP[c]:22}] got " + " ".join(f"{k}{v}" for k, v in sorted(bycat[c].items(), key=lambda kv: -kv[1])[:5]))
for kind in ("raw", "gray", "scenes"):
    pri = prior("dirs", kind, DIRS); hist = {}
    for r in S.values():
        t = max(DIRS, key=lambda o: r["dirs"][o] / max(pri[o], 1e-12)); hist[t] = hist.get(t, 0) + 1
    print(f"dirs     {kind:7} {hist}")
