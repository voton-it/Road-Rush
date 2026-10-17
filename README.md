# Road Rush

A motorcycle combat racing game for the browser, built as a love letter to the early-90s
highway brawlers. Race fifteen riders down open two-lane roads, punch and kick your way
through the pack, steal clubs and chains, dodge traffic and cops, and spend your winnings
on faster bikes.

No build step and no assets to download: open `index.html` in a modern browser and play.
All graphics are painted procedurally on canvas, and all sound is synthesised with WebAudio.

## What carries over from the classic

- **Racing and brawling at the same time.** Pull alongside a rival and hit them until their
  stamina bar empties. Knock off an armed rider while your hands are empty and you take
  their weapon.
- **Kicks that shove.** A kick does little damage but pushes a rider sideways into
  traffic or off the road.
- **Crashes that cost you.** Hit a car or a roadside tree and you fly over the bars, then
  run back to your bike. Every crash damages the bike; wreck it and you pay for repairs.
- **Cops.** Police riders chase anyone they see. Get caught on the ground near one and
  you pay a fine.
- **Career and money.** Finish in the top 3 on all five roads to move up a level. Prize
  money and knockout bonuses buy better bikes. Run out of cash and it's game over.
- **A rival cast.** Fourteen riders with their own colours, temperaments, weapons and
  trash talk.

## What's new

- Five distinct roads with their own skies, fog, parallax backgrounds and scenery:
  Pacific Coast (ocean on your right), Redwood Run (fog and giant trees),
  Mojave Burn (sunset mesas and big jumps), Sierra Pass (snow peaks and hairpins) and
  Neon Night (streetlights, neon and headlight pools).
- Smooth vector riders that lean into corners, wind up their punches and swing chains,
  plus tumbling crash animations, sparks, dust and screen shake.
- Bikes get airborne over crests, with landings you feel.
- Smarter rivals: they plan lane changes around traffic, brake for slow cars, hunt you
  down when they're aggressive and fight each other.
- Nitro on superbikes, a fast-start bonus, a rear-view radar for riders behind you and a
  live position strip of the whole field.
- Procedural grunge-rock soundtrack and a synthesised engine that shifts through gears.
- Keyboard, gamepad and touch controls. Career progress is saved in the browser.

## Controls

| Action | Keyboard | Gamepad |
| --- | --- | --- |
| Steer | ← → or A D | Left stick / D-pad |
| Throttle | ↑ or W | Right trigger / A |
| Brake | ↓ or S | Left trigger / B |
| Punch or swing left | Z or J | X / left bumper |
| Punch or swing right | X or K | Y / right bumper |
| Kick nearest rider | C or L | Stick clicks |
| Nitro | Space or Shift | Back / D-pad up |
| Pause | Esc or P | Start |

On touch screens, on-screen buttons appear during a race. Landscape works best.

## Running it

Open `index.html` directly, or serve the folder with any static server:

```sh
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Code layout

| File | Purpose |
| --- | --- |
| `js/util.js` | Maths, colour helpers, seeded RNG, safe local storage |
| `js/data.js` | Bikes, rivals, tracks, level difficulty, prize money, weapons |
| `js/art.js` | Procedural sprites, cars, background layers and the vector bike and rider |
| `js/audio.js` | WebAudio engine, sound effects and the procedural music loop |
| `js/input.js` | Keyboard, gamepad and touch input |
| `js/track.js` | Seeded road generation: curves, hills, scenery placement |
| `js/render.js` | Pseudo-3D road projection, fog, sprites and post effects |
| `js/game.js` | Physics, rival AI, combat, crashes, cops and traffic |
| `js/hud.js` | In-race HUD |
| `js/ui.js` | Menus, career, bike shop and results |
| `js/main.js` | Boot and main loop |

The road renderer follows the classic segment-projection technique popularised by
Jake Gordon's "Javascript Racer" write-ups, extended with fog palettes, lit segments,
hill clipping for entities and per-theme scenery.
