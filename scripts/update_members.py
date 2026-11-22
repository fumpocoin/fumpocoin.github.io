"""Read the public member count from t.me and write members.json."""
import json
import re
import sys
import urllib.request

req = urllib.request.Request("https://t.me/fumpo_coin", headers={"User-Agent": "Mozilla/5.0"})
html = urllib.request.urlopen(req, timeout=20).read().decode("utf-8", "replace")
m = re.search(r'tgme_page_extra">\s*([\d\s ]+)\s*members', html)
if not m:
    sys.exit("member count not found; leaving members.json unchanged")
count = int(re.sub(r"\D", "", m.group(1)))
with open("members.json", "w") as f:
    json.dump({"members": count}, f)
    f.write("\n")
print("members:", count)
