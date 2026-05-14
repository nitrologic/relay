# ꕶLOP Fountain ⛲ (DEPRECATED)

Home of nitrologic Slop Fountain — a 4th generation roha foundry forge LLM tool.

Addressing 595 models from 12* providers the LLM research project Slop Fountain 1.8 ⛲ approaches connected.

    * now includes a local ollama server with various distilled models running on an RTX 3080

Pleased to welcome 🎉 Grok 4.20 🎉 ChatGPT 5.4 <del>🎉 Gemini 3.1  🎉 Z.ai GLM 5 🎉 Claude Sonnet 4.6 🎉 Gemini 3 Pro 🎉Qwen3 Max and 🎉 Claude Haiku 4.5</del>.

> Planet earth is blue and there is nothing I can do - David Bowie

> maximum prompt length exceeded - every model ever

## Account Providers

> /account

| id | name      | brand | llm | credit   | topup                                        |
|---:|-------|-----------|----:|----------|-------| 
| 0  | deepseek  | 🐋    | 2   | $9.7996  | https://platform.deepseek.com/usage          |
| 1  | zai       | Z     | 6   | $2.8430  | https://z.ai/manage-apikey/billing           |
| 2  | moonshot  | 🜁     | 14  | $10.7483 | https://platform.moonshot.ai/console/account |
| 3  | alibaba   | 𝓪     | 134 | $-0.0087 | https://bailian.console.alibabacloud.com/    |
| 4  | cohere    | 🧩    | 8   | $-0.0015 | https://dashboard.cohere.com/billing         |
| 5  | mistral   | ⚡️    | 45  | $-0.0110 | https://console.mistral.ai/home              |
| 6  | anthropic | A\    | 9   | $2.3994  | https://console.anthropic.com/dashboard      |
| 7  | openai    | 🌀    | 129 | $8.9827  | https://platform.openai.com/settings         |
| 8  | xai       | 𝕏     | 14  | $8.3972  | https://console.x.ai                         |
| 9  | gemini    | 🌟    | 45  | $-0.0024 | https://console.cloud.google.com/            |
| 10 | nvidia    | 💚    | 189 | $0.0000  | https://build.nvidia.com/explore/discover    |
| 11 | ollama    | 🔗    | 3   | $0.0000  | https://ollama.com/library                   |

## Developer setup

Install [Deno 2.7.13](https://deno.com/)

### Researcher Links

* [fountain.md](roha/fountain.md) Configuration
* [forge.md](roha/forge.md) Command Set
* [plan.txt](roha/plan.txt) On the list
* [license](LICENSE) Copyright (c) 2026 Simon Armstrong - MIT License

## Blogs

* [blog-sloppy](sloppy/sloppy.md) a discord bot calls home 
* [blog-lab](lab/README.md) on the bench and in the sandbox - a bare metal MIPS R3000 tool chain side project
* [blog-nitrologic](nitro/nitrologic.md) the sprawl - a stream of notions in recreational programming
* [blog-slops](slop/blog2/blogust.md) 𐃅 recent test slop for fountain dwellers
* [blog-fountain](slop/blog/blogfountain.md) recent fountain models under test
* [blog-forge](https://github.com/nitrologic/forge/blob/main/blog.md) archived forge model under test

## SSH and Discord 

![](sloppy/sloppy.png)

> ssh localhost -p 6669

The sloppy bot Deno worker joins [Discord Channel](https://discord.gg/e49ZhmQEjC) to Slop Fountain and routes posts to prompts.

Sloppy SSH endpoint in development - not currently available remotely. 

## Latest Commits

Added a robot 🤖 low latency boolean field to model spec.

The raw sloppy prompt mode is a low level keyboard driver designed to add new features to Fountain input

* shortcode :eyes: type : eyes :
* tab support - huh, no wonder the vanilla Deno prompt() is tab free
* history support - cursor up down to step through command history like a real shell
* async cursor keys - prepare to fire cursor and extended key presses at slop workers in focus

## Personal Usage August 2025

Default Temperature in Slop Fountain reduced to 0.7. Breaks gpt-5-mini-2025-08-07.

![92 kilogram hot head at 1.0](slop/media/orchestrator1.0.png)
![92 kilogram in the shade at 0.7](slop/media/orchestrator0.7.png)

Processing the logs with experimental /raw command. 

We began the month changing to hex 16ths of a second timestamping, because...

````
890aa20 [roha] [STRIP] /raw/forge-macos-6e20e81-86e50d3.log 12297 Mon Aug 04 2025 Fri Aug 22 2025
890aa20 [roha] [STRIP] /raw/forge-windows-6d97ea5-878fcbd.log 68682 Sun Aug 03 2025 Sat Aug 23 2025
````

The first two line counts are lines typed or pasted by myself, fountain user 0, from PC and MacBook.

* nitro@ryzen5 2857
* simon@midnightblue 268

The next is a line count of the models under test, my top 5 for August to date.

* deepseek-chat 15024
* gpt-5-mini 6853
* claude-sonnet-4 6637
* grok-4-0709 1969
* kimi-k2-0711 890
