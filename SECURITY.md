# Security Policy

## Supported versions

Check! is deployed continuously from `main`. Only the currently deployed version is supported, and fixes land on `main` rather than in patch releases.

## Reporting a vulnerability

Please do not open a public issue for anything exploitable.

Use [private vulnerability reporting](https://github.com/vroslmend/check-the-card-game-v2/security/advisories/new), which opens a draft advisory visible only to me. If you cannot use that, contact me through my GitHub profile and I will open one on your behalf.

Please include what you did, what you observed, and how reliably it reproduces. A short recording or a websocket frame capture is more useful than a description.

## What counts as a vulnerability here

The server is authoritative and redacts hidden cards before broadcasting state, so the interesting class of bug is information disclosure rather than remote code execution.

Anything that lets a player learn information the rules say they should not have is in scope, including:

- Reading another player's hand, or your own face down cards, from network traffic or client state.
- Learning the order or contents of the deck.
- Seeing the result of a peek ability that was not granted to you.

Also in scope: performing an action out of turn or otherwise bypassing the server's validation, and anything that lets one player disrupt or end another player's game.

Out of scope: bugs with no security consequence, which belong in a normal issue, and denial of service through ordinary traffic volume against free tier hosting.

## What to expect

I maintain this project on my own time, so I cannot promise a response window. I will acknowledge a report when I see it, tell you whether I consider it in scope, and credit you in the advisory when it is fixed unless you would rather I did not. There is no bounty.
