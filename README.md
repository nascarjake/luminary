![Screenshot](https://raw.githubusercontent.com/nascarjake/luminary/main/logo.png)

# Luminary

A visual development platform for creating AI pipelines using OpenAI assistants. Luminary provides tools for building workflows where multiple AI assistants can work together, with support for custom code integration.

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

To get started with Luminary, follow these steps:

### Desktop Application

1. Download the latest version for your platform from the GitHub releases page:
   - Windows: Download the `.exe` installer
   - macOS: Download the `.dmg` file
   - Linux: Support coming soon

2. Run the installer for your platform:
   - Windows: Execute the installer and follow the prompts. Once complete, Luminary will be available in your Start Menu.
   - macOS: Open the `.dmg` file and drag Luminary to your Applications folder. The app is signed and notarized for security.

## OpenAI Integration

Luminary is built around the OpenAI Assistants API, providing a structured interface for creating and managing AI workflows. The platform currently focuses exclusively on OpenAI's technology to ensure consistency across applications.

### Key Features
- **Assistant Builder**: A comprehensive interface for configuring OpenAI assistants, including system instructions, knowledge bases, and function definitions.
- **Profile Management**: Easily share and reuse assistant configurations across teams through our profile export/import system.
- **API Integration**: Seamless integration with OpenAI's latest API features, ensuring access to current capabilities.

### Future AI Integration Plans
We are exploring integration with additional AI technologies to expand Luminary's capabilities:
- Support for alternative language models
- LangChain integration for enhanced flexibility
- Extended model capabilities and custom model support

## Building a Pipeline

Creating an AI pipeline in Luminary involves three main components:

### 1. Object Schemas

Object schemas define the structure and validation rules for data passing between assistants, ensuring type safety and data consistency throughout your workflow.

Key features of the schema system include:
- Visual schema designer for rapid development
- JSON import/export for existing schemas
- Real-time validation and error checking
- Support for complex nested structures
- Automatic documentation generation

### 2. AI Assistants

Each assistant in your pipeline can be configured for specific tasks. The configuration interface includes:

- **System Instructions**: Define instructions that guide assistant behavior
- **Tool Integration**: Add custom functions and API capabilities
- **Input/Output Mapping**: Define data handling using schemas
- **Knowledge Base**: Add context and documentation
- **Behavior Controls**: Adjust response patterns and decision-making

### 3. Graph Pipeline

The visual graph editor connects assistants and defines data flow through:

- Drag-and-drop interface for placing assistants
- Visual connection tools
- Data flow validation
- Debug tools
- Support for branching and conditional flows

The graph system validates connections using object schemas to prevent type mismatches.

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
To create a custom function:
1. Write code in any language that runs via command line
2. Set up the function in Luminary:
   - Point to script file
   - Set execution command
   - Define input/output schemas
3. Use built-in tools for testing

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

This project builds on the GPT Assistant UI by PaulWeinsberg, extending it into a development platform while maintaining open-source principles.

## License

MIT License. See LICENSE.md for details.
