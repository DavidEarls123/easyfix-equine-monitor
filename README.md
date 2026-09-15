# EASYFIX Equine — stall monitoring simulator

A working simulation of the EASYFIX equine monitoring product: one animal per stall,
watched by a water flow meter, a temperature probe, an air quality probe and an AI
camera, with the yard's day rolled up into insights and recommended actions.

Everything runs in the browser. There is no hardware, no server and no account —
the sensor history, the camera view and the alerts are all generated from each
stall's seed, so the yard looks the same on every reload and on every machine.

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # static build into dist/
```

## What it demonstrates

**Dashboard** — the state of the yard in one screen. *Needs attention* is one card
per horse rather than one row per finding: the animal is the subject, with a still
from its own camera, its welfare index, and every open finding on it underneath,
each carrying its own criticality. Alongside it: the yard's welfare average, the
horses sitting lowest on it, water intake and stall temperature by hour, the intake
outliers against their own six-day averages, barn health, and the camera's calls.

**Yard → Barns** — every building, laid out or not, on tiles sized for the ten or
fifteen barns a yard actually has rather than a hundred. Each tile reads its own
numbers rather than just printing them: water, temperature and air each carry the
word that goes with the figure — *on track*, *warm*, *slipping* — and the tile takes
the colour of the worst thing open in the building, so averages cannot hide a horse.
A barn is a grid you paint: boxes, aisle, door, tack room, wash bay, feed store.
Save it and each box becomes a monitored stall with a flow meter, probes and a
camera. Occupied boxes are named before they are removed.

**Naming** — barns and boxes are renameable everywhere they appear. Plenty of yards
do not call them Barn 1 and Stall 4, and a renamed box keeps its name when the
layout is edited around it.

**Barn** — the stall-by-stall table a yard reads in the morning (intake, pace against
goal, temperature, air, what the camera is calling), the barn's water/feed/bedding
stock, and the plan view with alerts flagged on the boxes.

**Animals** — profiles created by searching a passport index rather than typing:
name, microchip, sire and dam, markings, owner and trainer come back from the
search, and the horse is dropped into a free box. Each profile carries its intake,
temperature and air charts, the camera's behaviour timeline for the day, the
identity the camera has settled on, and the yard's notes.

**Video** — every camera on one wall, filtered by barn or owner, searched by horse,
box, owner or trainer, and sorted by barn order, name A–Z or Z–A, owner, or worst
welfare first. With the identity and behaviour overlay live,
or one camera with the day behind it: scrub the timeline, jump to a flagged clip,
play back at 1×, 8× or 60×. The stall is drawn in one-point perspective from a unit
mounted high in the corner, with a lamp that falls off with distance, a lens that
vignettes, and the sensor artefacts that make footage read as footage — noise,
interlace, the occasional dropped macroblock. Cameras cut to infra-red after 20:00,
and the detector draws corner brackets and a confidence bar rather than a plain box.

**Notifications** — today's alerts and the week behind them, filterable by barn,
severity or source.

**Settings** — the thresholds every alert is measured against, the camera's identity
and behaviour switches, the welfare index weighting, the passport database the yard
searches, who gets told, and the demo controls (export the yard, add ten more barns
of thirty boxes to see it at 300-stall scale, reset).

## Learning each horse

A fixed threshold is the right shape for the box and the wrong shape for the
animal. A stall at 28°C is too warm whichever horse is standing in it, and 15 ppm
of ammonia is bad air for all of them — temperature and air quality are properties
of the building, so they stay on the yard-wide thresholds in Settings.

Water intake and movement are not. A 16.2hh eventer in hard work and a retired pony
on the same yard have daily intakes that differ threefold, so "below 70% of a 35 L
goal" flags the pony every morning and misses the eventer losing a third of its
normal. `lib/baseline.js` learns those two per animal and judges each horse against
its own history instead.

The baseline is a **median and a median absolute deviation**, not a mean and a
standard deviation. A horse that colicked last Tuesday has one very low day in its
window; a mean would be dragged down by it and a standard deviation inflated, so the
next episode would have to be worse to trip the same threshold. The median ignores
the outlier and the MAD barely moves, which keeps the baseline the horse's normal
rather than its average including the bad days.

Three rules keep it honest:

- **Missing days are skipped, not zeroed.** A day the flow meter was dead is left
  out of the window entirely.
- **Nothing is judged personally until there is enough history.** Below `minDays`
  (7 by default) the animal is `learning`, the yard goal carries the decision, and
  the profile says so in those words rather than implying a personal read.
- **A partial day is projected, not compared raw.** "9 L by 08:00" means nothing
  without knowing how that horse drinks through a day, and the projection is not
  trusted until enough of the day has elapsed to be worth projecting from.

Intake expectation is also adjusted for how warm the box is, since horses drink more
in heat — a tunable percentage per °C above the horse's own usual box temperature,
switchable off, because it is an assumption rather than a measurement.

The result is an alert that reads like the yard's own judgement: *"Wodhooh is
drinking below its own normal — tracking about 19 L for the day. This horse normally
drinks 30.2 L (usual range 23.1–37.3 L, learned over 21 days). That is 4.25 standard
deviations below this horse."* The same horse sits inside the yard-wide threshold.

Movement is treated the same way: active minutes a day, learned per animal, because
a horse that goes quiet is often sore before it is visibly lame.

### What this needed from the simulator

Scenarios used to apply flatly to every day in history, which meant a "colic watch"
horse had drunk half its goal every day for a month — and an app that learns each
animal would rightly call that its normal and never flag it. The intake scenarios now
**ramp in over the last few days**, so the demo shows what the feature is actually
for: catching a change in an individual, not a number below a yard average.

## Reading a number

`lib/status.js` is the one place that turns a reading into the word a yard would use
for it, and the colour that goes with it. Water, temperature and air all go through
it, so the barn tile, the stall table, the animals list and the dashboard say the
same thing about the same figure, and a box reading *Poor* is the same colour as the
alert it will raise. Water was the gap this closed — it was showing bare litres next
to a colour-coded temperature and air score, which left the reader to remember where
the threshold sat.

## The welfare index

Every screen otherwise shows one dimension of a horse at a time — litres, degrees, a
behaviour the camera is calling. A yard with three hundred boxes cannot read six
numbers per horse at six in the morning, so `lib/score.js` collapses them into one
0–100 index per animal, plus the direction it is moving in.

Six inputs, each scored 0–100 on its own terms and then weighted: hydration (intake
against the horse's own pace and its six-day baseline), stall climate, air quality,
behaviour, gait and posture, and rest. The weights are set in Settings and are
relative rather than absolute — they are normalised at read time, so pulling one
input up does not mean taking the same amount off another, and setting one to zero
removes it.

Two rules make the number trustworthy rather than magic:

- **An input with no data is dropped, not scored as zero.** A flow meter that has
  failed is missing information, not a dehydrated horse. The remaining weights are
  renormalised and the shortfall is reported separately as `confidence` — which is
  why a horse can show a high index and a broken ring, next to a critical alert
  about the meter.
- **The breakdown is always available.** The profile shows every component, the
  share of the headline it actually contributed, and the sentence behind it, worst
  first. The thresholds and weights are the parts meant to be argued with.

Alongside the index, the profile draws a **recovery trend**: today against the
average of the six days behind it. A horse sitting at 68 on the way up and one
sitting at 68 on the way down are different mornings.

## Passport lookup

Profile creation searches an external index rather than asking anyone to type a
passport in. Which index is a customer decision, so `lib/passport.js` is a provider
interface with the simulated table as the offline default.

On the real options: **Racing Post has no self-serve API** — its data reaches third
parties under a commercial licence, so "pull it from the Racing Post" means signing
a data agreement and pointing the *custom endpoint* provider at whatever they give
you. The providers listed in Settings are the ones a yard can realistically
subscribe to — The Racing API (the closest thing to a self-serve Racing-Post-shaped
feed), Weatherbys for the General Stud Book, the UK Central Equine Database for the
statutory passport record, Horse Sport Ireland, and the FEI database.

One deployment note the UI repeats, because it catches people out: none of these
should be called straight from the browser. An API key in a bundle is a published
key, and these hosts will refuse a cross-origin request from a yard's domain in any
case. The *base URL* is expected to point at a small service of your own that holds
the credential and forwards the query. The direct-from-browser switch exists to let
someone try a provider out, and says what it costs them.

## Branding

The logo is one asset — `public/brand/easyfix-logo.svg`. Both the rail header and
the watermark at the foot of the rail render it, so replacing that single file with
the official EASYFIX artwork updates every screen, watermark included. The file
currently in the repo is a placeholder and is marked as one.

## The stories built into the demo yard

Barn 1 is hand-built so a walkthrough always has something to find:

| Box | Horse | What the app catches |
|---|---|---|
| Stall 1 | Ndaawi | Flow meter offline — intake cannot be confirmed |
| Stall 3 | Wodhooh | Falling intake, flank watching, then down and rolling — the early colic picture |
| Stall 5 / 6 | Brighterdaysahead & Casheldale Lad | Swapped between boxes without the app being told; the camera recognises both in the wrong box and offers to fix the assignment |
| Stall 6 | Casheldale Lad | Air quality slipping, ammonia climbing |
| Stall 7 | Mordor | Box running hot against the comfort band |
| Stall 8 | Irish Point | Uneven weight bearing on the off fore |

Barns 2 and 3 are filled from the passport index and are mostly settled, with the
occasional real finding. Barns 4–9 have no layout yet, which is where barn setup
starts.

## How it is put together

```
src/
  lib/sim.js        seeded sensor streams, behaviour timeline, camera events
  lib/insights.js   thresholds → alerts, recommendations, barn and yard rollups
  lib/score.js      the weighted welfare index, its breakdown and its trend
  lib/passport.js   pluggable external passport providers, and normalisation
  lib/world.js      yards, barns, stall layouts, animals, the demo yard
  lib/registry.js   the simulated passport index used by profile creation
  lib/store.js      React context, localStorage persistence, the app clock
  lib/router.js     hash routing
  components/       camera canvas, layout editor, charts, attention cards,
                    welfare index, brand marks, primitives
  screens/          dashboard, barns, barn detail, animals, profile, video,
                    notifications, settings
```

Two ideas carry the whole thing:

1. **Readings are derived, not stored.** `dayReadings(stall, animal, day)` hashes the
   stall's seed with the date and hour to produce that day's litres, degrees and air
   score. A 300-box yard is therefore a few kilobytes of configuration, and the
   history behind any box goes back as far as you ask for it.
2. **The camera and the sensors share one source of truth.** The behaviour timeline
   that draws the stall view is the same one the alerting engine reads, so a flagged
   event and the footage of it can never disagree.

## What is simulated

All of it: the readings, the camera imagery (drawn on a canvas, not video), the
identity confidences and the passport index — the registry is a fixed table of
invented horses labelled as simulated, not a live studbook. The thresholds,
recommendations and layout rules are the parts meant to be argued with.
