# nitrologic Forge Relay CLI Reference Manual

The forge text interfaces is designed for research tools such as Slop Relay⛲ to chat and share files with models under test.

It is designed to be human usable adopting traditional platforms where appropriate. Commands with no arguments may often prompt for a # index from the items displayed.

### /config

Toggle configuration flags.

Default values are typically:

* 0 squash : squash message sequences in output : false
* 1 reasonoutloud : echo chain of thought : false
* 2 tools : enable model tool interface : false
* 3 search : enable model websearch tool interface : false
* 4 commitonstart : commit shared files on start : true
* 5 saveonexit :  save conversation history on exit : false
* 6 ansi : markdown ANSI rendering : true
* 7 verbose : emit debug information : false
* 8 broken : ansi background blocks : false
* 9 logging : log all output to file : true
* 10 debugging : emit diagnostics : false
* 11 pushonshare : emit a /push after any /share : false
* 12 rawprompt : experimental rawmode stdin - broken paste : true
* 13 resetcounters : factory reset when reset : false
* 14 returntopush : hit return to /push - under test : false
* 15 slow : experimental output at reading speed : false
* 16 slops : console worker scripts : false

### /temp

Set or show the persona settings temperature.

Temp is an entropy control, use lower values for focus, higher for creativity.

### /share /attach

Share a file or folder with optional tag.

Files are added to the share list used by the /push /commit command.

A 🔗 signifies file share is included in current context.

Valid extensions for image files are .jpg and .png.

### /drop

Drop all files currently shared, reduce the context and save tokens.

Work in progress, see /reset for a simple alternative.

### /push /commit

Refresh shared files. 

Detects changes or deletions and updates the chat history.

Posts new versions of file content if modified.

### /reset

Clear all shared files and conversation history.

If config resetcounters true then clear all counters too.

### /history /list

List a summary of recent conversation entries. 

Provides a quick overview of chat history.

### /log

Dumps context onto poorly formatted wall.

### /say

Produce audible speech from previous or specified text.

### /cd

Change the working directory. 

User can navigate to a desired directory for file operations.

### /dir

List the contents of the current working directory. 

Helps user view available files and folders to share.

### /open

Open document with specified path.

## Model Under Test

### /model (all|next)

Select an AI model.

User can choose a model by name or index from the accounts available or next active model.

Unless specified only models with tested rates are listed.

### /dump

A review of models, prices and information.

### /note

Attach a note to the current model under test.

Annotate the model under test with notes and observations.

## experimental

### /begin

Start a new forge session with it's own history stack.

Keep the current history on the forge stack.

### /finish

Return to most recently pushed session.

## tags

### /tag

Describe all tags in use.

Displays tag name, count of shares tagged and description.

### /counter

List the internal application counters.

### /account /credit

Display current account information.

Select an account to adjust credits or view details.

### /forge

List all artifacts saved to the forge directory.

Select file to request Operating System open.

### /save [name]

Save the current conversation history. 

Creates a snapshot file of the conversation in the forge folder.

Defaults to transmission-HEX32_TIME.json

### /load

Load a saved conversation history snapshot.

User can specify a save index or file name to restore previous chats.


### /time

Display the current system time. 

To invoke a tool_call response prompt model for current time.


### /help

If you are reading this file, it may be due to the use of this command.

If you still need help visit the project page.

## forge prompt report

[model modelname cost size elapsed]

* cost - price of prompt if known else tokens spent
* size - context size estimate in bytes of all files shared
* elapsed - time in seconds spent in completion 

The token cost summary when model has no rate defined includes:

* promptTokens used in the context - drop files to reduce
* replyTokens used for completions - typically cost more
* totalTokens a running total of tokens used
