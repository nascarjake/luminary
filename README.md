# ![Luminary Logo](https://raw.githubusercontent.com/nascarjake/luminary/main/logo.png)

<h1 align="center">AI Pipeline Tool</h1>
<p align="center">A visual development platform for creating complex AI workflows using OpenAI assistants.</p>

<p align="center">
  <a href="https://github.com/nascarjake/luminary/releases/latest">
    <img src="https://img.shields.io/github/v/release/nascarjake/luminary?label=Latest%20Release&style=for-the-badge" alt="Latest Release" />
  </a>
  <a href="LICENSE.md">
    <img src="https://img.shields.io/github/license/nascarjake/luminary?style=for-the-badge" alt="License" />
  </a>
</p>

<p align="center">
  <strong><a href="https://github.com/nascarjake/luminary/releases/latest">Download</a> &nbsp;·&nbsp; <a href="https://www.youtube.com/watch?v=LyOMJq47ASQ">Demo</a> &nbsp;·&nbsp; <a href="https://www.canva.com/design/DAGZZUBLnFc/-VlBs8UTq1k_2Hc5fHsC6Q/edit?utm_content=DAGZZUBLnFc&utm_campaign=designshare&utm_medium=link2&utm_source=sharebutton">Presentation</a> &nbsp;·&nbsp; <a href="https://jakedoesdev.com">Discord</a></strong>
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

## Luminary Builds Businesses

**Want to start a merch shop?**
- Create a pipeline that generates images, sends them to teespring
- Create merch items on teespring like shirts and mugs using the images (via api)
- Select and buy a domain and connect it to your teespring site (via cloudflare api or something like that)
- Create seo metadata for your site
- Create social media posts of your products and schedule them to post.

**Want to start a survey website/app?**
- Create an ai that asks the user what type of survey they want to build
- Collect information about what type of recommednations or call to actions need to be made
- Generate a data object that can be plugged into an app you are building which provides a great survey experience.

If you are building an app or tool that lets people make their own guide, website, flyer, schedule, trading bot, anything.... then you can use AI to make a pipeline that will make using your tool as easy as talking.

You design that AI pipeline in luminary, then export it to the standalone luminary pipeline engine library which can be imported into your project. This means you use the luminary tool to build and test the pipeline, then use it to run your own app or business.

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

To get started with Luminary, follow these steps:

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
     - ```bash
       sudo dpkg -i luminary_x.x.x_<arch>.deb
       ```
       Replace `<arch>` with either `arm64` or `amd64` based on your download
     - If you encounter any dependency issues, run:
       ```bash
       sudo apt-get install -f
       ```
     - Launch Luminary from your applications menu or by running `luminary` in the terminal

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

> **Skip this unless you are changing the way the application builds** — the default scripts auto-generate these environment files.

1. Run the setup script:
   - macOS/Linux: `./scripts/setup-env.sh`
   - Windows: `scripts\setup-env.bat`
2. Edit the generated files in `src/environments/` to add any environment variables you need.  

These files are `.gitignore`d to keep your data safe.
These scripts are run automatically when you run `npm run electron:dev` via `./scripts/setup-env.js`

---

## OpenAI Integration

Luminary is built around the OpenAI Assistants API, providing a structured interface for creating and managing AI workflows. The platform currently focuses exclusively on OpenAI's technology to ensure consistency across applications.

### OpenAI Requirements

1. **API Key**: To use OpenAI assistants in Luminary, you need to have an OpenAI API key. You can obtain an API key from the OpenAI website. Once you have the key, you can set it in Luminary's settings.

2. **API Usage Tier**: OpenAI has different pricing plans for API usage. Luminary supports using the API at any tier, but some models and features may be locked, and you may experience rate limit issues, depending on your usage tier. To get a higher usage tier, you need to add more funds to your OpenAI API Account. 

(The video pipeline shown in the example video was made with a single $50 deposit into a blank OpenAI Api account. This allowed for 450k TPM and the use of a 16k token gpt4o model)

### Future AI Integration Plans
We are exploring integration with additional AI technologies to expand Luminary's capabilities:
- Support for alternative language models
- LangChain integration for enhanced flexibility
- Extended model capabilities and custom model support

---

## Building a Pipeline

Creating an AI pipeline in Luminary involves a step-by-step process using three main components: Object Schemas, AI Assistants, and the Graph Pipeline. Here's a guide to building a pipeline, using a video generation workflow as an example:

### 1. Define Object Schemas

Start by creating object schemas for all data types you'll pass between assistants:

1. Open the Schema Editor UI or prepare JSON schema definitions.
2. Create schemas for each data type. For our video generation example:
   - Outline schema
   - Script schema
   - Video schema
3. Define properties and validation rules for each schema.
4. Save your schemas for use in assistant configurations.

### 2. Configure AI Assistants

Next, set up the assistants that will process your data:

1. Create a new assistant in the Assistant Configuration interface.
2. Write system instructions to define the assistant's role and behavior.
3. Attach necessary tool functions, which may include your custom scripts.
4. Specify input and output object schemas:
   - For an outline generator: No input, Outline schema as output
   - For a script writer: Outline schema as input, Script schema as output
   - For a video creator: Script schema as input, Video schema as output
5. If you don't select an output function, Luminary will create one automatically.
6. Repeat this process for each assistant in your pipeline.

### 3. Build the Graph Pipeline

Finally, create the visual workflow using the graph editor:

1. Open the Graph Editor canvas.
2. Drag assistant nodes from the left library panel onto the canvas.
3. Arrange your nodes in the desired workflow order.
4. Connect nodes by dragging from an output dot to an input dot:
   - Outline Generator output to Script Writer input
   - Script Writer output to Video Creator input
5. Ensure connections are between compatible object schema types.
6. Luminary will validate connections to prevent type mismatches.
7. Add any branching or conditional flows as needed.
8. Test your pipeline using the debug tools provided.

By following these steps, you'll create a fully functional AI pipeline in Luminary, with data flowing seamlessly between your custom assistants.

---

## Profiles

Profiles in Luminary organize and contain AI workflows. Each profile includes the components needed to run AI pipelines.

### Profile Components
A profile contains:
- Pipeline configurations
- Assistant definitions
- Object schemas
- Custom functions
- Graph layouts

### Storage and Management
Profiles and related files are stored in a `.luminary` file in your User directory:
- Windows: `%userprofile%\.luminary`
- macOS: `~/.luminary`

Luminary is installed in the following directories:
- Windows: `%AppData%/Luminary`
- macOS: `~/Library/Application Support/Luminary`

### Profile Operations
The settings menu allows you to:
- Create new profiles
- Import profiles from zip files
- Export profiles
- Switch between profiles

### Compatibility
Profiles work with:
- Desktop application via zip files
- Pipeline engine library
- Version control systems

---

## Projects

Projects help organize different aspects of your AI workflows within profiles.

### Project Management
- Sort generated content
- Handle scheduled events
- Track executions
- Separate development and production work

### Access and Control
Through the settings menu, you can:
- Create and remove projects
- Monitor resources
- Set access controls
- View activity logs

---

## Scheduling

Luminary includes a scheduling system complete with a calendar view for easy scheduling.
You can schedule tasks to run at specific times; events can send new messages, or objects generated in the past.

**Scheduling allows you to:**
- Schedule tasks to run at specific times
- Set up recurring tasks, weekly or monthly
- Monitor task executions

**Example usage:**
- Generate a video, object is saved
- Schedule object to be passed to the Upload To Youtube function/assistant in one week.

---

## Functions

Functions allow custom code execution in your AI pipelines, enabling integration with external systems and data processing. You can bring your own code for each function you create. Any language is supported as long as the script can be executed by a terminal command.

**What is an AI Tool function?**
AI Tool Functions = Actions performed by the AI

Tool functions allow assistants to execute code. These functions can be used to perform tasks like data processing, data analysis, or data transformation. The code that is executed is code you write, or import. *The code does not run in OpenAI's servers*. Instead it runs within Luminary on your **local machine**. 

In order for the AI to call your function you must setup a **tool definition**. Luminary helps you do this in the assistant editor. A **tool definition** is simply a JSON object that defines the input and output schemas for your function. This is what tells the AI how to call your function, what parameters are available, and what the function is used for.

### Integration Methods
Functions can be used as:
1. **Assistant Tools**: Code that assistants can execute
2. **Standalone Nodes**: Independent processing steps in your pipeline

### Output Functions
Assistant tool functions have the option to be marked isOuptut. When this is set to true, the function will be used as the output function for the assistant. If no output function is set, Luminary will create one automatically, based on the outputs defined in the assistant's tool definition.

### Media Management
Object Schema fields can be marked as isMedia. When this is set to true, the field will be used to store media files. isMedia fields are automatically downloaded when outputted from AI assistants or assistant tool functions.

### Function Development
To create a custom function in Luminary:

1. Write your function code:
   Choose any language that can be executed via command line. Here are examples in JavaScript and Python:

   **JavaScript Example (function.js):**
   ```javascript
   #!/usr/bin/env node

   function finalOutput(output) {
     console.log('$%*%$Output:' + JSON.stringify(output));
   }

   async function main() {
     try {
       const inputs = JSON.parse(await new Promise(resolve => process.stdin.once('data', resolve)));
       
       const { title, content } = inputs;
       
       // Your function logic here
       const processedContent = content.toUpperCase();
       
       const result = {
         title: title,
         processedContent: processedContent
       };
       
       finalOutput(result);
     } catch (error) {
       console.error(JSON.stringify({ error: error.message }));
       process.exit(1);
     }
   }

   main();
   ```

   **Python Example (function.py):**
   ```python
   #!/usr/bin/env python3
   import sys
   import json

   def final_output(output):
       print('$%*%$Output:' + json.dumps(output))

   try:
       inputs = json.loads(sys.stdin.read())
       
       title = inputs['title']
       content = inputs['content']
       
       # Your function logic here
       processed_content = content.upper()
       
       result = {
           'title': title,
           'processedContent': processed_content
       }
       
       final_output(result)
   except Exception as e:
       print(json.dumps({'error': str(e)}), file=sys.stderr)
       sys.exit(1)
   ```

2. Set up the function in Luminary:
   - Script File: Point to your script file (e.g., `function.js` or `function.py`).
   - Execution Command: 
     - For JavaScript: `node function.js`
     - For Python: `python function.py`
   - Define Input/Output Schemas:
     Input Schema:
     ```json
     {
       "type": "object",
       "properties": {
         "title": { "type": "string" },
         "content": { "type": "string" }
       },
       "required": ["title", "content"]
     }
     ```
     Output Schema:
     ```json
     {
       "type": "object",
       "properties": {
         "title": { "type": "string" },
         "processedContent": { "type": "string" }
       },
       "required": ["title", "processedContent"]
     }
     ```

3. Important Factors:
   - Use `$%*%$Output:` prefix for final output in both languages.
   - Handle errors and output them as JSON to stderr.
   - Parse input from stdin as JSON.
   - Ensure your script has proper execute permissions (chmod +x for Unix-like systems).

4. Testing:
   Use Luminary's built-in tools to test your function:
   - Provide sample inputs matching your input schema.
   - Verify the output matches your output schema.
   - Test error scenarios to ensure proper error handling.

By following these steps, you can create custom functions that seamlessly integrate with Luminary's AI pipelines, allowing for powerful data processing and external system interactions.

### Runtime Communication
Functions use standard streams:
- **Input**: JSON via stdin
- **Status**: Updates via stdout
- **Results**: Use '$%*%$Output:' prefix with JSON
- **Errors**: Standard stderr handling

### Output Formats
Functions can output:
- Single schema objects
- Multiple objects by schema
- Object arrays

#### Single Schema Output Example
```javascript
console.log('$%*%$Output:' + JSON.stringify({
  title: "My Processed Content",
  processedContent: "THIS IS THE UPPERCASE CONTENT"
}));
```

#### Multiple Schema Objects Output Example
Schema names for this example are: Video, Pictory Request, Pictory Render, Pictory Job
```javascript
console.log('$%*%$Output:' + JSON.stringify({
  video: { id: "123", url: "https://example.com/video.mp4" },
  pictoryRequest: { content: "Original content here" },
  pictoryRender: { status: "complete", progress: 100 },
  pictoryJob: { id: "job123", status: "finished" }
}));
```

#### Array Output Example
```javascript 
console.log('$%*%$Output:' + JSON.stringify({
  processedItems: [
    { id: 1, content: "FIRST ITEM" },
    { id: 2, content: "SECOND ITEM" },
    { id: 3, content: "THIRD ITEM" }
  ]
}));
```

### Templates
The `/functions/` directory includes:
- JavaScript and Python examples
- Input/output patterns
- Status update examples
- Error handling templates

---

## Roadmap

Current development plans include:

### Upcoming Features
- **Event Scheduling**: Automated pipeline execution (done)
- **LangChain Integration**: Additional AI model support
- **AI Building Tools**: Simplified assistant setup
- **Development Tools**: Enhanced debugging and code support

### Future Plans
- More model options
- Pipeline templates
- Team development features
- Enterprise tools

---

## Community

Created by JakeDoesDev with support from developers and AI enthusiasts.

Join our Discord for:
- Technical help
- Feature discussions
- Resources
- Updates

[![Discord](https://img.shields.io/discord/1113687849674745896?label=JakeDoesDev%20Discord&style=for-the-badge)](https://discord.gg/6BJTUpDSsE)

---

## Credits

Luminary was created by Jake of JakeDoesDev.com

This project builds on the [GPT Assistant UI by PaulWeinsberg](https://github.com/PaulWeinsberg/gpt-assistant-ui/), extending it into a development platform while maintaining open-source principles.

Made with [Windsurf](https://codeium.com/windsurf)

---

## License

MIT License. See LICENSE.md for details.

---

> **Thanks for checking out Luminary!**  
> If you find it valuable, [drop a star](https://github.com/nascarjake/luminary) and help grow our community. Enjoy building your AI pipelines!