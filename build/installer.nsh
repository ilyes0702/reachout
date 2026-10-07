!macro customUnInstall
  nsExec::ExecToLog 'schtasks.exe /Delete /TN "ReachOut Birthday Reminders" /F'
!macroend
