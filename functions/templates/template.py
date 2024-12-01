#!/usr/bin/env python3

import json
import sys

def final_output(output):
    print(r'$%*%$Output:' + json.dumps(output))

def main():
    try:
        # Get all inputs as a single JSON object
        inputs = json.load(sys.stdin)
        
        # Example of getting parameters with defaults
        required_param = inputs['requiredParam']  # Required parameter
        optional_param = inputs.get('optionalParam', 'default value')  # Optional with default
        
        # Your function logic here
        result = {
            'message': 'Success',
            'data': {
                'required': required_param,
                'optional': optional_param
            }
        }
        
        # Use final_output to return result
        final_output(result)
    except Exception as e:
        # Always output errors as JSON
        print(json.dumps({
            'error': str(e)
        }))
        sys.exit(1)

if __name__ == '__main__':
    main()
