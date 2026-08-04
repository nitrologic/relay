# nitrologic development discussion

[skid] for note 5 issue likely caused by include relay.md files in globs

# current notes

1. relay recursive share feature

/share *.md

add all .md recursively

2. relay help issue
showHelp error The system cannot find the file specified. (os error 2): readfile 'forge.md'

3. odd start up state for project

>/share relay/*.md
shareName: C:\nitrologic\relay
[KOHA] Share file path: C:\nitrologic\relay\README.md  size: 3273
[KOHA] Share file path: C:\nitrologic\relay\forge.md  size: 6174
[KOHA] Share file path: C:\nitrologic\relay\notes.md  size: 34536
[KOHA] Share file path: C:\nitrologic\relay\relay.md  size: 36
[KEY] setProject nitrologic_relay C:\nitrologic\relay
[KEY] new project created {"key":"nitrologic_relay","path":"C:\\nitrologic\\relay","name":"nitrologic_relay"}
[KEY] history C:\nitrologic\relay/relay.log

4. relay reset should ask and flush all projects

5. object stat

>share arcade/*.md
+/share arcade/>8.md
[FOUNTAIN] callCommand error share arcade/>8.md The filename, directory name, or volume label syntax is incorrect. (os error 123): stat 'C:\nitrologic\arcade\>8.md' Error: The filename, directory name, or volume label syntax is incorrect. (os error 123): stat 'C:\nitrologic\arcade\>8.md'
    at async Object.stat (ext:deno_fs/30_fs.js:1:6204)
    at async createWalkEntry (https://deno.land/std@0.224.0/fs/_create_walk_entry.ts:37:16)
    at async expandGlob (https://deno.land/std@0.224.0/fs/expand_glob.ts:167:21)
    at async shareCommand (file:///C:/nitrologic/relay/relay.ts:2175:19)
    at async callCommand (file:///C:/nitrologic/relay/relay.ts:3741:6)
    at async chat (file:///C:/nitrologic/relay/relay.ts:4683:15)
    at async file:///C:/nitrologic/relay/relay.ts:4910:2
+


6. relay nic should announce name change in history

currently only at start up is nic info current

24c27bcd [roha] user: {"nic":"simonsta","user":"nitro@ryzen5","project":"nitrologic_arcade","sharecount":2,"terminal":"Console"}

2510f302 [roha] user: {"nic":"simonsta","user":"nitro@ryzen5","project":"\\_nitrologic","sharecount":7,"terminal":"vscode"}


7. arcade machine stepping should be more table like

column names rows, csv export, 

8. back up folder incorrect

C:\nitrologic>backup.bat
backup to snapshot  relay\snapshot-1785919726.06919-nitrologic

for /f %%a in ('powershell -c "Get-Date -UFormat %%s"') do set folder=relay\snapshot-%%a

for /f %%a in ('powershell -c "Get-Date -UFormat %%s"') do for %%A in ("%CD%") do set folder=relay\snapshot-%%a-%%~nxA
