"""錄影用：靜態伺服器（江戶町根目錄）＋ POST /__snap/<檔名> 存到指定資料夾
用法：python tools/snapsrv.py <輸出資料夾> [port=8812]"""
import sys, os, base64, http.server, functools
OUT = sys.argv[1]; PORT = int(sys.argv[2]) if len(sys.argv) > 2 else 8812
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.makedirs(OUT, exist_ok=True)
class H(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store'); super().end_headers()
    def do_POST(self):
        if not self.path.startswith('/__snap/'): self.send_error(404); return
        name = os.path.basename(self.path[8:])
        data = self.rfile.read(int(self.headers['Content-Length']))
        if data.startswith(b'data:'): data = base64.b64decode(data.split(b',', 1)[1])
        open(os.path.join(OUT, name), 'wb').write(data)
        self.send_response(200); self.end_headers(); self.wfile.write(b'ok')
http.server.ThreadingHTTPServer(('127.0.0.1', PORT), functools.partial(H, directory=ROOT)).serve_forever()
