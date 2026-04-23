import os
import re

API_FILE = '/workspace/frontend/src/services/api.ts'
with open(API_FILE, 'r') as f:
    content = f.read()

# Replace all tableId arguments
content = re.sub(r'tableId:\s*string,?\s*', '', content)
content = re.sub(r'table_id:\s*tableId,?\s*', '', content)
content = re.sub(r',\s*\{\s*params:\s*\{\s*table_id:\s*tableId\s*\}\s*\}', '', content)
content = re.sub(r'\{\s*params:\s*\{\s*table_id:\s*tableId\s*\}\s*\}', '', content)

# Remove table_id from interfaces
content = re.sub(r'table_id:\s*string;\s*\n', '', content)

# Replace params usage
content = re.sub(r'params\.table_id\s*=\s*tableId;', '', content)
content = re.sub(r'table_id:\s*tableId', '', content)

# Fix some comma issues
content = re.sub(r',\s*}', '}', content)
content = re.sub(r',\s*\)', ')', content)

# WS fix
ws_func = """export const createWebSocket = (): WebSocket => {
  const token = getToken();
  const baseWsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:8000';
  const wsUrl = baseWsUrl.includes('/ws') ? baseWsUrl : `${baseWsUrl}/ws`;
  const urlWithToken = token ? `${wsUrl}?token=${encodeURIComponent(token)}` : wsUrl;
  return new WebSocket(urlWithToken);
};"""
content = re.sub(r'export const createWebSocket =.*?};', ws_func, content, flags=re.DOTALL)

with open(API_FILE, 'w') as f:
    f.write(content)

# lib/queryClient.ts
QC_FILE = '/workspace/frontend/src/lib/queryClient.ts'
with open(QC_FILE, 'r') as f:
    qc = f.read()

qc = re.sub(r'tableId:\s*string,?\s*', '', qc)
qc = re.sub(r',\s*tableId', '', qc)
qc = re.sub(r'tableId\s*=>', '() =>', qc)
qc = re.sub(r'\s*tableId', '', qc)
qc = re.sub(r"\[([^\]]+), ''\]", r"[\1]", qc)
qc = re.sub(r"\[([^\]]+), '',", r"[\1,", qc)

with open(QC_FILE, 'w') as f:
    f.write(qc)

