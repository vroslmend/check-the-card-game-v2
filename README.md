# Check!

[![CI](https://github.com/vroslmend/check-the-card-game-v2/actions/workflows/ci.yml/badge.svg)](https://github.com/vroslmend/check-the-card-game-v2/actions/workflows/ci.yml)

A real-time multiplayer card game for the browser, built with Next.js, Socket.IO and XState.

_[Play](https://check-the-game.vercel.app)_ · _[Rules](https://check-the-game.vercel.app/rules)_ · _[Architecture](docs/ARCHITECTURE.md)_ · _[Contributing](CONTRIBUTING.md)_

![Check!](https://check-the-game.vercel.app/opengraph-image)

## The game

You hold four cards face down and you only ever saw two of them. Lowest hand wins, and Aces are worth minus one.

Draw a card, then choose: swap it into a hand you half remember, or throw it away. Every discard opens a window where anyone holding the same rank can dump it and shrink their hand. Guess wrong and you take a penalty card, and eight cards puts you out of the round. Kings, Queens and Jacks let you peek or swap when they hit the pile.

Call Check when you think you are lowest. Everyone else gets one more turn, then hands are revealed. Two to six players, no account needed.

## Running locally

```bash
npm ci
npm run build:shared
npm run dev
```

Client on `localhost:3000`, server on `localhost:8000`. Copy the `.env.example` in `client/` and `server/` to change ports, timers or table size.

Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request. Open work is in [issues](https://github.com/vroslmend/check-the-card-game-v2/issues).

## Licence

Source is public for reading, forking and modifying for personal, non-commercial and educational use, and the hosted game is free to play. Commercial use, redistribution and running a competing public instance are not permitted. See [LICENSE.md](LICENSE.md), and the contribution terms in [CONTRIBUTING.md](CONTRIBUTING.md) if you plan to send code.
