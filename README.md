# nitrologic slop relay

A research tool for advanced model manipulation.

Timestamps in logging files use slopmarks, a hexadecimal encoding of sixteenths of a second since 2025.4.12.

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
