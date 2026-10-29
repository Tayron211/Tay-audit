' Inicia Tay-Audit silenciosamente en segundo plano sin ventanas que se puedan cerrar por error
Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
currentDir = fso.GetParentFolderName(WScript.ScriptFullName)

WshShell.CurrentDirectory = currentDir
WshShell.Run "node start.js", 0, False
