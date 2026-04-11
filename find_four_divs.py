import re
with open('vercel_index.html', 'r') as f:
    text = f.read()

pattern = r"        </div>\n      </div>\n    </div>\n  </div>"
matches = [m.start() for m in re.finditer(pattern, text)]
for m in matches:
    line_num = text[:m].count('\n') + 1
    print(f"Found match at line {line_num}")
