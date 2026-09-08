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

**Dashboard** — the state of the yard in one screen: what needs attention (ranked,
each with the action to take), water intake and stall temperature by hour across
the yard, the intake outliers against their own six-day averages, barn-by-barn
health, and what the camera has flagged today.

**Yard → Barns** — every building, laid out or not. A barn is a grid you paint:
boxes, aisle, door, tack room, wash bay, feed store. Save it and each box becomes a
monitored stall with a flow meter, probes and a camera. Occupied boxes are named
before they are removed.

**Barn** — the stall-by-stall table a yard reads in the morning (intake, pace against
goal, temperature, air, what the camera is calling), the barn's water/feed/bedding
stock, and the plan view with alerts flagged on the boxes.

**Animals** — profiles created by searching a passport index rather than typing:
name, microchip, sire and dam, markings, owner and trainer come back from the
search, and the horse is dropped into a free box. Each profile carries its intake,
temperature and air charts, the camera's behaviour timeline for the day, the
identity the camera has settled on, and the yard's notes.

**Video** — every camera on one wall with the identity and behaviour overlay live,
or one camera with the day behind it: scrub the timeline, jump to a flagged clip,
play back at 1×, 8× or 60×. Cameras switch to infra-red after 20:00.

**Notifications** — today's alerts and the week behind them, filterable by barn,
severity or source.

**Settings** — the thresholds every alert is measured against, the camera's identity
and behaviour switches, who gets told, and the demo controls (export the yard, add
ten more barns of thirty boxes to see it at 300-stall scale, reset).

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
  lib/world.js      yards, barns, stall layouts, animals, the demo yard
  lib/registry.js   the simulated passport index used by profile creation
  lib/store.js      React context, localStorage persistence, the app clock
  lib/router.js     hash routing
  components/       camera canvas, layout editor, charts, alert list, primitives
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
