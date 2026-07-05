import urllib.request, json, time

TOKEN = 't-g10475gDLMSHH3TUBDG4HGOKJOA5ACS2OBICV6GI'
BASE = 'YzhDbKo8pax5cOsY43DcUNYznye'
TABLE = 'tbltLxwtBGtkpxmS'

def feishu(method, path, body=None):
    url = 'https://open.feishu.cn/open-apis' + path
    data = json.dumps(body).encode('utf-8') if body else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header('Authorization', 'Bearer ' + TOKEN)
    req.add_header('Content-Type', 'application/json; charset=utf-8')
    resp = urllib.request.urlopen(req)
    return json.loads(resp.read().decode('utf-8'))

# Step 1: List all fields
resp = feishu('GET', f'/open-apis/bitable/v1/apps/{BASE}/tables/{TABLE}/fields?page_size=200')
fields = resp['data']['items']
print(f'Found {len(fields)} fields')

# Step 2: Delete all non-primary fields
for f in fields:
    if f.get('is_primary'):
        print(f'  SKIP primary: {f["field_name"]}')
        continue
    result = feishu('DELETE', f'/open-apis/bitable/v1/apps/{BASE}/tables/{TABLE}/fields/{f["field_id"]}')
    if result.get('code') == 0:
        print(f'  DELETED: {f["field_name"]}')
    else:
        print(f'  FAIL {f["field_name"]}: {result}')
    time.sleep(0.15)

# Step 3: Verify
resp = feishu('GET', f'/open-apis/bitable/v1/apps/{BASE}/tables/{TABLE}/fields?page_size=200')
remaining = resp['data']['items']
print(f'Remaining: {len(remaining)} fields')
for f in remaining:
    print(f'  {f["field_name"]}')
