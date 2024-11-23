#!/usr/bin/env node

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

async function main() {
  const argv = yargs(hideBin(process.argv))
    .option('input', {
      describe: 'JSON input data (use "-" for stdin)',
      type: 'string',
      demandOption: true
    })
    .option('param2', {
      describe: 'Example additional parameter',
      type: 'string',
      default: 'default value'
    })
    .parse();

  try {
    // Read JSON input from stdin if specified
    let inputData;
    if (argv.input === '-') {
      inputData = JSON.parse(await new Promise(resolve => process.stdin.once('data', resolve)));
    } else {
      inputData = argv.input;
    }

    // Your function logic here
    const result = {
      message: 'Success',
      data: inputData,
      param2: argv.param2
    };

    // Always output JSON
    console.log(JSON.stringify(result));
  } catch (error) {
    console.error(JSON.stringify({
      error: error.message
    }));
    process.exit(1);
  }
}

main();
