import subprocess
subprocess.Popen(
    ['scrcpy.exe', '--max-size', '1400'],
    creationflags=0x08000000,
    cwd=r'C:\Users\cmiron\Downloads\scrcpy'
)
