# GPT Assistant UI

## Description

GPT Assistant UI is an open-source project that offers a sleek and intuitive user interface for interacting with a General Purpose Text (GPT) assistant. Whether you're a developer looking to integrate GPT functionalities, or an end-user keen on exploring AI-assisted text generation, this platform is crafted to cater to your needs.

Built with cutting-edge technologies such as Tauri for a seamless multi-platform experience, Angular 17 for a robust frontend framework, and PrimeNG for a rich set of UI components, GPT Assistant UI is designed to be both lightweight and user-friendly.

## Features

- __Multi-Platform Compatibility__: Thanks to Tauri, our application runs natively on Windows, MacOS, and Linux.
- __Modern Frontend__: Utilizing Angular 17, we ensure a fast and responsive user interface.
- __Rich UI Components__: With PrimeNG, the application is equipped with a wide range of UI components.
- __Enhanced Security__: Our app uses the HTTP Tauri module and operates within strict security constraints. No data leaves your device excepted the ones sent to OpenAI.
- __Local Data Management__: All your data remains on your device, stored securely in your user folder without any external web database interactions.
- __Open-Source License__: Released under the MIT License, granting you the freedom to modify, distribute, and use the software however you wish.

## Installation

To get started with GPT Assistant UI, you will need to set up your development environment. Here are the basic steps:

### Clone the repository:

```bash
git clone https://github.com/PaulWeinsberg/gpt-assistant-ui
cd gpt-assistant-ui
```

### Run project:

As the GPT Assistant UI is built with Tauri and Angular, you will need to install them first.
See [Tauri docs](https://tauri.app/v1/guides/) and [Angular docs](https://angular.dev) for more information.

To build the project run:

```bash
cargo tauri build
```

To run the project in development mode run:

```bash
cargo tauri dev
```

## Usage

Once you have the GPT Assistant UI running, simply adds a profile name and your OpenAI API key to get started. You can have multiple profiles with the same API key.

## Security

We take security seriously:

The application uses the HTTP Tauri module, and it's locked down to strict permissions.
User data is never sent to or saved on external web databases.
Filesystem access is restricted to the user's system folder only in the app subfolder.

## Contributions

We welcome contributions! If you would like to contribute to GPT Assistant UI, please contact me to get added to the project or create a pull request.

## License

GPT Assistant UI is licensed under the MIT License. This means you have the liberty to do anything you wish with the source code, subject to the conditions of the license. For more details, see the included LICENSE file in the repository.

## Support

If you encounter any issues or have any questions about the GPT Assistant UI, please file an issue on the project's GitHub issue tracker.

We hope you enjoy using GPT Assistant UI as much as we enjoyed building it!

Disclaimer: This project is not affiliated with OpenAI and does not include any direct integrations with GPT or any other proprietary AI models provided by OpenAI.
