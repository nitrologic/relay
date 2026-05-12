[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT) 
[![Deno](https://img.shields.io/badge/deno-2.4.2-black?logo=deno)](https://deno.land/)
[![Discord](https://img.shields.io/discord/GUILD_ID?label=discord&logo=discord)](https://discord.gg/xkSVNT2xYR)

# nitrologic slop relay

A research tool for advanced model manipulation.

Timestamps in logging files use slopmarks, a hexadecimal encoding of sixteenths of a second since 2025.4.12.

## roadmap

## project support

* ~/history.log
* ~/relay.md

when project active history.log shares from forge.log

shares are keyed per project 

> roha.keyedShares[key]=roha.sharedFiles;


### web search

To consider: 

* config search on
* implementation per API with account hints and tool billing


> openai

```
import OpenAI from 'openai';

const client = new OpenAI({
	apiKey: process.env.OPENAI_API_KEY
});

const response = await client.responses.create({
	model: 'gpt-5.5',
	tools: [
		{ type: 'web_search' }
	],
	input: 'What are the latest RP2350 announcements?'
});

console.log(response.output_text);
```

> anthropic webSearch

```

import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
	apiKey: process.env.ANTHROPIC_API_KEY
});

const response = await anthropic.messages.create({
	model: 'claude-sonnet-4-20250514',
	max_tokens: 512,
	tools: [
		{
			type: 'web_search_20250305',
			name: 'web_search'
		}
	],
	messages: [
		{
			role: 'user',
			content: 'What are the latest RP2350 announcements?'
		}
	]
});

console.log(response);
```

> xai tools webSearch 

```
import { xai } from '@ai-sdk/xai';
import { generateText } from 'ai';
const { text, sources } = await generateText({
  model: xai.responses('grok-4.3'),
  prompt: 'What is xAI?',
  tools: {
    web_search: xai.tools.webSearch(),
  },
});
console.log(text);
console.log('Citations:', sources);
```

## documentation

CLI Reference Manual - forge user documentation [forge.md](forge.md)

## setup

Requires an api environment variable, see accounts.json for latest

* DEEPSEEK_API_KEY
* XAI_API_KEY 
* OPENAI_API_KEY
* GEMINI_API_KEY
* MISTRAL_API_KEY
* ALIBABA_API_KEY
* ANTHROPIC_API_KEY
* COHERE_API_KEY
* MOONSHOT_API_KEY
* HUGGINGFACE_API_KEY

# supported

The following native API are used by Slop Relay:

```
		"api": "OpenAI",
		"api": "DeepSeek",
		"api": "Google",
		"api": "Anthropic",
```

# deprecated

Accounts and SDK support for Cohere Mistral Nvidia and Alibaba retired until previous notice.

# history

Stage one nitrologic roha [roha](https://github.com/nitrologic/roha)

Second stage nitrologic foundry [foundry](https://github.com/nitrologic/foundry) 

Third stage nitrologic forge [forge](https://github.com/nitrologic/forge)

Fourth stage slop fountain [forge](https://github.com/nitrologic/fountain)
