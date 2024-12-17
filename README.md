![Screenshot](https://raw.githubusercontent.com/nascarjake/luminary/main/logo.png)

# Luminary

A visual development platform for creating AI pipelines using OpenAI assistants. Luminary provides tools for building workflows where multiple AI assistants can work together, with support for custom code integration.

[Demo Video v0.0.7](https://www.youtube.com/watch?v=g46q1IjClz8)

## Overview

Why use Luminary?
Many times when trying to create complex AI behavior, trying to train a single AI bot to complete the entire task can often lead to inconsistent results, errors and hallucinations. A common tactic to combat this is to split a large task into multiple AI assistants, each trained with a specific role and focus. 

Creating workflows that coordinate multiple AI assistants typically requires significant development effort and system architecture. Luminary aims to simplify this process through visual tools and a structured development environment.

The platform enables AI assistants to communicate through a visual graph system. Developers can design workflows visually while retaining the ability to integrate custom code and extend functionality. This makes it suitable for various use cases, from content generation to data analysis workflows.

![Screenshot](https://raw.githubusercontent.com/nascarjake/luminary/main/screen_graph.png)

![Screenshot](https://raw.githubusercontent.com/nascarjake/luminary/main/screen_chat.png)

## Components

### Desktop Application

The desktop application serves as the development environment for creating and managing AI pipelines. Built with Electron, it includes:

- A visual graph editor for pipeline creation
- Tools for assistant configuration and management
- An object schema designer for defining data structures
- Profile and project management tools
- Cross-platform support for Windows, macOS, and Linux (coming soon)

The application focuses on providing a clear workflow for both simple and multi-stage AI pipelines.

### Pipeline Engine (NPM Library)

The Luminary Pipeline Engine is a Node.js library that runs AI workflows. It can be used to:

- Deploy pipelines in Node.js environments
- Integrate workflows into existing applications
- Run pipelines independently of the desktop application
- Scale solutions as needed

The engine handles assistant communication and function execution, with documentation covering integration options and capabilities currently in development.

## Installation

### Requirements:

- Installing Node.js is not required to run Luminary. However, if you import a profile which uses functions written in node.js, you will need to install Node.js to run the functions.
- Installing Python is not required to run Luminary. However, if you import a profile which uses functions written in python, you will need to install Python to run the functions.

To get started with Luminary, follow these steps:

### Desktop Application

1. Download the latest version for your platform from the GitHub releases page:
   - Windows: Download the `.exe` installer
   - macOS: Download the `.dmg` file
   - Linux: Support coming soon

2. Run the installer for your platform:
   - Windows: Execute the installer and follow the prompts. Once complete, Luminary will be available in your Start Menu.
   - macOS: Open the `.dmg` file and drag Luminary to your Applications folder. The app is signed and notarized for security.

## Building

To build and run Luminary from source, use the following commands:

### Development Mode
Run the application in development mode:

```
npm run electron:dev
```

This command concurrently starts the Angular development server and launches Electron, allowing for real-time updates as you modify the code.

### Production Builds

#### Windows
To create a production build for Windows:

```
npm run electron:build:win
```

This generates an installer in the `dist` folder.

#### macOS
For macOS, use:

```
npm run electron:build:mac
```

This creates a `.dmg` file in the `dist` folder.

Note: Ensure you have the necessary development tools installed for your target platform before running these commands.

## Environment Setup

This section is optional. The environments will be created automatically when running `npm run electron:dev`

The project uses environment files for configuration. We provide a public template (`environment_public.ts`) that gets committed to the repository. For local development:

1. Run the setup script:
   - On macOS/Linux:
     ```bash
     ./scripts/setup-env.sh
     ```
   - On Windows:
     ```cmd
     scripts\setup-env.bat
     ```

2. Edit the generated files with your private settings:
   - `src/environments/environment.ts`
   - `src/environments/environment.development.ts`

These local environment files are gitignored to keep private settings secure.

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
Profiles are stored in a `.luminary` file in your system's application data directory:
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

## Functions

Functions allow custom code execution in your AI pipelines, enabling integration with external systems and data processing.

### Integration Methods
Functions can be used as:
1. **Assistant Tools**: Code that assistants can execute
2. **Standalone Nodes**: Independent processing steps in your pipeline

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

## Roadmap

Current development plans include:

### Upcoming Features
- **Event Scheduling**: Automated pipeline execution
- **LangChain Integration**: Additional AI model support
- **Building Tools**: Simplified assistant setup
- **Development Tools**: Enhanced debugging

### Future Plans
- More model options
- Pipeline templates
- Team development features
- Enterprise tools

## Community

Created by JakeDoesDev with support from developers and AI enthusiasts.

Join our Discord for:
- Technical help
- Feature discussions
- Resources
- Updates

[Discord Server](https://discord.gg/6BJTUpDSsE)

## Credits

This project builds on the [GPT Assistant UI by PaulWeinsberg](https://github.com/PaulWeinsberg/gpt-assistant-ui/), extending it into a development platform while maintaining open-source principles.

## License

MIT License. See LICENSE.md for details.
