#!/usr/bin/env python3

import argparse
import json
import sys

def main():
    parser = argparse.ArgumentParser(description='Function template')
    parser.add_argument('--input', required=True, help='JSON input data (use "-" for stdin)')
    parser.add_argument('--param2', default='default value', help='Example additional parameter')
    args = parser.parse_args()

    try:
        # Read JSON input from stdin if specified
        if args.input == '-':
            input_data = json.load(sys.stdin)
        else:
            input_data = args.input

        # Your function logic here
        result = {
            'message': 'Success',
            'data': input_data,
            'param2': args.param2
        }

        # Always output JSON
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({'error': str(e)}))
        sys.exit(1)

if __name__ == '__main__':
    main()
