#!/usr/bin/env node

async function main() {
  try {
    // Get all inputs as a single JSON object
    const inputs = JSON.parse(await new Promise(resolve => process.stdin.once('data', resolve)));
    
    // Example of destructuring with defaults
    const { 
      requiredParam,           // Required parameter
      optionalParam = 'default value'  // Optional parameter with default
    } = inputs;

    // Your function logic here
    const result = {
      message: 'Success',
      data: {
        required: requiredParam,
        optional: optionalParam
      }
    };

    // Always output JSON
    console.log(JSON.stringify(result));
  } catch (error) {
    // Always output errors as JSON
    console.error(JSON.stringify({
      error: error.message
    }));
    process.exit(1);
  }
}

main();
