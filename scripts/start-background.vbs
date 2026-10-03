Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' Get project directory from script location
ScriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
ProjectDir = fso.GetParentFolderName(ScriptDir)

' Change to project directory and run silent launcher with 0 (hidden window)
WshShell.CurrentDirectory = ProjectDir
WshShell.Run """" & ProjectDir & "\scripts\run-silent.bat""", 0, False
