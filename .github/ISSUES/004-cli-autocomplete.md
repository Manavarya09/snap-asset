Title: Add shell autocompletion for `snap-asset` CLI

Problem:
- The CLI lacks shell completion for bash/zsh/fish which improves UX.

Proposal:
- Add completion scripts and a `snap-asset completion` subcommand to install them.
- Add tests for completion script generation.

Files: `bin/snap-asset.js`, `docs`
