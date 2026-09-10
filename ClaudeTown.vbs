' Runs ClaudeTown inside WSL with no visible console window.
' If the repo is not at ~/projects/claudetown, edit the path below.
Dim shell, cmd
Set shell = CreateObject("WScript.Shell")
cmd = "wsl.exe -e bash -lc ""cd ~/projects/claudetown && ./launch.sh"""
shell.Run cmd, 0, False
