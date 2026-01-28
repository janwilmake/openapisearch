# llmcontext(1) - LLM Context Processing utility

## NAME

llmcontext - process markdown context with LLM capabilities and caching

## SYNOPSIS

`llmcontext [options] <llm-base-path> <model-name> <messages> <output-type> <extension>`

## DESCRIPTION

llmcontext is a utility for generating completions from Language Learning Models (LLMs) with optional context and different output formats. It supports various output types and formats, with built-in caching capabilities.

## REQUIRED ARGUMENTS

- `llm-base-path`
  Base path for the LLM service

- `model-name`
  Name of the LLM model to use

- `messages`
  Messages in format /role/message/role/message/... where role can be system, assistant, user, or developer

- `output-type`
  Type of output requested. Must be one of:

  - result
  - codeblock
  - codeblocks
  - content

- `extension`
  Output file extension. Supported values:
  - json
  - yaml
  - md
  - html
  - txt
  - svg
    And various programming language extensions

## OPTIONS

- `-k, --api-key <key>`
  API key for LLM service

- `-r, --raw`
  Return raw output without processing

- `--temperature <value>`
  Sampling temperature (0.0 to 2.0, default: 1.0)

- `--max-tokens <n>`
  Maximum tokens to generate

- `--stream`
  Enable streaming mode for real-time output

- `--presence-penalty <value>`
  Presence penalty (-2.0 to 2.0, default: 0)

- `--frequency-penalty <value>`
  Frequency penalty (-2.0 to 2.0, default: 0)

## OUTPUT FORMATS

The response content-type is determined by several factors:

### Browser Requests (Accept: text/html)

- Returns text/html unless raw=true is specified

### Output Type Parameter

- result: Allows json or yaml extension
- content: Allows md extension (returns text/markdown)
- codeblock: Returns content-type based on file extension:
  - .js, .jsx → text/javascript
  - .ts, .tsx → text/plain
  - .css → text/css
  - .py → text/x-python
  - .java → text/x-java-source
  - .go → text/x-go
  - .rs → text/rust
  - .php → text/php
  - .rb → text/ruby
  - .r → text/x-r
  - .lua → text/x-lua
  - .swift → text/x-swift
  - .kt → text/x-kotlin
  - .scala → text/x-scala
  - .perl → text/x-perl
  - .sh, .bash → text/x-sh
  - .bat → text/x-bat
  - .ps1 → text/x-powershell
  - .sql → text/x-sql
  - .toml → text/toml
  - .tex → text/x-tex
  - .xml → text/xml
  - .csv → text/csv
    Other extensions default to text/plain

## EXAMPLES

Generate a completion with default settings:

```bash
llmcontext openai gpt-4 /user/Hello/assistant/Hi content md
```

Stream completion with custom temperature:

```bash
llmcontext --stream --temperature 0.7 anthropic claude-3 /user/Analyze_this/assistant/Here_is_my_analysis result json
```

Generate Python code:

```bash
llmcontext openai gpt-4 /user/Write_a_sorting_algorithm codeblock py
```

## EXIT STATUS

- 0: Successful completion
- 1: Invalid arguments or configuration
- 2: Authentication failure
- 3: API error
- 4: Network error
- 5: Rate limit exceeded

## ENVIRONMENT

- `LLM_API_KEY`
  Default API key for LLM service

- `LLM_BASE_PATH`
  Default base path for LLM service

## FILES

- ~/.llmcontext/config
  User configuration file

- ~/.llmcontext/cache/
  Cache directory for responses

## BUGS

Report bugs to: https://chatcompletions.com/issues

## AUTHOR

ChatCompletions.com

## COPYRIGHT

Copyright © 2024 ChatCompletions.com. License: MIT

## SEE ALSO

curl(1), http(1), json(1), yaml(1)
