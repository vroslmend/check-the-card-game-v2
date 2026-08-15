# Contributing to Check!

Thanks for taking an interest. Check! is a personal project and the source is public so people can read it, learn from it and help make it better. Bug reports and ideas are as useful to me as code.

Before you send code, read the [Contributor License Agreement](#contributor-license-agreement) at the end of this file. This project is not open source in the usual sense, and submitting a contribution places it under that agreement.

Be decent to people in issues and pull requests. That is the whole code of conduct.

## Ways to contribute

- **Play it and report what breaks.** Open an issue with what you did and what happened. For multiplayer problems, include the number of players and the game code if you still have it.
- **Suggest a change.** Describe the problem you ran into rather than the solution you have in mind. It usually leads somewhere better.
- **Improve the docs.** `docs/` holds the rules, architecture and setup notes.
- **Write code.** Read the rest of this file first.

## How work is tracked

Anything larger than a quick fix gets an issue, so the reason for a change exists in writing before the code does.

- Every issue ends with a **Current state** line recording what was verified and when. Check that it still holds before you start, because the problem may already be gone.
- When you file one, end it the same way: a command anyone can run to see whether the problem still exists, what it returns today, and the date. A `grep` beats a sentence, and it beats a line number, because line numbers rot within weeks and a search only breaks when the code it describes actually changes. The Task template has the shape.
- Issues labelled **needs decision** are not ready to build. They are waiting on a call from me about how the feature should work, and code sent against one will sit unmerged until that is settled.
- Comment on an issue before you start, so two people do not build the same thing.
- If there is no issue for what you want to do, open one and wait for a reply before writing code. It is a short wait and it saves work being thrown away.

The labels are deliberately few:

- **bug** — the game does something the rules say it should not.
- **enhancement** — something new, or something working as designed that should work differently.
- **chore** — tooling, CI, dependencies, repo housekeeping. No effect on how the game plays.
- **documentation** — the docs disagree with reality, or a gap in them.
- **needs decision** — waiting on a call from me before anyone builds it. Adding this to your own issue is a useful signal that you want an answer rather than a pull request.

The templates apply the first three for you. Anything filed without a label gets one from me, so pick the closest and do not worry about it.

## Setting up

Requirements, install steps and environment variables are in the [README](README.md). The short version:

```
npm ci
npm run dev
```

That builds the shared types and the server, then runs the Next.js client and the Socket.IO server together. You need both, because the server is authoritative for every rule in the game.

The client hot reloads. The server does not: it runs from a build, so after changing anything under `server/` you restart `npm run dev` to pick it up.

Before changing anything, read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). `shared-types` is the contract between the two halves, so anything crossing that boundary starts there.

## Making a change

- Branch off `main`. Main is protected, so a pull request is the only way in: CI must pass, one approving review, no direct commits, no force pushes.
- Name the branch after the work: `fix/short-description`, `feat/short-description`, or `chore/short-description` for maintenance that is neither, such as tooling, formatting or dependencies. One branch per pull request, rather than one branch you keep reusing.
- One issue, one pull request. If you find a second problem along the way, open a second issue for it. A small fix bundled with a large rewrite cannot be reviewed or reverted cleanly and will be sent back.
- Stay inside the scope the issue describes. Where scope matters, the issue says what is out of bounds.
- Match the style of the code around you.
- Comment to stop a reader getting something wrong, not to narrate. Before writing one, ask what someone would do wrong without it. If the answer is nothing, delete it. The two common failures are restating what the code already says, and recounting how something came to be. History, counts and the reasoning behind a change belong in the commit message and the issue, where they stay searchable and cannot rot. A comment that documents a trap, an ordering that matters, or something that looks wrong and is deliberate, has earned its place.
- The docs follow the same rule. Match what is already there: short sentences, plain words, no decoration.
- Write plain commit messages that say what changed and why.

## Verifying your change

There is no automated test suite yet, tracked in #36. Until there is, verification is manual and the burden sits with the pull request.

Everything CI runs has to pass, and you can run all of it locally first:

```
npm run verify
```

That is the same command CI runs, so if it passes locally it passes there. It checks guarded dependency majors, builds the shared types, type checks all three packages, lints, checks formatting, and builds the server and the client.

Two notes on what it can tell you. If `check:majors` fails, a guarded package changed major version: do the migration deliberately and update the expectation in `scripts/check-dependency-majors.mjs` in the same pull request. And CI does one thing `verify` does not, starting the built server and waiting for it to answer `/health`, which catches a throw on startup that type checking cannot.

CI also starts the built server and waits for it to answer `/health`, which catches a throw on startup that type checking cannot.

Game behaviour is specified in [docs/GAME_RULES.md](docs/GAME_RULES.md). If you touched the rules, play a real round with a second browser window and follow the affected rule end to end.

## Things that will bite you

- **Do not mix formatting into a commit that changes logic.** The repo is prettier formatted and CI checks it, so run `npm run format` before you push. Keep any reformat in a commit of its own: mixed in, it buries the real change in noise, and only a formatting-only commit can safely go in `.git-blame-ignore-revs`. Blame already skips the one bulk reformat. Run `git config blame.ignoreRevsFile .git-blame-ignore-revs` once so your local blame agrees with GitHub's.
- **Do not add an `engines` field or an `.nvmrc`.** Vercel and Render both read them, so adding one silently changes the Node version the live deployment builds with.
- **Do not add `paths-ignore` to `.github/workflows/ci.yml`.** CI is a required check, and a workflow skipped by path filtering leaves that check pending forever, which blocks the pull request from merging with no obvious cause. Use a job level `if:` instead, since a skipped job reports success.
- **`main` is protected by a repository ruleset, not classic branch protection.** `gh api repos/OWNER/REPO/branches/main/protection` returns 404 even though main is fully protected. Use `gh api repos/OWNER/REPO/rulesets`.
- **If you touch `server/src/state-redactor.ts`, be careful.** That function is the boundary that keeps hidden cards hidden, and it has leaked a player's own hand once before. No face-down card's rank or suit should reach any client outside SCORING and GAMEOVER, including the card's owner. `docs/GAME_RULES.md` defines what each player is allowed to know.

## Opening a pull request

Include:

- `Fixes #12` in the body, so the issue closes when the pull request merges.
- What you ran and what you checked. "Should work" is not verification.
- Before and after screenshots for anything visual, along with the viewport you looked at.

I review and merge everything myself, including work from collaborators with write access. Expect questions rather than silent rejection.

## Reporting a security problem

Do not open a public issue for anything exploitable. Use [private vulnerability reporting](https://github.com/vroslmend/check-the-card-game-v2/security/advisories/new), which reaches me privately.

The server is authoritative and redacts hidden cards before broadcasting state, so anything that lets a player learn information they should not have counts as a security problem, not a bug.

## Contributor License Agreement

**In short, and not as a substitute for the terms below:** Check! is all rights reserved. If you contribute, you keep the copyright in what you wrote and you keep your credit in the git history, but you give me an unrestricted, permanent right to use, change, ship and sell it as part of this project, including under a commercial license. If you are not comfortable with that, please contribute bug reports and ideas instead of code.

The following terms are adapted from the Apache Software Foundation Individual Contributor License Agreement, V2.2.

**1. Definitions.**

"Owner" means Ammar Hassan, the copyright holder of the Project.

"Project" means the software and documentation published in the repository at https://github.com/vroslmend/check-the-card-game-v2 and any successor to it.

"You" means the individual, or the legal entity on whose behalf the individual is acting, who Submits a Contribution.

"Contribution" means any original work of authorship, including any modifications or additions to an existing work, that is intentionally Submitted by You to the Owner for inclusion in, or documentation of, the Project. For the purposes of this definition, a work conspicuously marked or otherwise designated in writing by You as "Not a Contribution" is excluded.

"Submit" means any form of electronic, verbal or written communication sent to the Owner or the Owner's representatives, including but not limited to pull requests, issues, comments and electronic mail sent in connection with the Project.

**2. Grant of Copyright License.**

Subject to the terms and conditions of this Agreement, You hereby grant to the Owner and to recipients of software distributed by the Owner a perpetual, worldwide, non-exclusive, no-charge, royalty-free, irrevocable copyright license to reproduce, prepare derivative works of, publicly display, publicly perform, sublicense and distribute Your Contributions and such derivative works, in source or object form, under any license terms the Owner selects, including proprietary and commercial terms, and with no obligation of accounting or payment to You.

**3. Grant of Patent License.**

Subject to the terms and conditions of this Agreement, You hereby grant to the Owner and to recipients of software distributed by the Owner a perpetual, worldwide, non-exclusive, no-charge, royalty-free, irrevocable, except as stated in this section, patent license to make, have made, use, offer to sell, sell, import and otherwise transfer the Project, where such license applies only to those patent claims licensable by You that are necessarily infringed by Your Contribution alone or by combination of Your Contribution with the Project to which such Contribution was Submitted. If any entity institutes patent litigation against You or any other entity, including a cross-claim or counterclaim in a lawsuit, alleging that Your Contribution, or the Project to which You have contributed, constitutes direct or contributory patent infringement, then any patent licenses granted to that entity under this Agreement for that Contribution or Project shall terminate as of the date such litigation is filed.

**4. Representations.**

You represent that You are legally entitled to grant the above licenses. If Your employer or any other party has rights to intellectual property that You create, You represent that You have received permission to make the Contribution on behalf of that party, that that party has waived such rights for the Contribution, or that that party has executed a separate agreement with the Owner.

You represent that each of Your Contributions is Your original creation. You represent that Your Contribution submissions include complete details of any third party license or other restriction, including but not limited to related patents, trademarks and license agreements, of which You are personally aware and which are associated with any part of Your Contributions.

**5. Third Party Works.**

Should You wish to Submit work that is not Your original creation, You may Submit it to the Owner separately from any Contribution, identifying the complete details of its source and of any license or other restriction of which You are personally aware, and conspicuously marking the work as "Submitted on behalf of a third party: [named here]".

**6. No Warranty.**

Unless required by applicable law or agreed to in writing, You provide Your Contributions on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied, including, without limitation, any warranties or conditions of TITLE, NON-INFRINGEMENT, MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. You are not expected to provide support for Your Contributions, except to the extent You desire to provide support.

**7. No Obligation.**

You acknowledge that the Owner is under no obligation to accept, merge, use, distribute or maintain any Contribution, and that the decision to include a Contribution in the Project rests entirely with the Owner.

**8. Moral Rights and Attribution.**

Authorship of Your Contribution is recorded in the version control history of the Project and the Owner will not misrepresent it. To the extent permitted by applicable law, You waive, and agree not to assert, any moral rights in Your Contribution that would restrict the Owner's exercise of the rights granted in sections 2 and 3, including rights of integrity in relation to modification of Your Contribution.

**9. Notification.**

You agree to notify the Owner of any facts or circumstances of which You become aware that would make the representations in this Agreement inaccurate in any respect.

**10. Acceptance.**

By Submitting a Contribution to the Project, You accept and agree to this Agreement for Your present and future Contributions. This Agreement is a separate written agreement for the purposes of the GitHub Terms of Service and governs Your Contributions in place of the default inbound licensing that would otherwise apply.

**11. Governing Law.**

This Agreement is governed by the laws of the Islamic Republic of Pakistan, without regard to its conflict of law provisions, and You agree to the exclusive jurisdiction of the courts of Pakistan for any dispute arising out of it.
