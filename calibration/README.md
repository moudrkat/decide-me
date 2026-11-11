# Which actions, and how to ask

672 photos from the Places365 validation set: 56 kinds of places, 12 photos each (fixed seed). For every
kind of place the actions a person would accept were written down before any model saw a photo
(`EXP` in `analyse.py`). The score is how often the model's one action is among them. It is strict:
the label is per kind of place, not per photo, so a café in a photo filed under "street" counts as a miss.

| | d1-omni 600M | d1 2B |
|---|---|---|
| best way to ask | what is in the picture, divided by its mean answer | one call, ways to go and actions together |
| fits the kind of place | 49 % | 61 % |
| per question, 8 CPU threads | 0.27 s | 0.57 s |

"Stand here" was a fifth way to go at first. Offered, d1 2B picked it for 153 of the 672 photos; without
it the action fits the kind of place just as often (60 %) and wins the decision for 606 of 672, a way
to go for the other 66. The table above was measured with it.

Dividing by the answer to a plain gray picture helps neither: 41 % for the small model, 56 % for the big one.

`run.py` asks every question about every photo through `systemone-cli` (kneejerk) and stores the raw
probabilities; `analyse.py` scores them. `results_2026-11-11.txt` is its output for both models, with
the table per kind of place. The photos are not here: Places365 is for research use and not ours to
redistribute. Get `val_256.tar` and the file list from the Places365 site and unpack into `places/`.
