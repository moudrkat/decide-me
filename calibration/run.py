# Places365 validation images, a fixed sample per scene category; every question, raw probabilities to JSON
import base64, io, json, random, subprocess, sys
from PIL import Image
cli, model, mmproj, tag = sys.argv[1:5]; PER = int(sys.argv[5]) if len(sys.argv) > 5 else 12
st = "A photo taken by a person walking around, from where they stand."
ACTIONS = {"photo": "Take a photo", "sit": "Sit down", "inside": "Go inside", "talk": "Talk to someone", "window": "Look out of the window",
 "coffee": "Have a coffee", "tram": "Take the next tram", "read": "Read what it says", "water": "Go to the water", "stairs": "Climb the stairs",
 "dog": "Pet the dog", "flowers": "Smell the flowers", "bridge": "Cross the bridge", "listen": "Stop and listen", "books": "Open a book", "play": "Go on the swing",
 "outside": "Go outside", "eat": "Eat something", "buy": "Buy something small", "lie": "Lie down", "tea": "Make a tea", "work": "Get back to work", "art": "Look at the art", "hands": "Wash your hands"}
THINGS = {"photo": "a church, tower, monument or view", "sit": "a bench or chair", "inside": "a door or entrance", "talk": "people", "window": "a window",
 "coffee": "a cafe", "tram": "a tram, bus or train stop", "read": "a sign, poster or plaque", "water": "water: a river, fountain or sea", "stairs": "stairs",
 "dog": "a dog", "flowers": "flowers", "bridge": "a bridge", "listen": "a musician", "books": "books", "play": "a playground",
 "outside": "an exit", "eat": "food", "buy": "a shop counter or stall", "lie": "a bed or sofa", "tea": "a kitchen", "work": "a desk or computer", "art": "a painting or exhibit", "hands": "a sink"}
DIRS = ["Stand here", "Left", "Right", "Up", "Down"]
CATS = """street downtown alley crosswalk residential_neighborhood plaza park playground promenade bridge fountain church/outdoor tower castle shopfront market/outdoor
restaurant_patio bus_station/indoor train_station/platform subway_station/platform parking_lot forest_path river beach courtyard doorway/outdoor building_facade picnic_area cemetery pier
corridor staircase lobby elevator_lobby kitchen living_room bedroom bathroom office home_office coffee_shop restaurant pub/indoor supermarket bookstore library/indoor museum/indoor art_gallery
church/indoor shopping_mall/indoor waiting_room bakery/shop train_interior classroom entrance_hall escalator/indoor""".split()
QS = {
 "direct": ("What is the one thing worth doing here?", list(ACTIONS.values())),
 "things": ("Which of these things can be seen in this photo?", list(THINGS.values())),
 "dirs":   ("Looking at this photo, where should the person go next?", DIRS),
 "onepass": ("Looking at this photo, what should the person do next?", DIRS + list(ACTIONS.values())),
}
names = [l.split()[0].split("/", 2)[2] for l in open("places/categories_places365.txt")]
by = {}
for l in open("places/places365_val.txt"):
    f, c = l.split(); by.setdefault(names[int(c)], []).append(f)
random.seed(1)
files = [(c, f) for c in CATS for f in sorted(random.sample(by[c], PER))]
p = subprocess.Popen([cli, "-m", model, "--mmproj", mmproj, "-ngl", "0", "-t", "8", "--time"], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True)
def ask(url, instructions, options):
    b = {"state": st, "images": [url], "questions": {"q": {"type": "choice", "instructions": instructions, "criteria": {o: o for o in options}}}}
    p.stdin.write(json.dumps(b) + "\n"); p.stdin.flush(); a = json.loads(p.stdout.readline())
    if "error" in a: raise RuntimeError(a["error"])
    return a["answers"]["q"]["probabilities"], a["_wall_ms"]
def url_of(im):
    im = im.convert("RGB"); im.thumbnail((320, 320)); buf = io.BytesIO(); im.save(buf, "JPEG", quality=90)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()
noise = Image.new("RGB", (256, 256)); noise.putdata([(random.randrange(256), random.randrange(256), random.randrange(256)) for _ in range(256 * 256)])
blank = {"gray": Image.new("RGB", (256, 256), (128, 128, 128)), "white": Image.new("RGB", (256, 256), (255, 255, 255)), "black": Image.new("RGB", (256, 256), (0, 0, 0)), "noise": noise}
out = {"actions": ACTIONS, "things": THINGS, "dirs": DIRS, "cats": CATS, "scenes": {}, "blank": {}}
times = {q: [] for q in QS}
for name, im in blank.items():
    u = url_of(im); out["blank"][name] = {q: ask(u, *QS[q])[0] for q in QS}
for i, (c, f) in enumerate(files):
    u = url_of(Image.open(f"places/val_256/{f}")); r = {"cat": c}
    for q in QS:
        pr, ms = ask(u, *QS[q]); r[q] = pr; times[q].append(ms)
    out["scenes"][f] = r
    if i % 100 == 99: print(tag, i + 1, flush=True)
out["ms"] = {q: sorted(t)[len(t) // 2] for q, t in times.items()}
json.dump(out, open(f"results_{tag}.json", "w"))
print(tag, len(out["scenes"]), "scenes, median ms", {q: round(v) for q, v in out["ms"].items()}, flush=True)
p.stdin.close()
