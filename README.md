Below is an example of a more modern, visual, and streamlined README structure—while keeping your original wording *largely untouched.* The main changes are layout improvements, visual callouts, and a more engaging flow. Feel free to pick and choose elements that resonate with your style!

---

# ![Luminary Logo](https://raw.githubusercontent.com/nascarjake/luminary/main/logo.png)

<h1 align="center">Luminary</h1>
<p align="center">A visual development platform for creating AI pipelines using OpenAI assistants.</p>

<p align="center">
  <a href="https://github.com/nascarjake/luminary/releases/latest">
    <img src="https://img.shields.io/github/v/release/nascarjake/luminary?label=Latest%20Release&style=for-the-badge" alt="Latest Release" />
  </a>
  <a href="LICENSE.md">
    <img src="https://img.shields.io/github/license/nascarjake/luminary?style=for-the-badge" alt="License" />
  </a>
</p>

<p align="center">
  <strong>Download &nbsp;·&nbsp; Demo &nbsp;·&nbsp; Presentation &nbsp;·&nbsp; <a href="https://jakedoesdev.com">Discord</a></strong>
</p>

---

## Table of Contents
- [Introduction](#introduction)
- [Key Features](#key-features)
- [Screenshots](#screenshots)
- [Installation](#installation)
- [Building](#building)
- [Environment Setup (Optional)](#environment-setup-optional)
- [OpenAI Integration](#openai-integration)
- [Building a Pipeline](#building-a-pipeline)
- [Profiles](#profiles)
- [Projects](#projects)
- [Scheduling](#scheduling)
- [Functions](#functions)
- [Roadmap](#roadmap)
- [Community](#community)
- [Credits](#credits)
- [License](#license)

---

## Introduction

Luminary provides tools for building workflows where multiple AI assistants can collaborate. It also supports custom code integration for more advanced data processing. By splitting complex tasks into smaller roles, you can reduce errors and hallucinations, and keep your projects organized and maintainable.

> **Note**  
> **Download for free** from the [Releases](https://github.com/nascarjake/luminary/releases/latest), check out the [Demo Video](https://www.youtube.com/watch?v=g46q1IjClz8), and explore the [Overview Presentation](https://www.canva.com/design/DAGZZUBLnFc/-VlBs8UTq1k_2Hc5fHsC6Q/edit?utm_content=DAGZZUBLnFc&utm_campaign=designshare&utm_medium=link2&utm_source=sharebutton). Join our community on [Discord](https://jakedoesdev.com)!

---

## Key Features
- **Multiple AI Assistants** — Build complex AI workflows by orchestrating specialized assistants.
- **Visual Graph Editor** — Drag-and-drop nodes to design AI pipelines without tangling in code.
- **Custom Code Integration** — Extend functionality with Node.js, Python, or any language via command line.
- **Profile & Project Management** — Keep everything from pipeline configurations to custom functions neatly organized.
- **Scheduling & Automation** — Run pipelines at set times, perfect for routine tasks or batch processes.
- **Desktop App & NPM Library** — Use the visual environment or integrate workflows directly into your own Node.js projects.

---

## Screenshots

<p align="center">
  <img src="https://raw.githubusercontent.com/nascarjake/luminary/main/screen_graph.png" alt="Graph Editor" width="49%" />
  <img src="https://raw.githubusercontent.com/nascarjake/luminary/main/screen_chat.png" alt="Chat Interface" width="49%" /><br />
  <img src="https://raw.githubusercontent.com/nascarjake/luminary/main/screen_schedule.png" alt="Scheduling UI" width="49%" />
</p>

---

## Installation

### Desktop Application
1. **Download the latest version** for your platform from the [GitHub releases page](https://github.com/nascarjake/luminary/releases/latest).  
   - **Windows**: `.exe` installer  
   - **macOS**: `.zip` file  
   - **Linux**: `.deb` package

2. **Install** for your platform:
   - **Windows**: Run the `.exe` and follow the setup.  
   - **macOS**:  
     - Extract the zip  
     - Double-click `install.command`  
     - Drag Luminary to `Applications`  
     - *App is not signed/notarized, so Gatekeeper may prompt you*  
   - **Linux**:  
     - `sudo dpkg -i luminary_x.x.x_<arch>.deb`  
     - Resolve dependencies with `sudo apt-get install -f`  

> **Note**  
> No need for Node.js or Python unless you plan on running custom functions that require them.

---

## Building

> **Prerequisite**  
> Ensure you have **Node.js 16+** installed.

1. **Clone** this repo.
2. Run `npm install`.

### Development Mode
```bash
npm run electron:dev
```
> This concurrently starts the Angular dev server and launches Electron.  
> **Tip:** After it loads, press `Ctrl+R` to refresh once Angular finishes building.

### Production Builds

- **Windows**:
  ```bash
  npm run electron:build:win
  ```
  *Creates an installer in the `dist` folder.*

- **macOS**:
  ```bash
  npm run electron:build:mac
  ```
  *Generates a `.dmg` in the `dist` folder.*  
  *Requires Xcode signing for a fully notarized build.*

---

## Environment Setup (Optional)

> **Skip this if you’re just running the app** — the default scripts auto-generate these environment files.

1. Run the setup script:
   - macOS/Linux: `./scripts/setup-env.sh`
   - Windows: `scripts\setup-env.bat`
2. Edit the generated files in `src/environments/` for any private tokens.  

These files are `.gitignore`d to keep your data safe.

---

## OpenAI Integration

Luminary currently leverages **OpenAI Assistants** for a consistent pipeline experience.

1. **API Key Required** — [Sign up](https://platform.openai.com/) for an API key, then add it to Luminary’s settings.  
2. **API Usage Tier** — Higher tiers offer more tokens and fewer rate limits.  

> **Future Plans**  
> - Alternative language models  
> - LangChain integration  
> - Extended model and custom model support  

---

## Building a Pipeline

Luminary uses three core concepts to orchestrate AI tasks: **Object Schemas**, **AI Assistants**, and a **Graph Pipeline**.

1. **Define Object Schemas** – Create JSON-based data structures for each stage of your pipeline.  
2. **Configure AI Assistants** – Assign roles, set system instructions, and map input/output schemas.  
3. **Connect Them in a Graph** – Use the visual editor to chain your AI assistants together.

Example flow for a **video generation** pipeline:
- **Outline Generator** → **Script Writer** → **Video Creator**.

---

## Profiles

Profiles bundle your pipelines, assistants, schemas, and custom functions in a single environment.

- **Where?**  
  - `.luminary` in your User directory (`%userprofile%\.luminary` on Windows, `~/.luminary` on macOS).  
- **What’s included?**  
  - Pipeline configs, assistant definitions, object schemas, function scripts, graph layouts.  
- **How to Manage?**  
  - Create, import, and export via the settings menu.  

---

## Projects

Projects organize different aspects within your profiles, like generated content, scheduling, and logs.

- **Create/Remove** projects in the settings menu.  
- **Monitor Resource Usage** and keep your development and production tasks separate.

---

## Scheduling

The built-in calendar-based scheduling lets you automate pipeline tasks at specific times.

- **Recurring** tasks (e.g., weekly or monthly).  
- **Example**: Generate a video now, then schedule an “Upload To YouTube” function for next week.

---

## Functions

Custom code is at the heart of Luminary’s extensibility. Write **JavaScript**, **Python**, or any command-line script, then define input/output schemas so an AI assistant can call your function.

> **Key Points**  
> - **Tool Definitions**: JSON instructions for the AI describing how to call your function.  
> - **Schema Validation**: Enforce structured inputs and outputs.  
> - **Local Execution**: Your code runs on your machine, not on OpenAI’s servers.  

**Example** JavaScript function snippet:
```javascript
#!/usr/bin/env node

function finalOutput(output) {
  console.log('$%*%$Output:' + JSON.stringify(output));
}

(async function main() {
  try {
    const inputs = JSON.parse(await new Promise(resolve => process.stdin.once('data', resolve)));
    // ... your function logic
    finalOutput({ /* your output */ });
  } catch (error) {
    console.error(JSON.stringify({ error: error.message }));
    process.exit(1);
  }
})();
```

---

## Roadmap

- **Recently Added**  
  - Scheduling (done)  
  - Pipeline enhancements  

- **Upcoming**  
  - **LangChain Integration**  
  - **Enhanced Debugging**  
  - **Pipeline Templates**  
  - **Team Collaboration**  

---

## Community

Created by [JakeDoesDev](https://jakedoesdev.com) with help from developers & AI enthusiasts.  

**Join our Discord** for help, feedback, or to share your latest AI pipeline creations!

[![Discord](https://img.shields.io/discord/1113687849674745896?label=JakeDoesDev%20Discord&style=for-the-badge)](https://discord.gg/6BJTUpDSsE)

---

## Credits

- **Author**: Jake @ [JakeDoesDev.com](https://jakedoesdev.com)  
- **Based on**: [GPT Assistant UI by PaulWeinsberg](https://github.com/PaulWeinsberg/gpt-assistant-ui)  
- **Built with**: [Windsurf](https://codeium.com/windsurf)

---

## License

This project is licensed under the [MIT License](LICENSE.md).

---

> **Thanks for checking out Luminary!**  
> If you find it valuable, [drop a star](https://github.com/nascarjake/luminary) and help grow our community. Enjoy building your AI pipelines!