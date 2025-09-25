# TCL Reality Code Library

This repository is a personal toolbox of snippets, scripts, and configuration assets that I use when working inside the **TCL Reality** Drive environment. Rather than a single cohesive project, it collects one-off utilities, experimental code, and reference material that I can quickly drop into a scenario when I need it.

## How Codex Fits In

I lean on OpenAI's Codex-powered assistants (like ChatGPT's **Code Interpreter**/**GitHub Copilot** style features) as a coding partner while I build out this library. Codex can:

- Brainstorm snippet ideas or help write new TCL procedures.
- Translate natural-language prompts into working Drive dictionaries or scripts.
- Review existing snippets and suggest improvements or debugging tips.

The workflow is conversational: describe the behavior you want, paste relevant context, and let Codex draft or refine the code. When the assistant proposes a useful snippet, I copy it into this repo so it is versioned and easy to reuse later. Keeping Codex-assisted code here prevents it from getting lost in a chat log.

=======

## What's Inside

The contents of the repository will evolve over time, but it typically includes:

- **Custom dictionaries** – Phrases and responses I have tailored for Reality scripts.
- **Reusable code snippets** – TCL fragments, helper procedures, and quick reference examples that speed up authoring.
- **Batch files and automation helpers** – Windows `.bat` scripts that bootstrap the environment, launch tools, or automate repetitive setup steps.
- **Scratch experiments** – Sandboxed tests or proof-of-concept files that I want to keep for future reference.

Because the collection is intentionally eclectic, many files are self-contained and may not interact with one another. Each directory is meant to act like a toolbox drawer: open it, grab what you need, and plug it into your active Drive project.

## Suggested Structure

Organize new material in a way that makes it easy to find later. A simple convention is:

```
├── dicts/          # Custom dictionary entries for Drive
├── snippets/       # Standalone TCL code samples
├── scripts/        # Batch files or other automation helpers
├── references/     # Notes, markdown docs, or quick references
└── sandbox/        # Temporary experiments you may revisit
```

Feel free to adapt the layout to match how you work—just keep the README up to date so you remember what lives where.

## Usage Tips

1. **Copy what you need** – Most files are designed to be copied directly into an active Reality project. Adjust variables or paths after pasting.
2. **Document assumptions** – When adding a snippet, include a short header comment explaining what it does, required context, and any dependencies.
3. **Version experiments** – If a scratch script proves useful, promote it to a named snippet or script so you can find it again later.
4. **Keep dictionaries curated** – Group related entries and note where they are used in your Drive scenarios to avoid conflicts.

## Using Git to Store Snippets

Even if you are new to Git, you only need a handful of commands to make this repository a reliable vault for your Drive assets.

1. **Clone the repo** onto the machine where you edit content:

   ```bash
   git clone https://github.com/your-username/TCL-Reality-Code.git
   cd TCL-Reality-Code
   ```

2. **Create or update files** inside the relevant folders (for example, add a new `.tcl` file under `snippets/`).

3. **Check what changed** so you can confirm the edits look right:

   ```bash
   git status
   git diff
   ```

4. **Save your changes** with a commit message that explains what you added:

   ```bash
   git add snippets/new-helper.tcl
   git commit -m "Add helper for looping through actors"
   ```

5. **Push the commit** to back it up on GitHub (or whichever remote you use):

   ```bash
   git push origin main
   ```

Over time you will build a searchable history of everything Codex helped you create. If you ever make a mistake, Git makes it easy to revert to a previous version.

=======

## Getting Started

Clone the repo to any machine where you prepare Drive content:

```bash
git clone https://github.com/your-username/TCL-Reality-Code.git
```

Then explore the folders, copy assets into your Reality project, or drop in new ideas you want to keep handy.

## Contributing and Maintenance

This repository is primarily for personal use, but future contributors should follow these guidelines:

- Keep commits focused on a single snippet, script, or dictionary update.
- Include brief README or inline documentation for anything that might need context later.
- Test batch files or TCL scripts in a safe environment before relying on them in production Drive workflows.

## License

Since the repo contains personal tooling, apply whatever licensing terms you prefer. If you plan to share it publicly, choose a license that matches how you expect others to use your snippets.

---

As the collection grows, revisit this README to reflect new categories or best practices. It is your quick reference for navigating the toolbox when you return after a break.
