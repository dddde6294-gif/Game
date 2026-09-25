# SkyFlip 3D 🤸

A tiny 3D backflip game that runs in the browser and plays great on iPhone.

**Play it:** https://dddde6294-gif.github.io/Game/

## How to play

- **Hold** anywhere on the screen to jump off the tower and start flipping.
- **Let go** to stop spinning. You have to land on your **feet**!
- Every flip you land earns **coins**. Grab the floating coins on the way down too.
- Land the number of flips shown as the goal to **clear the level** and unlock the next, taller tower.
- Perfect landings (nearly straight up) give 1.5x coins. Landing jumps in a row builds a 🔥 streak bonus.

## Features

- **12 levels**, from a 3 m backyard box to a 165 m Aurora Summit and a low-gravity Moon Base.
- **Store** with 9 skins (Ninja, Astronaut, Zombie, Robot, Lava Demon, Gold King, Ghost, Rainbow…)
  and 5 tricks (Layout, Twister, Rocket Tuck, Double Cork) that change how you spin and how many coins you earn.
- Progress and coins are saved on your device.
- Works offline once loaded, and can be installed on the iPhone home screen.

## Play on iPhone like an app

1. Open the game link in **Safari**.
2. Tap the **Share** button → **Add to Home Screen**.
3. Open SkyFlip from your home screen. It runs full screen, like a real app.

## Publishing the GitHub Page

The game lives in the [`docs/`](docs) folder and is published by the
[`Deploy game to GitHub Pages`](.github/workflows/pages.yml) workflow every time `main` changes.

One-time setup: in the repo go to **Settings → Pages → Build and deployment → Source** and pick **GitHub Actions**.

## Run it on your computer

It's plain HTML/JS with no build step:

```sh
cd docs
python3 -m http.server 8000
# open http://localhost:8000
```

## Code map

| File | What it does |
| --- | --- |
| `docs/index.html` | Page, menus, HUD, iOS web-app settings |
| `docs/style.css` | All the UI styling |
| `docs/js/main.js` | Game loop, physics, input, scoring, store, camera |
| `docs/js/data.js` | Levels, themes, skins and tricks (easy to tweak!) |
| `docs/js/character.js` | The 3D player model, poses and skins |
| `docs/js/world.js` | Builds each level: sky, tower, landing mat, scenery |
| `docs/js/audio.js` | Sound effects made with Web Audio (no sound files) |
| `docs/sw.js` | Offline support |
| `docs/vendor/three.module.min.js` | [three.js](https://threejs.org) r186 (MIT) |
