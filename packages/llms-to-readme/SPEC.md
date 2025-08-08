RULES:
https://uithub.com/janwilmake/gists/tree/main/named-codeblocks.md

PROMPT:
https://llmstxt.org/index.md make a llms.txt to README.md converter cli with node without any dependencies. It:

- looks and reads llms.txt
- looks up git remote and default branch in .git folder
- finds the markdown links in it and urls
- for all relative links, prepends the link with uithub (a GitHub context service) https://uithub.com/{owner}/{repo}/tree/{defaultBranch} to get the full url for it and prepend https://badge.forgithub.com/{owner}/{repo}/tree/{defaultBranch} for the badgeUrl
- it then appends after the URL and description, before the next line, 2 markdown buttons: [![](badgeUrl)]({URL}) and [![](https://b.lmpify.com/Ask_AI)](https://letmeprompt.com/?q=${encodeUriComponent(url+' \n\nYour Prompt....'))
- it then writes the result to README.md

this should exist as exported function as well as CLI . use no dependencies
