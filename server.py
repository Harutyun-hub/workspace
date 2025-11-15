#!/usr/bin/env python3
import http.server
import socketserver
import os
import json
import sys
from urllib.parse import urlparse, parse_qs

PORT = 5000

SUPABASE_URL = os.environ.get('SUPABASE_URL', '')
SUPABASE_ANON_KEY = os.environ.get('SUPABASE_ANON_KEY', '')

if not SUPABASE_URL:
    print("ERROR: Missing environment variable SUPABASE_URL", file=sys.stderr)
    print(f"Available env vars: {list(os.environ.keys())[:10]}", file=sys.stderr)
    sys.exit(1)

if not SUPABASE_ANON_KEY:
    print("ERROR: Missing environment variable SUPABASE_ANON_KEY", file=sys.stderr)
    sys.exit(1)

print(f"✓ Configuration loaded successfully")

class MyHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        self.send_header('Expires', '0')
        super().end_headers()
    
    def do_GET(self):
        if self.path == '/api/config':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            
            config = {
                'SUPABASE_URL': os.environ.get('SUPABASE_URL', ''),
                'SUPABASE_ANON_KEY': os.environ.get('SUPABASE_ANON_KEY', '')
            }
            
            self.wfile.write(json.dumps(config).encode())
        else:
            super().do_GET()

socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(("0.0.0.0", PORT), MyHTTPRequestHandler) as httpd:
    print(f"Server running at http://0.0.0.0:{PORT}/")
    httpd.serve_forever()
