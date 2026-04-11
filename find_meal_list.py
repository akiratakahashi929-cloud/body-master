with open('index.html', 'r') as f:
    lines = f.readlines()
for i, line in enumerate(lines):
    if "本日の食事メニューを構築する" in line:
        print(f"Button at line {i+1}")
    if "本日の構築済みプラン" in line:
        print(f"Plan at line {i+1}")
