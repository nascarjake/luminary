#!/usr/bin/env node

function finalOutput(output) {
  console.log('$%*%$Output:' + JSON.stringify(output));
}

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

    // Use finalOutput to return result
    finalOutput(result);
  } catch (error) {
    // Always output errors as JSON
    console.error(JSON.stringify({
      error: error.message
    }));
    process.exit(1);
  }
}

main();
